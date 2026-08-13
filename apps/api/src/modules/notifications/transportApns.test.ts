/** Adaptateur APNs : charge utile, jeton fournisseur, classement des refus. */
import { beforeAll, describe, expect, it } from 'vitest';
import { exportPKCS8, generateKeyPair, jwtVerify, decodeProtectedHeader } from 'jose';
import type { Appareil } from '../../domaine/depot.ts';
import { ErreurPush, type MessagePousse } from './transport.ts';
import { creerTransportApns, type SessionPush } from './transportApns.ts';

const IPHONE: Appareil = {
  partenaireId: 'rochambeau',
  jetonPush: 'jeton-appareil-rochambeau',
  plateforme: 'ios',
};

const message = (surcharge: Partial<MessagePousse> = {}): MessagePousse => ({
  appareil: IPHONE,
  titre: 'LONLONBENU',
  corps: 'Quelque chose vous attend.',
  regroupees: 1,
  ...surcharge,
});

let cleP8: string;
let clePublique: Awaited<ReturnType<typeof generateKeyPair>>['publicKey'];

beforeAll(async () => {
  const paire = await generateKeyPair('ES256', { extractable: true });
  cleP8 = await exportPKCS8(paire.privateKey);
  clePublique = paire.publicKey;
});

interface AppelObserve {
  entetes: Record<string, string>;
  corps: string;
}

/** Double de session HTTP/2 : aucune socket ouverte. */
function fausseSession(
  reponses: { statut: number; corps?: unknown }[] = [{ statut: 200 }],
) {
  const appels: AppelObserve[] = [];
  const hotes: string[] = [];
  let ouvertures = 0;
  let fermetures = 0;
  let i = 0;

  const ouvrirSession = (hote: string): SessionPush => {
    ouvertures += 1;
    hotes.push(hote);
    return {
      async requete(entetes, corps) {
        appels.push({ entetes, corps });
        const attendue = reponses[Math.min(i, reponses.length - 1)]!;
        i += 1;
        if (attendue.statut === 0) throw new Error('socket fermée');
        return {
          statut: attendue.statut,
          corps: JSON.stringify(attendue.corps ?? {}),
        };
      },
      fermer() {
        fermetures += 1;
      },
    };
  };

  return {
    ouvrirSession,
    appels,
    hotes,
    get ouvertures() {
      return ouvertures;
    },
    get fermetures() {
      return fermetures;
    },
  };
}

function creer(
  double: ReturnType<typeof fausseSession>,
  options: { production?: boolean; maintenant?: () => number } = {},
) {
  return creerTransportApns({
    cleP8,
    idCle: 'CLE123456',
    idEquipe: 'EQUIPE7890',
    sujet: 'com.lonlonbenu.app',
    ouvrirSession: double.ouvrirSession,
    ...options,
  });
}

describe('jeton fournisseur', () => {
  it('signe un ES256 qu’Apple pourrait vérifier, avec le kid en en-tête', async () => {
    const double = fausseSession();
    await creer(double).pousser(message());

    const autorisation = double.appels[0]!.entetes['authorization']!;
    expect(autorisation.startsWith('bearer ')).toBe(true);

    const jeton = autorisation.slice('bearer '.length);
    expect(decodeProtectedHeader(jeton).kid).toBe('CLE123456');

    const { payload } = await jwtVerify(jeton, clePublique, {
      issuer: 'EQUIPE7890',
    });
    expect(payload.iat).toBeTypeOf('number');
  });

  it('le réutilise — Apple refuse un renouvellement trop fréquent', async () => {
    const double = fausseSession();
    const transport = creer(double);

    for (let i = 0; i < 4; i++) await transport.pousser(message());

    const jetons = new Set(
      double.appels.map((a) => a.entetes['authorization']),
    );
    expect(jetons.size).toBe(1);
    // Et une seule connexion pour les quatre envois.
    expect(double.ouvertures).toBe(1);
  });

  it('le renouvelle passé la fenêtre de 50 minutes', async () => {
    let horloge = Date.parse('2026-03-15T12:00:00Z');
    const double = fausseSession();
    const transport = creer(double, { maintenant: () => horloge });

    await transport.pousser(message());
    horloge += 51 * 60_000;
    await transport.pousser(message());

    expect(double.appels[0]!.entetes['authorization']).not.toBe(
      double.appels[1]!.entetes['authorization'],
    );
  });
});

describe('ce qui part chez Apple', () => {
  it('n’envoie que l’alerte générique et le compte de regroupement', async () => {
    const double = fausseSession();
    await creer(double).pousser(message({ regroupees: 3 }));

    const charge = JSON.parse(double.appels[0]!.corps) as Record<string, unknown>;

    expect(charge['aps']).toEqual({
      alert: { title: 'LONLONBENU', body: 'Quelque chose vous attend.' },
      sound: 'default',
      badge: 3,
      'thread-id': 'lonlonbenu',
    });
    // Rien en dehors de `aps` : pas de charge applicative, donc rien
    // d'exploitable pour qui lirait le trafic ou l'écran verrouillé.
    expect(Object.keys(charge)).toEqual(['aps']);
  });

  it('vise le bon appareil et le bon sujet', async () => {
    const double = fausseSession();
    await creer(double).pousser(message());

    const entetes = double.appels[0]!.entetes;
    expect(entetes[':path']).toBe(`/3/device/${IPHONE.jetonPush}`);
    expect(entetes[':method']).toBe('POST');
    expect(entetes['apns-topic']).toBe('com.lonlonbenu.app');
    expect(entetes['apns-push-type']).toBe('alert');
  });

  it('ne réclame la priorité immédiate que pour le SOS', async () => {
    const double = fausseSession();
    const transport = creer(double);

    await transport.pousser(message({ titre: 'SOS' }));
    await transport.pousser(message());

    expect(double.appels[0]!.entetes['apns-priority']).toBe('10');
    expect(double.appels[1]!.entetes['apns-priority']).toBe('5');
  });

  it('parle au bac à sable quand la production n’est pas demandée', async () => {
    const double = fausseSession();
    await creer(double, { production: false }).pousser(message());
    expect(double.hotes[0]).toBe('https://api.sandbox.push.apple.com');
  });
});

describe('classement des refus', () => {
  const refus = async (statut: number, raison?: string) => {
    const double = fausseSession([
      { statut, corps: raison ? { reason: raison } : {} },
    ]);
    return (await creer(double)
      .pousser(message())
      .catch((e: unknown) => e)) as ErreurPush;
  };

  it('délie sur Unregistered', async () => {
    const erreur = await refus(410, 'Unregistered');
    expect(erreur.jetonInvalide).toBe(true);
    expect(erreur.reessayable).toBe(false);
  });

  it('délie sur BadDeviceToken', async () => {
    expect((await refus(400, 'BadDeviceToken')).jetonInvalide).toBe(true);
  });

  it('délie sur DeviceTokenNotForTopic', async () => {
    expect((await refus(400, 'DeviceTokenNotForTopic')).jetonInvalide).toBe(true);
  });

  it('ne délie pas sur une panne serveur', async () => {
    const erreur = await refus(503, 'ServiceUnavailable');
    expect(erreur.jetonInvalide).toBe(false);
    expect(erreur.reessayable).toBe(true);
  });

  it('ne délie pas sur un jeton fournisseur expiré — c’est notre faute, pas celle de l’appareil', async () => {
    const erreur = await refus(403, 'ExpiredProviderToken');
    expect(erreur.jetonInvalide).toBe(false);
    expect(erreur.reessayable).toBe(true);
  });

  it('resigne un jeton fournisseur après un refus d’autorisation', async () => {
    const double = fausseSession([
      { statut: 403, corps: { reason: 'ExpiredProviderToken' } },
      { statut: 200 },
    ]);
    const transport = creer(double);

    await transport.pousser(message()).catch(() => undefined);
    await transport.pousser(message());

    expect(double.appels[0]!.entetes['authorization']).not.toBe(
      double.appels[1]!.entetes['authorization'],
    );
  });

  it('jette la connexion tombée pour en rouvrir une propre', async () => {
    const double = fausseSession([{ statut: 0 }, { statut: 200 }]);
    const transport = creer(double);

    const erreur = (await transport
      .pousser(message())
      .catch((e: unknown) => e)) as ErreurPush;
    expect(erreur.reessayable).toBe(true);
    expect(double.fermetures).toBe(1);

    await transport.pousser(message());
    expect(double.ouvertures).toBe(2);
  });
});
