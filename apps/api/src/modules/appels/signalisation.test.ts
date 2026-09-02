/**
 * Le canal de signalisation, traversé pour de vrai.
 *
 * `app.inject` ne sait pas basculer en WebSocket : ces cas démarrent donc un
 * vrai serveur sur un port libre et s'y connectent. C'est le seul moyen de
 * vérifier ce qui a effectivement manqué en production — un canal qui ne
 * s'ouvre pas, ou un signal qui part au mauvais destinataire.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { COUPLE_ID, GAELLE, jetonPour, monterServeur, ROCHAMBEAU } from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const aFermer: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const fermer of aFermer.splice(0)) await fermer();
});

/** Démarre le serveur sur un port libre et rend son adresse WebSocket. */
async function ecouter(s: Serveur): Promise<string> {
  await s.app.listen({ port: 0, host: '127.0.0.1' });
  aFermer.push(async () => {
    await s.app.close();
  });
  const adresse = s.app.server.address();
  if (!adresse || typeof adresse === 'string') throw new Error('pas d’adresse');
  return `ws://127.0.0.1:${adresse.port}/appels/signal`;
}

/** Ouvre un socket et rend de quoi lire les messages reçus, dans l'ordre. */
function connecter(base: string, jeton: string) {
  const socket = new WebSocket(`${base}?jeton=${encodeURIComponent(jeton)}`);
  const recus: Record<string, unknown>[] = [];
  socket.on('message', (brut) => {
    recus.push(JSON.parse(brut.toString()) as Record<string, unknown>);
  });
  aFermer.push(async () => socket.close());

  return {
    socket,
    recus,
    ouvert: () =>
      new Promise<void>((resoudre, rejeter) => {
        if (socket.readyState === WebSocket.OPEN) return resoudre();
        socket.once('open', () => resoudre());
        socket.once('error', rejeter);
      }),
    ferme: () =>
      new Promise<number>((resoudre) => socket.once('close', resoudre)),
    /** Attend qu'un message arrive, ou abandonne. */
    attendre: async (sorte: string, limiteMs = 3000) => {
      const debut = Date.now();
      while (Date.now() - debut < limiteMs) {
        const trouve = recus.find((m) => m['sorte'] === sorte);
        if (trouve) return trouve;
        await new Promise((r) => setTimeout(r, 25));
      }
      return undefined;
    },
  };
}

describe('ouverture du canal', () => {
  it('accepte un jeton valide', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const client = connecter(base, jetonPour(GAELLE));
    await expect(client.ouvert()).resolves.toBeUndefined();
  });

  it('referme un jeton invalide plutôt que de laisser le socket pendre', async () => {
    // Un socket resté ouvert ferait croire au téléphone qu'il est branché,
    // et il attendrait des signaux qui n'arriveraient jamais.
    const s = await monterServeur();
    const base = await ecouter(s);

    const client = connecter(base, 'pas-un-jeton');
    expect(await client.ferme()).toBe(4401);
  });

  it('referme sans jeton du tout', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const socket = new WebSocket(`${base}`);
    aFermer.push(async () => socket.close());
    const code = await new Promise<number>((r) => socket.once('close', r));
    expect(code).toBe(4401);
  });
});

describe('la sonnerie parvient à l’autre', () => {
  it('pousse « sonne » sur le socket de celui qu’on appelle', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const chezRochambeau = connecter(base, jetonPour(ROCHAMBEAU));
    await chezRochambeau.ouvert();

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
      payload: { sorte: 'audio' },
    });

    const recu = await chezRochambeau.attendre('sonne');
    expect(recu).toBeDefined();
    expect((recu!['appel'] as { appelantId: string }).appelantId).toBe(GAELLE);
  });

  it('ne pousse rien à l’appelant lui-même', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const chezGaelle = connecter(base, jetonPour(GAELLE));
    await chezGaelle.ouvert();

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
      payload: { sorte: 'audio' },
    });

    expect(await chezGaelle.attendre('sonne', 600)).toBeUndefined();
  });
});

describe('relais de la négociation', () => {
  it('achemine une charge scellée à l’autre, et à lui seul', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const chezGaelle = connecter(base, jetonPour(GAELLE));
    const chezRochambeau = connecter(base, jetonPour(ROCHAMBEAU));
    await Promise.all([chezGaelle.ouvert(), chezRochambeau.ouvert()]);

    const appel = (
      await s.app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/appels`,
        headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
        payload: { sorte: 'audio' },
      })
    ).json().appel as { id: string };

    chezGaelle.socket.send(
      JSON.stringify({
        sorte: 'candidat',
        appelId: appel.id,
        charge: 'm1.nonce.chemin',
        coupleId: COUPLE_ID,
      }),
    );

    const recu = await chezRochambeau.attendre('candidat');
    expect(recu?.['charge']).toBe('m1.nonce.chemin');
    // L'émetteur ne se le renvoie pas à lui-même.
    expect(await chezGaelle.attendre('candidat', 400)).toBeUndefined();
  });

  it('refuse de relayer une charge en clair', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const chezGaelle = connecter(base, jetonPour(GAELLE));
    const chezRochambeau = connecter(base, jetonPour(ROCHAMBEAU));
    await Promise.all([chezGaelle.ouvert(), chezRochambeau.ouvert()]);

    const appel = (
      await s.app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/appels`,
        headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
        payload: { sorte: 'audio' },
      })
    ).json().appel as { id: string };

    chezGaelle.socket.send(
      JSON.stringify({
        sorte: 'candidat',
        appelId: appel.id,
        charge: 'v=0 candidate:1 1 UDP 2130706431 192.168.1.10 54321 typ host',
        coupleId: COUPLE_ID,
      }),
    );

    expect(await chezRochambeau.attendre('candidat', 800)).toBeUndefined();
  });
});

describe('fin d’appel', () => {
  it('prévient l’autre', async () => {
    const s = await monterServeur();
    const base = await ecouter(s);

    const chezRochambeau = connecter(base, jetonPour(ROCHAMBEAU));
    await chezRochambeau.ouvert();

    const appel = (
      await s.app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/appels`,
        headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
        payload: { sorte: 'audio' },
      })
    ).json().appel as { id: string };

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels/${appel.id}/fin`,
      headers: { authorization: `Bearer ${jetonPour(GAELLE)}` },
      payload: { raison: 'annule' },
    });

    const recu = await chezRochambeau.attendre('fin');
    expect(recu).toBeDefined();
    expect((recu!['appel'] as { raison: string }).raison).toBe('annule');
  });
});
