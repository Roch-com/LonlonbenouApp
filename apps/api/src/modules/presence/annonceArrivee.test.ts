/**
 * Pôle ① — annonce d'arrivée (§8.2 : « Gaëlle vient de rentrer »).
 *
 * Le risque propre à cette fonctionnalité : réintroduire l'observation à sens
 * unique par la porte des notifications. Sans partage actif des deux côtés,
 * rien ne doit partir.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

const poserStatut = (
  app: App,
  qui: string,
  code: string,
  annoncer?: boolean,
) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/presence/statut`,
    headers: entete(qui),
    payload: { code, annoncer },
  });

const consentir = (app: App, qui: string, actif: boolean) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/position`,
    headers: entete(qui),
    payload: { actif },
  });

const activerLesDeux = async (app: App) => {
  await consentir(app, ROCHAMBEAU, true);
  await consentir(app, GAELLE, true);
};

/** Les annonces d'arrivée, hors notifications de partage. */
const annonces = async (
  depot: Awaited<ReturnType<typeof monterServeur>>['depot'],
  qui: string,
) => (await depot.notifications.journal(qui)).filter((n) => n.categorie === 'presence');

describe('annonce d’arrivée', () => {
  it('ne part pas sans partage actif des deux côtés', async () => {
    const { app, depot } = await monterServeur();
    await consentir(app, GAELLE, true);

    // Gaëlle a activé, Rochambeau non : son arrivée ne doit rien déclencher,
    // sinon elle serait observée sans l'observer en retour.
    await poserStatut(app, GAELLE, 'maison', true);
    expect(await annonces(depot, ROCHAMBEAU)).toHaveLength(0);
  });

  it('part une fois les deux consentements donnés', async () => {
    const { app, depot } = await monterServeur();
    await activerLesDeux(app);

    await poserStatut(app, GAELLE, 'maison', true);

    const recues = await annonces(depot, ROCHAMBEAU);
    expect(recues).toHaveLength(1);
    expect(recues[0]!.texte).toBe('Gaëlle est à la maison.');
  });

  it('ne dit rien du lieu favori, seulement du statut', async () => {
    // Le nom du lieu ne quitte jamais le téléphone : le texte est composé par
    // le serveur, à partir de son propre vocabulaire.
    const { app, depot } = await monterServeur();
    await activerLesDeux(app);
    await poserStatut(app, GAELLE, 'bureau', true);

    const [recue] = await annonces(depot, ROCHAMBEAU);
    expect(recue!.texte).toBe('Gaëlle est au bureau.');
  });

  it('ne s’annonce pas quand on pose un statut à la main', async () => {
    // Annoncer chaque changement transformerait la présence en flux de
    // notifications, et le statut en obligation de se justifier.
    const { app, depot } = await monterServeur();
    await activerLesDeux(app);

    await poserStatut(app, GAELLE, 'occupe');
    expect(await annonces(depot, ROCHAMBEAU)).toHaveLength(0);
  });

  it('n’envoie rien à soi-même', async () => {
    const { app, depot } = await monterServeur();
    await activerLesDeux(app);
    await poserStatut(app, GAELLE, 'maison', true);

    expect(await annonces(depot, GAELLE)).toHaveLength(0);
  });
});
