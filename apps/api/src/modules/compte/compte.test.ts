/**
 * Pôle ⑥ — portabilité et droit à l'effacement.
 *
 * Le risque propre à un export : contourner les règles de visibilité. Il
 * suffirait de l'exporter pour lire le cycle de l'autre.
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

const exporter = (app: App, qui: string) =>
  app.inject({ method: 'GET', url: '/moi/export', headers: entete(qui) });

const supprimer = (app: App, qui: string, confirmation?: string) =>
  app.inject({
    method: 'DELETE',
    url: '/moi',
    headers: entete(qui),
    payload: confirmation === undefined ? {} : { confirmation },
  });

const declarerCycle = async (app: App) => {
  await app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/cycle/porteuse`,
    headers: entete(GAELLE),
    payload: { porteuseId: GAELLE },
  });
  return app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/cycle/regles`,
    headers: entete(GAELLE),
    payload: { debutLe: '2026-08-01' },
  });
};

describe('export', () => {
  it('rend le couple et les données communes', async () => {
    const { app } = await monterServeur();
    const donnees = (await exporter(app, ROCHAMBEAU)).json();

    expect(donnees.compte.id).toBe(ROCHAMBEAU);
    expect(donnees.couple.id).toBe(COUPLE_ID);
    expect(donnees.couple.partenaires).toHaveLength(2);
    expect(donnees.vie_pratique).toBeDefined();
  });

  it('ne donne le cycle qu’à la personne concernée', async () => {
    // Sans cette règle, l'export serait une porte dérobée sur le pôle ④ :
    // il suffirait de le demander pour lire ce qu'aucun écran ne montre.
    const { app } = await monterServeur();
    await declarerCycle(app);

    expect((await exporter(app, GAELLE)).json().cycle.regles).toHaveLength(1);
    expect((await exporter(app, ROCHAMBEAU)).json().cycle).toBeUndefined();
    expect((await exporter(app, ROCHAMBEAU)).body).not.toContain('2026-08-01');
  });

  it('ne rend la présence que si le partage est actif des deux côtés', async () => {
    const { app } = await monterServeur();
    expect((await exporter(app, ROCHAMBEAU)).json().presence).toBeUndefined();

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      await app.inject({
        method: 'PUT',
        url: `/couples/${COUPLE_ID}/partages/position`,
        headers: entete(qui),
        payload: { actif: true },
      });
    }
    expect((await exporter(app, ROCHAMBEAU)).json().presence).toBeDefined();
  });

  it('sort le chat scellé, jamais en clair', async () => {
    // Le serveur ne détient aucune clé privée. Un export « lisible » du chat
    // signifierait qu'il peut déchiffrer — donc que la promesse est fausse.
    const { app } = await monterServeur();
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/chat`,
      headers: entete(ROCHAMBEAU),
      payload: { enveloppe: 'm1.abcdefghijklmnopqrstuvwx.charge-scellee' },
    });

    const donnees = (await exporter(app, ROCHAMBEAU)).json();
    expect(donnees.chat_scelle).toHaveLength(1);
    expect(donnees.chat_scelle[0].enveloppe).toMatch(/^m1\./);
  });
});

describe('suppression de compte', () => {
  it('refuse sans confirmation explicite', async () => {
    // Un `DELETE` déclenché par erreur ne doit pas suffire.
    const { app } = await monterServeur();
    expect((await supprimer(app, ROCHAMBEAU)).statusCode).toBe(400);
    expect((await supprimer(app, ROCHAMBEAU, 'oui')).statusCode).toBe(400);
  });

  it('dissocie, prévient les deux, puis efface le compte', async () => {
    const { app, depot } = await monterServeur();
    expect((await supprimer(app, ROCHAMBEAU, 'SUPPRIMER')).statusCode).toBe(204);

    // L'autre ne doit pas découvrir un espace vide sans un mot.
    const journal = await depot.notifications.journal(GAELLE);
    expect(journal.length).toBeGreaterThan(0);

    const couple = await depot.couples.parId(COUPLE_ID);
    expect(couple?.dissocieLe).toBeDefined();
  });

  it('ne laisse plus aucune donnée commune à exporter', async () => {
    // Le couple est dissocié : l'export ne doit pas contourner la coupure.
    const { app } = await monterServeur();
    await supprimer(app, ROCHAMBEAU, 'SUPPRIMER');

    const donnees = (await exporter(app, ROCHAMBEAU)).json();
    expect(donnees.couple.dissocie_le).toBeDefined();
    expect(donnees.chat_scelle).toHaveLength(0);
    expect(donnees.axes).toHaveLength(0);
  });
});
