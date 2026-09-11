/**
 * Le canal de signalisation, pour de vrai.
 *
 * Les autres tests injectent des requêtes ; celui-ci ouvre un vrai serveur sur
 * un port, y branche deux vrais WebSockets, et vérifie qu'un appel lancé d'un
 * côté fait bien sonner l'autre.
 *
 * C'est le seul moyen de trancher : les appels n'aboutissaient pas, et rien
 * dans les tests d'injection ne pouvait le montrer — ils ne touchent jamais au
 * socket.
 */
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  jetonPour,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const aFermer: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const fermer of aFermer.splice(0)) await fermer();
});

/** Monte le serveur et le met à l'écoute sur un port libre. */
async function servirEnReseau(): Promise<{ s: Serveur; base: string }> {
  const s = await monterServeur();
  await s.app.listen({ port: 0, host: '127.0.0.1' });
  const adresse = s.app.server.address();
  if (!adresse || typeof adresse === 'string') throw new Error('port introuvable');

  aFermer.push(async () => {
    await s.app.close();
  });
  return { s, base: `ws://127.0.0.1:${adresse.port}` };
}

/** Ouvre un socket authentifié et collecte ce qu'il reçoit. */
async function brancher(base: string, qui: string) {
  const socket = new WebSocket(
    `${base}/appels/signal?jeton=${encodeURIComponent(jetonPour(qui))}`,
  );
  const recus: Record<string, unknown>[] = [];
  socket.on('message', (brut) => {
    recus.push(JSON.parse(brut.toString()) as Record<string, unknown>);
  });

  await new Promise<void>((resoudre, rejeter) => {
    socket.once('open', resoudre);
    socket.once('error', rejeter);
    socket.once('close', (code) => rejeter(new Error(`fermé : ${code}`)));
  });

  aFermer.push(async () => socket.close());
  return { socket, recus };
}

/** Attend qu'un message d'une sorte donnée arrive, ou abandonne. */
async function attendre(
  recus: Record<string, unknown>[],
  sorte: string,
  delai = 3000,
): Promise<Record<string, unknown>> {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const trouve = recus.find((m) => m['sorte'] === sorte);
    if (trouve) return trouve;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(
    `« ${sorte} » n'est jamais arrivé. Reçus : ${JSON.stringify(recus)}`,
  );
}

describe('le canal, de bout en bout', () => {
  it('accepte un socket authentifié', async () => {
    const { base } = await servirEnReseau();
    const { socket } = await brancher(base, GAELLE);
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });

  it('refuse un socket sans jeton', async () => {
    const { base } = await servirEnReseau();
    const socket = new WebSocket(`${base}/appels/signal`);

    const code = await new Promise<number>((resoudre) => {
      socket.once('close', resoudre);
      socket.once('error', () => undefined);
    });
    expect(code).toBe(4401);
  });

  it('fait sonner l’autre quand un appel part', async () => {
    // Le cas qui compte : c'est exactement ce qui ne marchait pas.
    const { s, base } = await servirEnReseau();
    const gaelle = await brancher(base, GAELLE);
    await brancher(base, ROCHAMBEAU);

    const lance = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: entete(ROCHAMBEAU),
      payload: { sorte: 'audio' },
    });
    expect(lance.statusCode).toBe(201);

    const sonnerie = await attendre(gaelle.recus, 'sonne');
    expect((sonnerie['appel'] as { appelantId: string }).appelantId).toBe(
      ROCHAMBEAU,
    );
  });

  it('ne fait pas sonner celui qui appelle', async () => {
    const { s, base } = await servirEnReseau();
    const rochambeau = await brancher(base, ROCHAMBEAU);
    await brancher(base, GAELLE);

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: entete(ROCHAMBEAU),
      payload: { sorte: 'audio' },
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(rochambeau.recus.filter((m) => m['sorte'] === 'sonne')).toEqual([]);
  });

  it('prévient l’appelant du décrochage', async () => {
    const { s, base } = await servirEnReseau();
    const rochambeau = await brancher(base, ROCHAMBEAU);
    const gaelle = await brancher(base, GAELLE);

    const lance = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: entete(ROCHAMBEAU),
      payload: { sorte: 'audio' },
    });
    const appelId = lance.json().appel.id;
    await attendre(gaelle.recus, 'sonne');

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels/${appelId}/accepter`,
      headers: entete(GAELLE),
    });

    const decroche = await attendre(rochambeau.recus, 'decroche');
    expect((decroche['appel'] as { etat: string }).etat).toBe('en_cours');
  });

  it('relaie la négociation scellée, et rien d’autre', async () => {
    const { s, base } = await servirEnReseau();
    const rochambeau = await brancher(base, ROCHAMBEAU);
    const gaelle = await brancher(base, GAELLE);

    const lance = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: entete(ROCHAMBEAU),
      payload: { sorte: 'audio' },
    });
    const appelId = lance.json().appel.id;
    await attendre(gaelle.recus, 'sonne');

    // Une charge en clair ne doit pas traverser.
    rochambeau.socket.send(
      JSON.stringify({
        sorte: 'candidat',
        appelId,
        charge: 'candidat:en-clair',
        coupleId: COUPLE_ID,
      }),
    );
    await new Promise((r) => setTimeout(r, 250));
    expect(gaelle.recus.filter((m) => m['sorte'] === 'candidat')).toEqual([]);

    // Une enveloppe scellée, oui.
    rochambeau.socket.send(
      JSON.stringify({
        sorte: 'candidat',
        appelId,
        charge: 'm1.nonce.candidat',
        coupleId: COUPLE_ID,
      }),
    );
    const relaye = await attendre(gaelle.recus, 'candidat');
    expect(relaye['charge']).toBe('m1.nonce.candidat');
    expect(relaye['de']).toBe(ROCHAMBEAU);
  });

  it('supporte le battement sans rien casser', async () => {
    const { base } = await servirEnReseau();
    const gaelle = await brancher(base, GAELLE);

    gaelle.socket.send(JSON.stringify({ sorte: 'battement' }));
    await new Promise((r) => setTimeout(r, 200));
    expect(gaelle.socket.readyState).toBe(WebSocket.OPEN);
  });

  it('remplace une connexion par la suivante', async () => {
    // Deux onglets, ou une reconnexion après coupure : c'est la plus récente
    // qui doit recevoir, sinon les appels partent dans un socket fantôme.
    const { s, base } = await servirEnReseau();
    const ancienne = await brancher(base, GAELLE);
    const nouvelle = await brancher(base, GAELLE);
    await brancher(base, ROCHAMBEAU);

    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/appels`,
      headers: entete(ROCHAMBEAU),
      payload: { sorte: 'audio' },
    });

    await attendre(nouvelle.recus, 'sonne');
    expect(ancienne.recus.filter((m) => m['sorte'] === 'sonne')).toEqual([]);
  });
});
