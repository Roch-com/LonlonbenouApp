/** Pôle ② — confidences : le brouillon ne monte jamais, l'envoi est définitif. */
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

const envoyer = (app: App, qui: string, corps: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/confidences`,
    headers: entete(qui),
    payload: corps,
  });

const lister = (app: App, qui: string, type?: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/confidences${type ? `?type=${type}` : ''}`,
    headers: entete(qui),
  });

describe('aucun brouillon ne parvient au serveur', () => {
  it('ignore une visibilité « privée » réclamée par le client', async () => {
    const { app, depot } = await monterServeur();

    const reponse = await envoyer(app, GAELLE, {
      type: 'lettre',
      titre: 'Un mot',
      texte: 'Ce que je voulais te dire',
      // Un client malveillant — ou simplement bogué — tenterait ceci.
      visibilite: 'prive',
      envoyeeLe: undefined,
    });

    expect(reponse.statusCode).toBe(201);
    // Le serveur pose lui-même la visibilité et l'horodatage.
    expect(reponse.json().confidence.visibilite).toBe('couple');
    expect(reponse.json().confidence.envoyeeLe).toBeTruthy();

    const stockees = await depot.confidences.parCouple(COUPLE_ID);
    expect(stockees.every((c) => c.visibilite === 'couple')).toBe(true);
    expect(stockees.every((c) => !!c.envoyeeLe)).toBe(true);
  });

  it('n’offre aucune route capable de créer ou modifier un brouillon', async () => {
    const { app } = await monterServeur();
    const envoyee = (
      await envoyer(app, GAELLE, { type: 'lettre', texte: 'Un texte offert' })
    ).json().confidence;

    // Ni brouillon, ni retrait, ni réécriture : la surface n'existe pas.
    for (const [methode, url] of [
      ['POST', `/couples/${COUPLE_ID}/confidences/brouillons`],
      ['DELETE', `/couples/${COUPLE_ID}/confidences/${envoyee.id}`],
      ['PUT', `/couples/${COUPLE_ID}/confidences/${envoyee.id}`],
    ] as const) {
      const reponse = await app.inject({
        method: methode,
        url,
        headers: entete(GAELLE),
        payload: { texte: 'modifié' },
      });
      expect(reponse.statusCode).toBe(404);
    }
  });

  it('refuse un texte vide, qui serait un brouillon déguisé', async () => {
    const { app } = await monterServeur();
    const reponse = await envoyer(app, GAELLE, { type: 'lettre', texte: '   ' });
    expect(reponse.statusCode).toBe(400);
  });
});

describe('l’envoi est irréversible et partagé', () => {
  it('rend le texte lisible des deux côtés, à l’identique', async () => {
    const { app } = await monterServeur();
    const TEXTE = 'Merci d’avoir pris le relais hier';
    await envoyer(app, GAELLE, { type: 'gratitude', texte: TEXTE });

    const vuParElle = await lister(app, GAELLE);
    const vuParLui = await lister(app, ROCHAMBEAU);

    expect(vuParLui.body).toContain(TEXTE);
    expect(vuParElle.json().confidences).toEqual(vuParLui.json().confidences);
  });

  it('filtre par type quand on le demande', async () => {
    const { app } = await monterServeur();
    await envoyer(app, GAELLE, { type: 'gratitude', texte: 'Merci' });
    await envoyer(app, ROCHAMBEAU, { type: 'lettre', texte: 'Une lettre' });

    expect((await lister(app, GAELLE, 'lettre')).json().confidences).toHaveLength(
      1,
    );
    expect(
      (await lister(app, GAELLE, 'gratitude')).json().confidences,
    ).toHaveLength(1);
    expect((await lister(app, GAELLE)).json().confidences).toHaveLength(2);
  });
});

describe('accusé de lecture', () => {
  it('n’est posé que par le destinataire', async () => {
    const { app } = await monterServeur();
    const envoyee = (
      await envoyer(app, GAELLE, { type: 'lettre', texte: 'Pour toi' })
    ).json().confidence;

    const parLauteur = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/confidences/${envoyee.id}/lecture`,
      headers: entete(GAELLE),
    });
    expect(parLauteur.statusCode).toBe(403);
    expect(parLauteur.json().motif).toBe('pas_le_destinataire');

    const parLui = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/confidences/${envoyee.id}/lecture`,
      headers: entete(ROCHAMBEAU),
    });
    expect(parLui.statusCode).toBe(200);
    expect(parLui.json().confidence.luLe).toBeTruthy();
  });

  it('ne se remet pas à jour à chaque relecture', async () => {
    const { app } = await monterServeur();
    const envoyee = (
      await envoyer(app, GAELLE, { type: 'lettre', texte: 'Pour toi' })
    ).json().confidence;

    const chemin = `/couples/${COUPLE_ID}/confidences/${envoyee.id}/lecture`;
    const premiere = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(ROCHAMBEAU),
    });
    const seconde = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(ROCHAMBEAU),
    });

    expect(seconde.json().confidence.luLe).toBe(premiere.json().confidence.luLe);
  });

  it('refuse une confidence inconnue', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/confidences/inconnue/lecture`,
      headers: entete(ROCHAMBEAU),
    });
    expect(reponse.statusCode).toBe(404);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple, en lecture comme en écriture', async () => {
    const { app } = await monterServeur();
    expect((await lister(app, INTRUS)).statusCode).toBe(403);
    expect(
      (await envoyer(app, INTRUS, { type: 'gratitude', texte: 'Bonjour' }))
        .statusCode,
    ).toBe(403);
  });

  it('refuse sans jeton', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/confidences`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ferme tout après dissociation, et efface les confidences', async () => {
    const { app, depot } = await monterServeur();
    await envoyer(app, GAELLE, { type: 'gratitude', texte: 'Merci' });

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(ROCHAMBEAU),
    });

    expect((await lister(app, GAELLE)).statusCode).toBe(410);
    expect((await lister(app, ROCHAMBEAU)).statusCode).toBe(410);
    expect(await depot.confidences.parCouple(COUPLE_ID)).toHaveLength(0);
  });
});
