/** Pôle ① — on ne voit l'activité de l'autre qu'en montrant la sienne. */
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

const signaler = (app: App, qui: string, ecrit = false) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/activite`,
    headers: entete(qui),
    payload: { ecrit },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/activite`,
    headers: entete(qui),
  });

const consentir = (app: App, qui: string, actif: boolean) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/activite`,
    headers: entete(qui),
    payload: { actif },
  });

describe('réciprocité du signal d’activité', () => {
  it('ne montre rien tant qu’un seul des deux a consenti', async () => {
    const { app } = await monterServeur();
    await signaler(app, GAELLE);
    await consentir(app, ROCHAMBEAU, true);

    // Rochambeau a activé de son côté ; Gaëlle non. Il ne doit rien voir —
    // sinon il observerait sans être observé.
    const vu = lire(app, ROCHAMBEAU);
    expect((await vu).json().autre).toBeUndefined();
  });

  it('montre des deux côtés dès que les deux ont consenti', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);
    await signaler(app, GAELLE);
    await signaler(app, ROCHAMBEAU);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const vue = (await lire(app, qui)).json();
      expect(vue.moi.partage).toBe(true);
      expect(vue.autre.enLigne).toBe(true);
    }
  });

  it('coupe des deux côtés dès que l’un se retire', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);
    await signaler(app, GAELLE);
    await signaler(app, ROCHAMBEAU);

    await consentir(app, GAELLE, false);

    // Celle qui se retire cesse de voir, exactement comme celui qui subit le
    // retrait : se couper ne doit pas devenir un poste d'observation.
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect((await lire(app, qui)).json().autre).toBeUndefined();
    }
  });

  it('transmet « écrit » puis l’oublie', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);

    await signaler(app, GAELLE, true);
    expect((await lire(app, ROCHAMBEAU)).json().autre.ecrit).toBe(true);

    // Un battement sans frappe efface la fenêtre : « écrit… » ne doit pas
    // rester affiché parce que quelqu'un a renoncé à son message.
    await signaler(app, GAELLE, false);
    expect((await lire(app, ROCHAMBEAU)).json().autre.ecrit).toBe(false);
  });

  it('ne dit jamais rien de soi-même à l’autre en plus', async () => {
    const { app } = await monterServeur();
    await consentir(app, ROCHAMBEAU, true);
    await consentir(app, GAELLE, true);
    await signaler(app, GAELLE);

    const corps = (await lire(app, ROCHAMBEAU)).body;
    // Aucun identifiant de partenaire ne sort : la projection ne porte que
    // l'état, jamais la ligne brute.
    expect(corps).not.toContain(GAELLE);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect((await signaler(app, INTRUS)).statusCode).toBe(403);
  });
});
