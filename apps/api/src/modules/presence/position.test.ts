/**
 * Pôle ① — position partagée (§8.2).
 *
 * Deux propriétés, et rien d'autre ne compte autant : le serveur ne voit
 * jamais de coordonnées, et l'enveloppe de l'autre ne franchit la frontière
 * que si les deux ont consenti.
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

const SCELLEE = 'm1.abcdefghijklmnopqrstuvwx.position-scellee';
const SCELLEE_AUTRE = 'm1.zyxwvutsrqponmlkjihgfed.autre-position';

const poser = (app: App, qui: string, positionScellee: string) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/presence/position`,
    headers: entete(qui),
    payload: { positionScellee },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/presence`,
    headers: entete(qui),
  });

const consentir = (app: App, qui: string, actif: boolean) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/position`,
    headers: entete(qui),
    payload: { actif },
  });

describe('réciprocité de la position', () => {
  it('ne rend pas celle de l’autre tant qu’un seul a consenti', async () => {
    const { app } = await monterServeur();
    await poser(app, GAELLE, SCELLEE);
    await consentir(app, ROCHAMBEAU, true);

    // Rochambeau a activé de son côté, Gaëlle non : il ne doit rien voir,
    // sinon il observerait sans être observé.
    const vue = (await lire(app, ROCHAMBEAU)).json();
    expect(vue.positionAutre).toBeUndefined();
    expect(vue.partageActif).toBe(false);
  });

  it('la rend des deux côtés dès que les deux ont consenti', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);
    await poser(app, GAELLE, SCELLEE);
    await poser(app, ROCHAMBEAU, SCELLEE_AUTRE);

    expect((await lire(app, ROCHAMBEAU)).json().positionAutre.positionScellee).toBe(
      SCELLEE,
    );
    expect((await lire(app, GAELLE)).json().positionAutre.positionScellee).toBe(
      SCELLEE_AUTRE,
    );
  });

  it('coupe des deux côtés dès que l’un se retire', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);
    await poser(app, GAELLE, SCELLEE);
    await poser(app, ROCHAMBEAU, SCELLEE_AUTRE);

    await consentir(app, GAELLE, false);

    // Se couper ne doit pas devenir un poste d'observation.
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect((await lire(app, qui)).json().positionAutre).toBeUndefined();
    }
  });

  it('rend toujours la sienne, partage ou non', async () => {
    // Savoir ce que l'autre peut voir de soi est le minimum pour décider.
    const { app } = await monterServeur();
    await poser(app, GAELLE, SCELLEE);
    expect((await lire(app, GAELLE)).json().maPosition.positionScellee).toBe(SCELLEE);
  });
});

describe('le clair n’entre jamais', () => {
  it('refuse des coordonnées non scellées', async () => {
    const { app } = await monterServeur();
    const reponse = await poser(app, GAELLE, '6.1319,1.2228');

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('position_non_scellee');
  });

  it('ne garde qu’une ligne par personne', async () => {
    // Un historique de positions dirait les horaires de travail et les
    // détours du soir. On écrase plutôt que d'empiler.
    const { app, depot } = await monterServeur();
    await poser(app, GAELLE, SCELLEE);
    await poser(app, GAELLE, SCELLEE_AUTRE);

    const positions = await depot.presence.positions(COUPLE_ID);
    expect(positions).toHaveLength(1);
    expect(positions[0]!.positionScellee).toBe(SCELLEE_AUTRE);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await poser(app, INTRUS, SCELLEE)).statusCode).toBe(403);
  });
});
