/**
 * Adaptateur Apple Push Notification service (API HTTP/2 par jeton).
 *
 * Apple impose HTTP/2 — pas de `fetch` possible ici, on passe par `node:http2`.
 * La connexion est **maintenue ouverte et réutilisée** : Apple pénalise
 * explicitement les clients qui ouvrent une connexion par notification.
 *
 * Le JWT d'autorisation (ES256, clé `.p8`) est mis en cache. Apple refuse un
 * jeton de moins de 20 minutes s'il est renouvelé trop souvent (`TooManyProviderTokenUpdates`)
 * et rejette celui de plus de 60 minutes (`ExpiredProviderToken`) : on vise le
 * milieu, 50 minutes.
 *
 * ## Ce qui part réellement
 *
 * `alert.title` et `alert.body`, tous deux génériques, plus le badge de
 * regroupement. Aucune donnée applicative, aucun identifiant de couple : cette
 * charge utile transite par Apple et s'affiche sur un écran verrouillé.
 */

import { connect, constants, type ClientHttp2Session } from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
import { ErreurPush, type MessagePousse, type Transport } from './transport.ts';

/** Apple tolère 20 à 60 minutes ; 50 laisse de la marge des deux côtés. */
const DUREE_JETON_MS = 50 * 60_000;

const HOTE_PRODUCTION = 'https://api.push.apple.com';
const HOTE_BAC_A_SABLE = 'https://api.sandbox.push.apple.com';

/** Raisons APNs signifiant « ce jeton d'appareil ne vaut plus rien ». */
const RAISONS_JETON_MORT = new Set([
  'BadDeviceToken',
  'Unregistered',
  'DeviceTokenNotForTopic',
]);

/**
 * Session HTTP/2 minimale, telle qu'utilisée ici. L'interface est déclarée
 * pour pouvoir injecter un double dans les tests sans ouvrir de socket.
 */
export interface SessionPush {
  requete(
    entetes: Record<string, string>,
    corps: string,
  ): Promise<{ statut: number; corps: string }>;
  fermer(): void;
}

export interface ConfigurationApns {
  /** Contenu de la clé `.p8` téléchargée chez Apple (PEM PKCS#8). */
  cleP8: string;
  /** Key ID de cette clé (`kid`). */
  idCle: string;
  /** Team ID du compte développeur (`iss`). */
  idEquipe: string;
  /** Bundle identifier de l'app iOS (`apns-topic`). */
  sujet: string;
  /** `false` pointe vers le bac à sable — les builds de développement en ont besoin. */
  production?: boolean;
  /** Injectable pour les tests. */
  ouvrirSession?: (hote: string) => SessionPush;
  /** Injectable pour les tests. */
  maintenant?: () => number;
}

export function creerTransportApns(config: ConfigurationApns): Transport {
  const hote = config.production === false ? HOTE_BAC_A_SABLE : HOTE_PRODUCTION;
  const maintenant = config.maintenant ?? (() => Date.now());
  const ouvrir = config.ouvrirSession ?? ouvrirSessionHttp2;

  let jeton: { valeur: string; renouvelerA: number } | undefined;
  let session: SessionPush | undefined;

  async function jetonValide(): Promise<string> {
    if (jeton && jeton.renouvelerA > maintenant()) return jeton.valeur;

    const cle = await importPKCS8(config.cleP8, 'ES256');
    const emisA = Math.floor(maintenant() / 1000);
    const valeur = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: config.idCle })
      .setIssuer(config.idEquipe)
      .setIssuedAt(emisA)
      .sign(cle);

    jeton = { valeur, renouvelerA: maintenant() + DUREE_JETON_MS };
    return valeur;
  }

  function sessionOuverte(): SessionPush {
    session ??= ouvrir(hote);
    return session;
  }

  return {
    async pousser(message: MessagePousse) {
      const autorisation = await jetonValide();
      const urgent = message.titre === 'SOS';

      const charge = JSON.stringify({
        aps: {
          alert: { title: message.titre, body: message.corps },
          sound: 'default',
          // Le badge reflète ce qui attend, pas ce que ça contient.
          badge: message.regroupees,
          // Regroupe la vague sous un seul bandeau plutôt qu'en pile.
          'thread-id': 'lonlonbenu',
        },
      });

      const entetes: Record<string, string> = {
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${message.appareil.jetonPush}`,
        [constants.HTTP2_HEADER_SCHEME]: 'https',
        authorization: `bearer ${autorisation}`,
        'apns-topic': config.sujet,
        'apns-push-type': 'alert',
        // 10 = tout de suite ; 5 = quand ça arrange l'appareil, meilleur pour
        // la batterie. Seul le SOS mérite de réveiller un téléphone au repos.
        'apns-priority': urgent ? '10' : '5',
        // Au-delà, la notification n'a plus d'intérêt : mieux vaut qu'Apple la
        // laisse tomber que de la remettre le lendemain.
        'apns-expiration': String(
          Math.floor(maintenant() / 1000) + (urgent ? 3600 : 24 * 3600),
        ),
        'content-type': 'application/json',
      };

      let reponse: { statut: number; corps: string };
      try {
        reponse = await sessionOuverte().requete(entetes, charge);
      } catch (erreur) {
        // Connexion tombée : on la jette pour que la prochaine tentative en
        // rouvre une propre, plutôt que de s'acharner sur une socket morte.
        session?.fermer();
        session = undefined;
        throw new ErreurPush(
          `Connexion APNs interrompue : ${(erreur as Error).message}`,
          { reessayable: true },
        );
      }

      if (reponse.statut === 200) return;

      const raison = extraireRaison(reponse.corps);

      // Un jeton d'autorisation refusé n'est pas la faute de l'appareil : on
      // oublie le nôtre pour en resigner un au prochain envoi.
      if (raison === 'ExpiredProviderToken' || raison === 'InvalidProviderToken') {
        jeton = undefined;
      }

      throw new ErreurPush(
        `Envoi APNs refusé (${reponse.statut}${raison ? ` ${raison}` : ''})`,
        {
          jetonInvalide: raison !== undefined && RAISONS_JETON_MORT.has(raison),
          reessayable:
            reponse.statut === 429 ||
            reponse.statut >= 500 ||
            raison === 'ExpiredProviderToken',
          statut: reponse.statut,
        },
      );
    },
  };
}

function extraireRaison(corps: string): string | undefined {
  try {
    return (JSON.parse(corps) as { reason?: string }).reason;
  } catch {
    return undefined;
  }
}

/** Session HTTP/2 réelle, réutilisée d'un envoi à l'autre. */
function ouvrirSessionHttp2(hote: string): SessionPush {
  let client: ClientHttp2Session | undefined;

  function clientOuvert(): ClientHttp2Session {
    if (client && !client.closed && !client.destroyed) return client;
    client = connect(hote);
    // Une session qui meurt ne doit pas faire tomber le processus : l'envoi
    // suivant la rouvrira.
    client.on('error', () => {});
    // N'empêche pas le processus de s'arrêter proprement.
    client.unref();
    return client;
  }

  return {
    requete(entetes, corps) {
      return new Promise((resoudre, rejeter) => {
        const flux = clientOuvert().request(entetes);
        let statut = 0;
        let recu = '';

        flux.setEncoding('utf8');
        flux.on('response', (recues) => {
          statut = Number(recues[constants.HTTP2_HEADER_STATUS] ?? 0);
        });
        flux.on('data', (morceau: string) => {
          recu += morceau;
        });
        flux.on('end', () => resoudre({ statut, corps: recu }));
        flux.on('error', rejeter);

        flux.end(corps);
      });
    },
    fermer() {
      client?.close();
      client = undefined;
    },
  };
}
