/** Consentements réciproques côté serveur. */
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

const basculer = (app: App, qui: string, actif: boolean, module = 'croissance') =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/${module}`,
    headers: entete(qui),
    payload: { actif },
  });

const lister = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/partages`,
    headers: entete(qui),
  });

describe('opt-in symétrique', () => {
  it('reste inactif tant que les deux n’ont pas consenti', async () => {
    const { app } = await monterServeur({ croissanceActive: false });

    const seul = await basculer(app, ROCHAMBEAU, true);
    expect(seul.statusCode).toBe(200);
    expect(seul.json().partage).toMatchObject({
      actif: false,
      monConsentement: true,
      consentementDeLautre: false,
    });

    const lesDeux = await basculer(app, GAELLE, true);
    expect(lesDeux.json().partage.actif).toBe(true);
  });

  it('coupe pour les deux dès que l’un se retire', async () => {
    const { app } = await monterServeur();

    await basculer(app, ROCHAMBEAU, false);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const partages = (await lister(app, qui)).json().partages;
      const croissance = partages.find(
        (p: { module: string }) => p.module === 'croissance',
      );
      expect(croissance.actif).toBe(false);
    }
  });

  it('ouvre réellement l’accès aux axes une fois les deux d’accord', async () => {
    const { app } = await monterServeur({ croissanceActive: false });

    const avant = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
    });
    expect(avant.statusCode).toBe(403);

    await basculer(app, ROCHAMBEAU, true);
    await basculer(app, GAELLE, true);

    const apres = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
    });
    expect(apres.statusCode).toBe(200);
  });
});

describe('on ne bascule que son propre consentement', () => {
  it('n’expose que mon consentement en écriture, celui de l’autre en lecture', async () => {
    const { app } = await monterServeur({ croissanceActive: false });
    await basculer(app, GAELLE, true);

    const vuParRochambeau = (await lister(app, ROCHAMBEAU)).json().partages;
    const croissance = vuParRochambeau.find(
      (p: { module: string }) => p.module === 'croissance',
    );

    expect(croissance.monConsentement).toBe(false);
    expect(croissance.consentementDeLautre).toBe(true);
  });
});

describe('annonce aux deux', () => {
  it('prévient les deux partenaires à chaque changement', async () => {
    const { app, depot } = await monterServeur({ croissanceActive: false });
    await basculer(app, ROCHAMBEAU, true);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const journal = await depot.notifications.journal(qui);
      expect(journal).toHaveLength(1);
      expect(journal[0]?.categorie).toBe('partage');
    }
  });

  it('annonce aussi la mise en pause, sans reproche', async () => {
    const { app, depot } = await monterServeur();
    await basculer(app, GAELLE, false);

    const versRochambeau = await depot.notifications.journal(ROCHAMBEAU);
    expect(versRochambeau[0]?.texte).toContain('pause');
    expect(versRochambeau[0]?.texte.toLowerCase()).not.toContain('refuse');
  });
});

describe('contrôles d’accès', () => {
  it('refuse un non-membre', async () => {
    const { app } = await monterServeur();
    expect((await basculer(app, INTRUS, true)).statusCode).toBe(403);
    expect((await lister(app, INTRUS)).statusCode).toBe(403);
  });

  it('refuse un module inconnu', async () => {
    const { app } = await monterServeur();
    expect((await basculer(app, ROCHAMBEAU, true, 'inconnu')).statusCode).toBe(404);
  });

  it('refuse un corps sans booléen', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/partages/croissance`,
      headers: entete(ROCHAMBEAU),
      payload: {},
    });
    expect(reponse.statusCode).toBe(400);
  });

  it('refuse après dissociation', async () => {
    const { app } = await monterServeur();
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(ROCHAMBEAU),
    });

    expect((await basculer(app, ROCHAMBEAU, true)).statusCode).toBe(410);
  });
});
