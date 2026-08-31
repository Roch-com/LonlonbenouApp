/**
 * Pôle ② — la règle du miroir, rejouée par le serveur.
 *
 * Le risque : que la réponse de l'autre franchisse la frontière avant que les
 * deux aient répondu. Une réponse lue d'avance n'est plus une réponse.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

const JOUR = '2026-09-14';
const SCELLE_ELLE = 'm1.abcdefghijklmnopqrstuvwx.reponse-de-gaelle';
const SCELLE_LUI = 'm1.zyxwvutsrqponmlkjihgfed.reponse-de-rochambeau';

const repondre = (app: App, qui: string, texteScelle: string) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/complicite`,
    headers: entete(qui),
    payload: { jour: JOUR, texteScelle },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/complicite?jour=${JOUR}`,
    headers: entete(qui),
  });

describe('miroir', () => {
  it('ne laisse pas passer la réponse de l’autre avant la sienne', async () => {
    const { app } = await monterServeur();
    await repondre(app, GAELLE, SCELLE_ELLE);

    const vu = await lire(app, ROCHAMBEAU);
    expect(vu.json().etat).toBe('lui_seul');
    expect(vu.json().sienne).toBeUndefined();
    // La preuve la plus solide : l'enveloppe n'est pas dans le corps HTTP.
    expect(vu.body).not.toContain(SCELLE_ELLE);
  });

  it('ouvre les deux dès la seconde réponse', async () => {
    const { app } = await monterServeur();
    await repondre(app, GAELLE, SCELLE_ELLE);
    const apres = await repondre(app, ROCHAMBEAU, SCELLE_LUI);

    expect(apres.json().etat).toBe('les_deux');
    expect(apres.json().sienne.texteScelle).toBe(SCELLE_ELLE);
    expect((await lire(app, GAELLE)).json().sienne.texteScelle).toBe(SCELLE_LUI);
  });

  it('rend toujours la sienne, même seule', async () => {
    const { app } = await monterServeur();
    const reponse = await repondre(app, GAELLE, SCELLE_ELLE);
    expect(reponse.json().etat).toBe('moi_seul');
    expect(reponse.json().mienne.texteScelle).toBe(SCELLE_ELLE);
  });

  it('donne la même question aux deux', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, GAELLE)).json().question).toEqual(
      (await lire(app, ROCHAMBEAU)).json().question,
    );
  });

  it('remplace au lieu d’empiler quand on répond à nouveau', async () => {
    const { app } = await monterServeur();
    await repondre(app, GAELLE, SCELLE_ELLE);
    const seconde = await repondre(app, GAELLE, SCELLE_LUI);
    expect(seconde.json().mienne.texteScelle).toBe(SCELLE_LUI);
    expect(seconde.json().etat).toBe('moi_seul');
  });
});

describe('le clair n’entre jamais', () => {
  it('refuse une réponse non scellée', async () => {
    const { app } = await monterServeur();
    const reponse = await repondre(app, GAELLE, 'Ce que je ressens');
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('texte_non_scelle');
  });

  it('refuse un jour mal formé', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/complicite`,
      headers: entete(GAELLE),
      payload: { jour: '14/09/2026', texteScelle: SCELLE_ELLE },
    });
    expect(reponse.statusCode).toBe(400);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect((await repondre(app, INTRUS, SCELLE_ELLE)).statusCode).toBe(403);
  });

  it('ferme tout après dissociation', async () => {
    const { app } = await monterServeur();
    await repondre(app, GAELLE, SCELLE_ELLE);
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });
    expect((await lire(app, GAELLE)).statusCode).toBe(410);
  });
});
