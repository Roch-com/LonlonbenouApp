/** Pôle ⑤ — l'album est symétrique par construction, et scellé. */
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

const SCELLE = 'm1.abcdefghijklmnopqrstuvwx.contenu-scelle';
const SCELLE_AUTRE = 'm1.zyxwvutsrqponmlkjihgfed.autre-contenu';

const ajouter = (app: App, qui: string, corps: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/souvenirs`,
    headers: entete(qui),
    payload: { sorte: 'moment', jour: '2025-09-14', contenuScelle: SCELLE, ...corps },
  });

const lister = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/souvenirs`,
    headers: entete(qui),
  });

const supprimer = (app: App, qui: string, id: string) =>
  app.inject({
    method: 'DELETE',
    url: `/couples/${COUPLE_ID}/souvenirs/${id}`,
    headers: entete(qui),
  });

describe('mémoire commune', () => {
  it('rend à l’autre ce que l’un a ajouté, sans consentement à donner', async () => {
    // Comme le calendrier : rien à observer d'une personne, seulement une
    // mémoire construite à deux. Aucun interrupteur ne s'interpose.
    const { app } = await monterServeur();
    await ajouter(app, GAELLE, {});

    expect((await lister(app, ROCHAMBEAU)).json().souvenirs).toHaveLength(1);
    expect((await lister(app, GAELLE)).json().souvenirs).toEqual(
      (await lister(app, ROCHAMBEAU)).json().souvenirs,
    );
  });

  it('laisse chacun retirer, y compris ce que l’autre a posé', async () => {
    // Exiger d'être l'auteur ferait de l'un le propriétaire de leur histoire.
    const { app } = await monterServeur();
    const cree = await ajouter(app, GAELLE, {});
    const id = cree.json().souvenir.id;

    expect((await supprimer(app, ROCHAMBEAU, id)).statusCode).toBe(204);
    expect((await lister(app, GAELLE)).json().souvenirs).toHaveLength(0);
  });

  it('rend le plus récent d’abord', async () => {
    const { app } = await monterServeur();
    await ajouter(app, GAELLE, { jour: '2024-01-02' });
    await ajouter(app, GAELLE, { jour: '2026-03-04', contenuScelle: SCELLE_AUTRE });

    const jours = (await lister(app, GAELLE)).json().souvenirs.map(
      (s: { jour: string }) => s.jour,
    );
    expect(jours).toEqual(['2026-03-04', '2024-01-02']);
  });
});

describe('le clair n’entre jamais', () => {
  it('refuse un contenu non scellé', async () => {
    const { app } = await monterServeur();
    const reponse = await ajouter(app, GAELLE, {
      contenuScelle: 'Notre premier voyage',
    });

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('contenu_non_scelle');
  });

  it('refuse une date ou une sorte invalide', async () => {
    const { app } = await monterServeur();
    expect((await ajouter(app, GAELLE, { jour: '14/09/2025' })).statusCode).toBe(400);
    expect((await ajouter(app, GAELLE, { sorte: 'photo' })).statusCode).toBe(400);
  });

  it('ne rend que l’enveloppe et la date', async () => {
    // Le serveur ne sait ni ce qui s'est passé, ni où : la date seule dit
    // qu'il s'est passé quelque chose ce jour-là.
    const { app } = await monterServeur();
    await ajouter(app, GAELLE, { sorte: 'lieu' });

    const [souvenir] = (await lister(app, GAELLE)).json().souvenirs;
    expect(Object.keys(souvenir).sort()).toEqual([
      'contenuScelle',
      'creeLe',
      'creePar',
      'id',
      'jour',
      'sorte',
    ]);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await ajouter(app, INTRUS, {})).statusCode).toBe(403);
    expect((await lister(app, INTRUS)).statusCode).toBe(403);
  });

  it('ferme tout après dissociation', async () => {
    const { app } = await monterServeur();
    await ajouter(app, GAELLE, {});
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    expect((await lister(app, GAELLE)).statusCode).toBe(410);
  });
});
