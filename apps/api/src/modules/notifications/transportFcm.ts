/**
 * Adaptateur Firebase Cloud Messaging (HTTP v1).
 *
 * Deux étapes, comme l'exige l'API v1 : un JWT auto-signé avec la clé du compte
 * de service est échangé contre un jeton d'accès OAuth2, puis ce jeton signe
 * les envois. Le jeton d'accès est **mis en cache jusqu'à son expiration** —
 * en redemander un à chaque notification ajouterait un aller-retour réseau à
 * chaque message, pour rien.
 *
 * ## Ce qui part réellement
 *
 * Un titre et un corps génériques, rien d'autre. Pas de `data`, pas
 * d'identifiant de couple, pas de contenu : FCM voit passer un jeton
 * d'appareil et deux phrases neutres. Pour le chat, le serveur n'a de toute
 * façon que des enveloppes scellées.
 *
 * ## Ce qui n'est pas fait
 *
 * Pas de file de reprise : un échec passager lève, `expedition.ts` le note, et
 * la notification reste en attente. Une vraie politique de reprise avec
 * temporisation exponentielle viendra avec le travail planifié.
 */

import { SignJWT, importPKCS8 } from 'jose';
import { ErreurPush, type MessagePousse, type Transport } from './transport.ts';

const PORTEE = 'https://www.googleapis.com/auth/firebase.messaging';
const URL_JETON = 'https://oauth2.googleapis.com/token';
const DUREE_JWT_S = 3600;
/** Marge avant expiration : on renouvelle un peu tôt plutôt qu'un peu tard. */
const MARGE_RENOUVELLEMENT_MS = 60_000;

export interface ConfigurationFcm {
  projetId: string;
  courrielCompteService: string;
  /** Clé privée du compte de service, au format PEM PKCS#8. */
  clePriveePem: string;
  /** Injectable pour les tests ; `globalThis.fetch` par défaut. */
  fetch?: typeof globalThis.fetch;
  /** Injectable pour les tests. */
  maintenant?: () => number;
}

interface JetonAcces {
  valeur: string;
  expireA: number;
}

/**
 * Codes FCM signifiant « ce jeton d'appareil ne vaut plus rien ».
 * Tout le reste est traité comme passager : mieux vaut réessayer que délier un
 * appareil valide sur un malentendu.
 */
const CODES_JETON_MORT = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'SENDER_ID_MISMATCH',
]);

export function creerTransportFcm(config: ConfigurationFcm): Transport {
  const appeler = config.fetch ?? globalThis.fetch;
  const maintenant = config.maintenant ?? (() => Date.now());

  let jeton: JetonAcces | undefined;
  let enCours: Promise<JetonAcces> | undefined;

  async function demanderUnJeton(): Promise<JetonAcces> {
    const cle = await importPKCS8(config.clePriveePem, 'RS256');
    const emisA = Math.floor(maintenant() / 1000);

    const assertion = await new SignJWT({ scope: PORTEE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(config.courrielCompteService)
      .setSubject(config.courrielCompteService)
      .setAudience(URL_JETON)
      .setIssuedAt(emisA)
      .setExpirationTime(emisA + DUREE_JWT_S)
      .sign(cle);

    const reponse = await appeler(URL_JETON, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!reponse.ok) {
      throw new ErreurPush(
        `Jeton d’accès FCM refusé (${reponse.status})`,
        { reessayable: reponse.status >= 500, statut: reponse.status },
      );
    }

    const charge = (await reponse.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!charge.access_token) {
      throw new ErreurPush('Réponse OAuth2 FCM sans jeton d’accès');
    }

    return {
      valeur: charge.access_token,
      expireA: maintenant() + (charge.expires_in ?? DUREE_JWT_S) * 1000,
    };
  }

  /** Un seul vol de renouvellement à la fois, comme côté mobile. */
  async function jetonValide(): Promise<string> {
    if (jeton && jeton.expireA - MARGE_RENOUVELLEMENT_MS > maintenant()) {
      return jeton.valeur;
    }
    enCours ??= demanderUnJeton()
      .then((obtenu) => {
        jeton = obtenu;
        return obtenu;
      })
      .finally(() => {
        enCours = undefined;
      });
    return (await enCours).valeur;
  }

  return {
    async pousser(message: MessagePousse) {
      const acces = await jetonValide();

      const reponse = await appeler(
        `https://fcm.googleapis.com/v1/projects/${config.projetId}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${acces}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: message.appareil.jetonPush,
              // Ni `data`, ni identifiant : le strict nécessaire pour afficher.
              notification: { title: message.titre, body: message.corps },
              android: {
                priority: message.titre === 'SOS' ? 'high' : 'normal',
                notification: {
                  // Regroupe les rappels d'une même vague sous une seule ligne.
                  tag: message.regroupees > 1 ? 'lonlonbenu-groupe' : undefined,
                },
              },
            },
          }),
        },
      );

      if (reponse.ok) return;

      const texte = await reponse.text().catch(() => '');
      const code = extraireCode(texte);

      throw new ErreurPush(`Envoi FCM refusé (${reponse.status}${code ? ` ${code}` : ''})`, {
        jetonInvalide:
          reponse.status === 404 || (code !== undefined && CODES_JETON_MORT.has(code)),
        reessayable: reponse.status === 429 || reponse.status >= 500,
        statut: reponse.status,
      });
    },
  };
}

/** Extrait le code d'erreur FCM, sans faire échouer l'appelant si le corps est illisible. */
function extraireCode(corps: string): string | undefined {
  try {
    const charge = JSON.parse(corps) as {
      error?: {
        status?: string;
        details?: { '@type'?: string; errorCode?: string }[];
      };
    };
    const detail = charge.error?.details?.find((d) =>
      d['@type']?.includes('FcmError'),
    );
    return detail?.errorCode ?? charge.error?.status;
  } catch {
    return undefined;
  }
}
