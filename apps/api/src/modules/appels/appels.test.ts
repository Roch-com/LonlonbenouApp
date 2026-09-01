/**
 * Appels, côté serveur.
 *
 * Deux propriétés dominent : **seul celui qu'on appelle peut décrocher** — un
 * appelant qui accepterait son propre appel ouvrirait un micro à distance —
 * et **rien ne traverse en clair**, la négociation étant scellée pour que ce
 * serveur ne puisse pas s'intercaler dans l'appel.
 */
import { describe, expect, it } from 'vitest';
import { DUREE_SONNERIE_S } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const proposer = (s: Serveur, qui: string, sorte = 'audio') =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/appels`,
    headers: entete(qui),
    payload: { sorte },
  });

const accepter = (s: Serveur, qui: string, appelId: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/appels/${appelId}/accepter`,
    headers: entete(qui),
  });

const terminer = (s: Serveur, qui: string, appelId: string, raison?: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/appels/${appelId}/fin`,
    headers: entete(qui),
    payload: raison ? { raison } : {},
  });

const courant = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/appels/courant`,
    headers: entete(qui),
  });

describe('proposer', () => {
  it('crée un appel qui sonne', async () => {
    const s = await monterServeur();
    const r = await proposer(s, GAELLE);

    expect(r.statusCode).toBe(201);
    expect(r.json().appel.etat).toBe('sonne');
    expect(r.json().appel.appelantId).toBe(GAELLE);
  });

  it('distingue l’audio de la vidéo', async () => {
    const s = await monterServeur();
    expect((await proposer(s, GAELLE, 'video')).json().appel.sorte).toBe('video');
  });

  it('refuse une sorte inventée', async () => {
    const s = await monterServeur();
    expect((await proposer(s, GAELLE, 'holographique')).statusCode).toBe(400);
  });

  it('refuse un second appel : occupé', async () => {
    const s = await monterServeur();
    await proposer(s, GAELLE);

    const second = await proposer(s, ROCHAMBEAU);
    expect(second.statusCode).toBe(409);
    expect(second.json().motif).toBe('occupe');
  });

  it('refuse un tiers', async () => {
    const s = await monterServeur();
    expect((await proposer(s, INTRUS)).statusCode).toBe(403);
  });

  it('se voit des deux côtés', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      expect((await courant(s, qui)).json().appel.id).toBe(id);
    }
  });
});

describe('décrocher', () => {
  it('n’est possible que pour celui qu’on appelle', async () => {
    // Sinon un appelant ouvrirait un flux sans que l'autre ait rien fait,
    // c'est-à-dire un micro à distance.
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const refus = await accepter(s, GAELLE, id);
    expect(refus.statusCode).toBe(403);
    expect(refus.json().motif).toBe('pas_pour_moi');
  });

  it('passe l’appel en cours et date le décrochage', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const r = await accepter(s, ROCHAMBEAU, id);
    expect(r.statusCode).toBe(200);
    expect(r.json().appel.etat).toBe('en_cours');
    expect(r.json().appel.decrocheLe).toBeTruthy();
  });

  it('ne se décroche pas deux fois', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;
    await accepter(s, ROCHAMBEAU, id);

    expect((await accepter(s, ROCHAMBEAU, id)).statusCode).toBe(409);
  });

  it('refuse un appel qui n’existe pas', async () => {
    const s = await monterServeur();
    expect((await accepter(s, ROCHAMBEAU, 'fantome')).statusCode).toBe(404);
  });
});

describe('terminer', () => {
  it('est ouvert aux deux', async () => {
    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const s = await monterServeur();
      const id = (await proposer(s, GAELLE)).json().appel.id;
      expect((await terminer(s, qui, id)).statusCode).toBe(200);
    }
  });

  it('libère la ligne', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;
    await terminer(s, GAELLE, id, 'annule');

    expect((await courant(s, GAELLE)).json().appel).toBeNull();
    // Et un nouvel appel redevient possible.
    expect((await proposer(s, ROCHAMBEAU)).statusCode).toBe(201);
  });

  it('garde la raison', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const r = await terminer(s, ROCHAMBEAU, id, 'refuse');
    expect(r.json().appel.raison).toBe('refuse');
    expect(r.json().appel.etat).toBe('termine');
  });
});

describe('la sonnerie qui s’éternise', () => {
  it('n’est plus le courant une fois le délai passé', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    // On vieillit l'appel plutôt que d'attendre quarante-cinq secondes.
    const en = s.services.appels as unknown as {
      balayerLesSonneries: (q?: string) => { appel: { id: string } }[];
    };
    const futur = new Date(Date.now() + (DUREE_SONNERIE_S + 1) * 1000).toISOString();
    const finis = en.balayerLesSonneries(futur);

    expect(finis.map((f) => f.appel.id)).toContain(id);
    expect((await courant(s, GAELLE)).json().appel).toBeNull();
  });
});

describe('relais de la négociation', () => {
  it('refuse une charge en clair', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const relais = await s.services.appels.autoriserRelais(
      COUPLE_ID,
      GAELLE,
      id,
      'v=0\r\no=- 123 IN IP4 0.0.0.0',
    );
    expect(relais.ok).toBe(false);
    expect(relais.motif).toBe('charge_non_scellee');
  });

  it('accepte une enveloppe scellée et nomme le destinataire', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const relais = await s.services.appels.autoriserRelais(
      COUPLE_ID,
      GAELLE,
      id,
      'm1.nonce.offre',
    );
    expect(relais.ok).toBe(true);
    expect(relais.destinataireId).toBe(ROCHAMBEAU);
  });

  it('refuse de relayer pour un appel terminé', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;
    await terminer(s, GAELLE, id, 'annule');

    const relais = await s.services.appels.autoriserRelais(
      COUPLE_ID,
      GAELLE,
      id,
      'm1.nonce.offre',
    );
    expect(relais.ok).toBe(false);
  });

  it('refuse un tiers', async () => {
    const s = await monterServeur();
    const id = (await proposer(s, GAELLE)).json().appel.id;

    const relais = await s.services.appels.autoriserRelais(
      COUPLE_ID,
      INTRUS,
      id,
      'm1.nonce.offre',
    );
    expect(relais.ok).toBe(false);
    expect(relais.motif).toBe('non_membre');
  });
});

describe('le destinataire est résolu, jamais deviné', () => {
  it('rend l’autre membre du couple', async () => {
    const s = await monterServeur();
    expect(await s.services.appels.partenaireOppose(COUPLE_ID, GAELLE)).toBe(
      ROCHAMBEAU,
    );
    expect(await s.services.appels.partenaireOppose(COUPLE_ID, ROCHAMBEAU)).toBe(
      GAELLE,
    );
  });

  it('ne rend personne pour un couple inconnu ou dissocié', async () => {
    const s = await monterServeur();
    expect(await s.services.appels.partenaireOppose('ailleurs', GAELLE)).toBeUndefined();

    await s.services.dissociation.dissocier(COUPLE_ID, GAELLE);
    expect(
      await s.services.appels.partenaireOppose(COUPLE_ID, GAELLE),
    ).toBeUndefined();
  });
});
