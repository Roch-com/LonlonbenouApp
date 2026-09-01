/**
 * Parcours guidé, côté serveur (§8.7).
 *
 * L’essentiel de ces cas porte sur ce qui **franchit la frontière réseau** :
 * la règle du miroir ne vaut que si la réponse de l’autre n’est pas dans la
 * charge utile. Un test qui n’interroge que le modèle ne le prouverait pas.
 */
import { describe, expect, it } from 'vitest';
import { PARCOURS } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

const PARCOURS_ID = 'communication-1';
const parcours = PARCOURS.find((p) => p.id === PARCOURS_ID)!;
const S1 = parcours.seances[0]!.id;
const S2 = parcours.seances[1]!.id;

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const engager = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/parcours/${PARCOURS_ID}/engager`,
    headers: entete(qui),
  });

const repondre = (s: Serveur, qui: string, seanceId: string, texte: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/parcours/${PARCOURS_ID}/seances/${seanceId}`,
    headers: entete(qui),
    payload: { texteScelle: texte },
  });

const echanger = (s: Serveur, qui: string, seanceId: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/parcours/${PARCOURS_ID}/seances/${seanceId}/echange`,
    headers: entete(qui),
  });

const lire = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/parcours/${PARCOURS_ID}`,
    headers: entete(qui),
  });

const lister = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/parcours`,
    headers: entete(qui),
  });

describe('accès', () => {
  it('refuse un tiers', async () => {
    const s = await monterServeur();
    expect((await lister(s, INTRUS)).statusCode).toBe(403);
    expect((await engager(s, INTRUS)).statusCode).toBe(403);
  });

  it('refuse un parcours qui n’existe pas', async () => {
    const s = await monterServeur();
    const r = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/parcours/inexistant/engager`,
      headers: entete(GAELLE),
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().motif).toBe('parcours_inconnu');
  });

  it('refuse de répondre à un parcours non engagé', async () => {
    const s = await monterServeur();
    const r = await repondre(s, GAELLE, S1, 'm1.a.a');
    expect(r.statusCode).toBe(409);
    expect(r.json().motif).toBe('parcours_non_engage');
  });
});

describe('engagement', () => {
  it('engage le parcours pour les deux, pas pour un seul', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);

    // Rochambeau n'a rien fait, et pourtant le parcours est ouvert pour lui.
    expect((await lire(s, ROCHAMBEAU)).json().engage).toBe(true);
  });

  it('supporte que les deux engagent en même temps', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    const second = await engager(s, ROCHAMBEAU);

    expect(second.statusCode).toBe(200);
    expect(second.json().seancesFaites).toBe(0);
  });
});

describe('la règle du miroir, à la frontière réseau', () => {
  it('ne laisse pas sortir la réponse de l’autre avant la mienne', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.secret.degaelle');

    const vue = await lire(s, ROCHAMBEAU);
    expect(vue.json().courante.etat).toBe('lui_seul');
    // Le test qui compte : le texte n'est nulle part dans la charge utile.
    expect(vue.body).not.toContain('secret.degaelle');
  });

  it('ouvre les deux réponses une fois les deux écrites', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');
    const apres = await repondre(s, ROCHAMBEAU, S1, 'm1.b.b');

    expect(apres.json().courante.etat).toBe('a_echanger');
    expect(apres.json().courante.sienne.texteScelle).toBe('m1.a.a');
  });

  it('refuse un texte en clair', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);

    const r = await repondre(s, GAELLE, S1, 'en clair');
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('texte_non_scelle');
  });

  it('ne répond que pour soi, quoi qu’on envoie', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/parcours/${PARCOURS_ID}/seances/${S1}`,
      headers: entete(GAELLE),
      // Une tentative de répondre à la place de l'autre : l'identité vient
      // du jeton, le corps n'est pas consulté là-dessus.
      payload: { texteScelle: 'm1.a.a', partenaireId: ROCHAMBEAU },
    });

    expect((await lire(s, ROCHAMBEAU)).json().courante.etat).toBe('lui_seul');
  });
});

describe('progression', () => {
  it('n’avance pas tant que l’échange n’est pas marqué', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');
    await repondre(s, ROCHAMBEAU, S1, 'm1.b.b');

    expect((await lire(s, GAELLE)).json().seancesFaites).toBe(0);
  });

  it('avance des deux côtés une fois l’échange marqué', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');
    await repondre(s, ROCHAMBEAU, S1, 'm1.b.b');
    await echanger(s, GAELLE, S1);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const vue = (await lire(s, qui)).json();
      expect(vue.seancesFaites).toBe(1);
      expect(vue.courante.seance.id).toBe(S2);
    }
  });

  it('refuse un échange que l’un n’a pas préparé', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');

    const r = await echanger(s, GAELLE, S1);
    expect(r.statusCode).toBe(409);
    expect(r.json().motif).toBe('reponses_incompletes');
  });

  it('refuse de sauter une séance', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);

    const r = await repondre(s, GAELLE, S2, 'm1.a.a');
    expect(r.statusCode).toBe(409);
    expect(r.json().motif).toBe('pas_la_seance_courante');
  });

  it('refuse de réécrire une réponse déjà donnée', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');

    const r = await repondre(s, GAELLE, S1, 'm1.corrigee.corrigee');
    expect(r.statusCode).toBe(409);
    expect(r.json().motif).toBe('deja_repondu');
  });

  it('garde l’avancement d’une séance à l’autre', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    for (const seanceId of [S1, S2]) {
      await repondre(s, GAELLE, seanceId, 'm1.a.a');
      await repondre(s, ROCHAMBEAU, seanceId, 'm1.b.b');
      await echanger(s, ROCHAMBEAU, seanceId);
    }

    const vue = (await lire(s, GAELLE)).json();
    expect(vue.seancesFaites).toBe(2);
    expect(vue.courante.rang).toBe(3);
  });
});

describe('recommandation', () => {
  it('se tait quand rien ne ressort', async () => {
    const s = await monterServeur();
    expect((await lister(s, GAELLE)).json().recommandation).toBeNull();
  });

  it('propose sur accumulation d’axes, comme le cahier le décrit', async () => {
    const s = await monterServeur();
    for (const n of [1, 2, 3]) {
      await s.depot.axes.enregistrer(COUPLE_ID, {
        id: `axe-${n}`,
        theme: 'communication',
        titre: `Axe ${n}`,
        ouvertPar: GAELLE,
        ouvertLe: '2026-09-01T10:00:00.000Z',
        contributions: [],
      });
    }

    const r = (await lister(s, GAELLE)).json();
    expect(r.recommandation.parcours.theme).toBe('communication');
    expect(r.recommandation.motif).toContain('3 axes');
  });

  it('ne compte pas les axes clos', async () => {
    const s = await monterServeur();
    for (const n of [1, 2, 3]) {
      await s.depot.axes.enregistrer(COUPLE_ID, {
        id: `axe-${n}`,
        theme: 'communication',
        titre: `Axe ${n}`,
        ouvertPar: GAELLE,
        ouvertLe: '2026-09-01T10:00:00.000Z',
        contributions: [],
        clotureLe: '2026-09-02T10:00:00.000Z',
      });
    }

    expect((await lister(s, GAELLE)).json().recommandation).toBeNull();
  });

  it('ne repropose pas un parcours déjà engagé', async () => {
    const s = await monterServeur();
    for (const n of [1, 2, 3]) {
      await s.depot.axes.enregistrer(COUPLE_ID, {
        id: `axe-${n}`,
        theme: 'communication',
        titre: `Axe ${n}`,
        ouvertPar: GAELLE,
        ouvertLe: '2026-09-01T10:00:00.000Z',
        contributions: [],
      });
    }
    await engager(s, GAELLE);

    expect((await lister(s, GAELLE)).json().recommandation).toBeNull();
  });
});

describe('dissociation', () => {
  it('emporte les parcours avec le reste', async () => {
    const s = await monterServeur();
    await engager(s, GAELLE);
    await repondre(s, GAELLE, S1, 'm1.a.a');

    await s.services.dissociation.dissocier(COUPLE_ID, GAELLE);

    expect(await s.depot.parcours.engages(COUPLE_ID)).toEqual([]);
  });
});
