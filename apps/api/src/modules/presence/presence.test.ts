/** Pôle ① — le serveur rejoue la réciprocité stricte du partage de position. */
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

const activerPosition = async (app: App, qui: string, actif: boolean) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/position`,
    headers: entete(qui),
    payload: { actif },
  });

const definirStatut = (app: App, qui: string, code: string, noteScellee?: string) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/presence/statut`,
    headers: entete(qui),
    payload: { code, noteScellee },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/presence`,
    headers: entete(qui),
  });

/** Couple où les deux ont déclaré un statut, partage encore inactif. */
async function monterPresence() {
  const serveur = await monterServeur();
  await definirStatut(serveur.app, GAELLE, 'occupe', 'note-scellee-de-elle');
  await definirStatut(serveur.app, ROCHAMBEAU, 'disponible');
  return serveur;
}

describe('réciprocité stricte', () => {
  it('ne sert pas le statut de l’autre tant que les deux n’ont pas consenti', async () => {
    const { app } = await monterPresence();

    const sansRien = await lire(app, ROCHAMBEAU);
    expect(sansRien.json().partageActif).toBe(false);
    expect(sansRien.json().autre).toBeUndefined();
    // Ni le code, ni la note scellée ne franchissent la frontière.
    expect(sansRien.body).not.toContain('note-scellee-de-elle');

    await activerPosition(app, ROCHAMBEAU, true);
    const aMoitie = await lire(app, ROCHAMBEAU);
    expect(aMoitie.json().partageActif).toBe(false);
    expect(aMoitie.json().autre).toBeUndefined();

    await activerPosition(app, GAELLE, true);
    const ouvert = await lire(app, ROCHAMBEAU);
    expect(ouvert.json().partageActif).toBe(true);
    expect(ouvert.json().autre.code).toBe('occupe');
  });

  it('coupe des deux côtés dès que l’un se retire', async () => {
    const { app } = await monterPresence();
    await activerPosition(app, GAELLE, true);
    await activerPosition(app, ROCHAMBEAU, true);

    await activerPosition(app, GAELLE, false);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const vue = await lire(app, qui);
      expect(vue.json().partageActif).toBe(false);
      expect(vue.json().autre).toBeUndefined();
    }
  });

  it('laisse toujours voir son propre statut, partage actif ou non', async () => {
    const { app } = await monterPresence();

    const vue = await lire(app, GAELLE);
    expect(vue.json().partageActif).toBe(false);
    expect(vue.json().mien.code).toBe('occupe');
    // Sa propre note lui revient : la cacher à son auteur n'aurait aucun sens.
    expect(vue.body).toContain('note-scellee-de-elle');
  });

  it('applique la même règle aux check-ins', async () => {
    const { app } = await monterPresence();
    for (const [qui, lieu] of [
      [GAELLE, 'lieu-scelle-elle'],
      [ROCHAMBEAU, 'lieu-scelle-lui'],
    ] as const) {
      await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/presence/check-ins`,
        headers: entete(qui),
        payload: { lieuScelle: lieu },
      });
    }

    const ferme = await lire(app, ROCHAMBEAU);
    expect(ferme.json().checkIns).toHaveLength(1);
    expect(ferme.body).not.toContain('lieu-scelle-elle');

    await activerPosition(app, GAELLE, true);
    await activerPosition(app, ROCHAMBEAU, true);
    expect((await lire(app, ROCHAMBEAU)).json().checkIns).toHaveLength(2);
  });

  it('refuse un code de statut inventé', async () => {
    const { app } = await monterServeur();
    expect((await definirStatut(app, GAELLE, 'invente')).statusCode).toBe(400);
  });
});

describe('le SOS ne dépend d’aucun consentement', () => {
  it('parvient à l’autre même partage de position inactif', async () => {
    const { app } = await monterPresence();

    const alerte = await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/presence/sos`,
      headers: entete(GAELLE),
      payload: { lieuScelle: 'lieu-sos-scelle' },
    });
    expect(alerte.statusCode).toBe(201);

    const vuParLui = await lire(app, ROCHAMBEAU);
    // Le partage est bien inactif, et l'alerte passe quand même.
    expect(vuParLui.json().partageActif).toBe(false);
    expect(vuParLui.json().alertes).toHaveLength(1);
    expect(vuParLui.json().alertes[0].etat).toBe('actif');
  });

  it('se laisse marquer vue puis résolue par l’un comme par l’autre', async () => {
    const { app } = await monterPresence();
    const id = (
      await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/presence/sos`,
        headers: entete(GAELLE),
        payload: {},
      })
    ).json().alerte.id;

    const vue = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/presence/sos/${id}`,
      headers: entete(ROCHAMBEAU),
      payload: { action: 'vue' },
    });
    expect(vue.json().alerte.vueLe).toBeTruthy();

    const resolue = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/presence/sos/${id}`,
      headers: entete(GAELLE),
      payload: { action: 'resolue' },
    });
    expect(resolue.json().alerte.etat).toBe('resolu');
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterPresence();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect((await definirStatut(app, INTRUS, 'disponible')).statusCode).toBe(403);
  });

  it('refuse sans jeton', async () => {
    const { app } = await monterPresence();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/presence`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ferme tout après dissociation, et efface la présence', async () => {
    const { app, depot } = await monterPresence();
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    expect((await lire(app, GAELLE)).statusCode).toBe(410);
    expect(await depot.presence.statuts(COUPLE_ID)).toHaveLength(0);
    expect(await depot.presence.alertes(COUPLE_ID)).toHaveLength(0);
  });
});
