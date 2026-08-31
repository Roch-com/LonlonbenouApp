/** Pôle ③ — le serveur achemine des enveloppes et ne calcule aucun total. */
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

const SCELLE = 'm1.abcdefghijklmnopqrstuvwx.depense-scellee';
const SCELLE_AUTRE = 'm1.zyxwvutsrqponmlkjihgfed.autre-depense';

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/finances`,
    headers: entete(qui),
  });

const reglages = (app: App, qui: string, corps: Record<string, unknown>) =>
  app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/finances/reglages`,
    headers: entete(qui),
    payload: corps,
  });

const ajouter = (app: App, qui: string, corps: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/finances/depenses`,
    headers: entete(qui),
    payload: { jour: '2026-09-14', contenuScelle: SCELLE, ...corps },
  });

const activer = (app: App) => reglages(app, GAELLE, { actif: true });

describe('le module s’allume et s’éteint', () => {
  it('est éteint au départ, et refuse alors toute dépense', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, GAELLE)).json().reglages.actif).toBe(false);

    const refus = await ajouter(app, GAELLE);
    expect(refus.statusCode).toBe(409);
    expect(refus.json().motif).toBe('module_inactif');
  });

  it('n’efface rien en s’éteignant', async () => {
    // Éteindre est un interrupteur, pas une destruction : rallumer doit
    // retrouver l'historique, sinon aucune interface ne prépare la perte.
    const { app } = await monterServeur();
    await activer(app);
    await ajouter(app, GAELLE);

    await reglages(app, ROCHAMBEAU, { actif: false });
    expect((await lire(app, GAELLE)).json().depenses).toHaveLength(0);

    await reglages(app, ROCHAMBEAU, { actif: true });
    expect((await lire(app, GAELLE)).json().depenses).toHaveLength(1);
  });

  it('refuse une devise inconnue', async () => {
    const { app } = await monterServeur();
    expect((await reglages(app, GAELLE, { devise: 'ZZZ' })).statusCode).toBe(400);
  });
});

describe('rien n’entre en clair', () => {
  it('refuse une dépense non scellée', async () => {
    const { app } = await monterServeur();
    await activer(app);

    const reponse = await ajouter(app, GAELLE, { contenuScelle: '12000 courses' });
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('contenu_non_scelle');
  });

  it('refuse des règles de partage non scellées', async () => {
    // Les parts se déduisent des revenus : au moins aussi sensible que les
    // dépenses elles-mêmes.
    const { app } = await monterServeur();
    const reponse = await reglages(app, GAELLE, { reglesScellees: 'egal' });
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('contenu_non_scelle');
  });

  it('ne rend que l’enveloppe et la date', async () => {
    const { app } = await monterServeur();
    await activer(app);
    await ajouter(app, GAELLE);

    const [depense] = (await lire(app, GAELLE)).json().depenses;
    expect(Object.keys(depense).sort()).toEqual([
      'contenuScelle',
      'creeLe',
      'creePar',
      'id',
      'jour',
    ]);
  });

  it('ne calcule aucun total', async () => {
    // Le serveur n'ouvre rien : il ne peut ni sommer, ni équilibrer. La vue
    // ne doit donc porter aucun champ qui le laisserait croire.
    const { app } = await monterServeur();
    await activer(app);
    await ajouter(app, GAELLE);

    expect(Object.keys((await lire(app, GAELLE)).json()).sort()).toEqual([
      'depenses',
      'reglages',
    ]);
  });
});

describe('une dépense commune se corrige à deux', () => {
  it('laisse chacun retirer, y compris ce que l’autre a saisi', async () => {
    // Réclamer une rectification à son partenaire est exactement la
    // conversation pénible que ce module doit éviter.
    const { app } = await monterServeur();
    await activer(app);
    const cree = await ajouter(app, GAELLE, { contenuScelle: SCELLE_AUTRE });

    const retrait = await app.inject({
      method: 'DELETE',
      url: `/couples/${COUPLE_ID}/finances/depenses/${cree.json().depense.id}`,
      headers: entete(ROCHAMBEAU),
    });
    expect(retrait.statusCode).toBe(204);
    expect((await lire(app, GAELLE)).json().depenses).toHaveLength(0);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect((await ajouter(app, INTRUS)).statusCode).toBe(403);
  });

  it('ferme tout après dissociation', async () => {
    const { app } = await monterServeur();
    await activer(app);
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    expect((await lire(app, GAELLE)).statusCode).toBe(410);
  });
});
