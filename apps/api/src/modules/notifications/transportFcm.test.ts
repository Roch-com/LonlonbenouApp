/** Adaptateur FCM : ce qui part, ce qu'on redemande, ce qu'on délie. */
import { beforeAll, describe, expect, it } from 'vitest';
import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import type { Appareil } from '../../domaine/depot.ts';
import { ErreurPush, type MessagePousse } from './transport.ts';
import { creerTransportFcm } from './transportFcm.ts';

const ANDROID: Appareil = {
  partenaireId: 'gaelle',
  jetonPush: 'jeton-appareil-gaelle',
  plateforme: 'android',
};

const message = (surcharge: Partial<MessagePousse> = {}): MessagePousse => ({
  appareil: ANDROID,
  titre: 'LONLONBENU',
  corps: 'Quelque chose vous attend.',
  regroupees: 1,
  ...surcharge,
});

let clePriveePem: string;
let clePublique: Awaited<ReturnType<typeof generateKeyPair>>['publicKey'];

beforeAll(async () => {
  const paire = await generateKeyPair('RS256', { extractable: true });
  clePriveePem = await exportPKCS8(paire.privateKey);
  clePublique = paire.publicKey;
});

interface AppelObserve {
  url: string;
  entetes: Record<string, string>;
  corps: string;
}

/**
 * Double de `fetch` : répond au point de terminaison OAuth2 puis à l'envoi,
 * et garde trace de tout pour qu'on puisse l'inspecter.
 */
function fauxFetch(
  reponsesEnvoi: { statut: number; corps?: unknown }[] = [{ statut: 200 }],
) {
  const appels: AppelObserve[] = [];
  let jetons = 0;
  let envois = 0;

  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const entetes = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    );
    appels.push({ url: String(url), entetes, corps: String(init?.body ?? '') });

    if (String(url).includes('oauth2.googleapis.com')) {
      jetons += 1;
      return new Response(
        JSON.stringify({ access_token: `acces-${jetons}`, expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const attendue = reponsesEnvoi[Math.min(envois, reponsesEnvoi.length - 1)]!;
    envois += 1;
    const corps =
      typeof attendue.corps === 'string'
        ? attendue.corps
        : JSON.stringify(attendue.corps ?? {});
    return new Response(corps, { status: attendue.statut });
  }) as unknown as typeof globalThis.fetch;

  return {
    fetch,
    appels,
    get demandesDeJeton() {
      return jetons;
    },
    envois: () => appels.filter((a) => a.url.includes('fcm.googleapis.com')),
  };
}

function creer(
  double: ReturnType<typeof fauxFetch>,
  maintenant?: () => number,
) {
  return creerTransportFcm({
    projetId: 'lonlonbenu-test',
    courrielCompteService: 'push@lonlonbenu.iam.gserviceaccount.com',
    clePriveePem,
    fetch: double.fetch,
    ...(maintenant ? { maintenant } : {}),
  });
}

describe('jeton d’accès', () => {
  it('signe une assertion que Google pourrait vérifier', async () => {
    const double = fauxFetch();
    await creer(double).pousser(message());

    const demande = double.appels[0]!;
    const assertion = new URLSearchParams(demande.corps).get('assertion')!;

    const { payload } = await jwtVerify(assertion, clePublique, {
      audience: 'https://oauth2.googleapis.com/token',
      issuer: 'push@lonlonbenu.iam.gserviceaccount.com',
    });
    expect(payload['scope']).toBe(
      'https://www.googleapis.com/auth/firebase.messaging',
    );
  });

  it('n’en redemande pas un à chaque notification', async () => {
    const double = fauxFetch();
    const transport = creer(double);

    for (let i = 0; i < 5; i++) await transport.pousser(message());

    expect(double.demandesDeJeton).toBe(1);
    expect(double.envois()).toHaveLength(5);
  });

  it('en redemande un quand il approche de l’expiration', async () => {
    let horloge = Date.parse('2026-03-15T12:00:00Z');
    const double = fauxFetch();
    const transport = creer(double, () => horloge);

    await transport.pousser(message());
    horloge += 3600_000;
    await transport.pousser(message());

    expect(double.demandesDeJeton).toBe(2);
    expect(double.envois()[1]?.entetes['authorization']).toBe('Bearer acces-2');
  });
});

describe('ce qui part chez Google', () => {
  it('ne transporte que le titre et le corps génériques', async () => {
    const double = fauxFetch();
    await creer(double).pousser(
      message({ titre: 'LONLONBENU', corps: 'Quelque chose vous attend.' }),
    );

    const charge = JSON.parse(double.envois()[0]!.corps) as {
      message: { token: string; notification: unknown; data?: unknown };
    };

    expect(charge.message.notification).toEqual({
      title: 'LONLONBENU',
      body: 'Quelque chose vous attend.',
    });
    // Pas de `data` : rien qui puisse porter un identifiant de couple ou un
    // fragment de contenu jusque chez Google.
    expect(charge.message.data).toBeUndefined();
    expect(charge.message.token).toBe(ANDROID.jetonPush);
  });

  it('ne réveille en priorité haute que le SOS', async () => {
    const double = fauxFetch();
    const transport = creer(double);

    await transport.pousser(message({ titre: 'SOS' }));
    await transport.pousser(message());

    const priorite = (i: number) =>
      (JSON.parse(double.envois()[i]!.corps) as {
        message: { android: { priority: string } };
      }).message.android.priority;

    expect(priorite(0)).toBe('high');
    expect(priorite(1)).toBe('normal');
  });
});

describe('classement des échecs', () => {
  it('marque le jeton comme mort sur UNREGISTERED', async () => {
    const double = fauxFetch([
      {
        statut: 404,
        corps: {
          error: {
            status: 'NOT_FOUND',
            details: [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode: 'UNREGISTERED',
              },
            ],
          },
        },
      },
    ]);

    const erreur = await creer(double)
      .pousser(message())
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurPush);
    expect((erreur as ErreurPush).jetonInvalide).toBe(true);
    expect((erreur as ErreurPush).reessayable).toBe(false);
  });

  it('traite un 503 comme passager, sans délier l’appareil', async () => {
    const double = fauxFetch([{ statut: 503 }]);

    const erreur = (await creer(double)
      .pousser(message())
      .catch((e: unknown) => e)) as ErreurPush;

    expect(erreur.reessayable).toBe(true);
    // Le point qui compte : une panne de Google ne coûte pas son inscription à
    // un appareil parfaitement valide.
    expect(erreur.jetonInvalide).toBe(false);
  });

  it('traite un 429 comme passager', async () => {
    const double = fauxFetch([{ statut: 429 }]);
    const erreur = (await creer(double)
      .pousser(message())
      .catch((e: unknown) => e)) as ErreurPush;

    expect(erreur.reessayable).toBe(true);
    expect(erreur.jetonInvalide).toBe(false);
  });

  it('ne se noie pas dans un corps d’erreur illisible', async () => {
    const double = fauxFetch([{ statut: 502, corps: '<html>Bad Gateway</html>' }]);
    const erreur = (await creer(double)
      .pousser(message())
      .catch((e: unknown) => e)) as ErreurPush;

    expect(erreur).toBeInstanceOf(ErreurPush);
    expect(erreur.statut).toBe(502);
    expect(erreur.jetonInvalide).toBe(false);
  });
});
