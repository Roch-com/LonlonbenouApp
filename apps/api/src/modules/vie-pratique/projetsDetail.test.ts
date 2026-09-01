/**
 * Catégorie de projet et jalons assignables (§8.10).
 *
 * L’assignation dit **qui s’en occupe**. Elle ne doit jamais servir à
 * compter : un projet de couple avance ou n’avance pas, personne n’avance plus
 * que l’autre.
 */
import { describe, expect, it } from 'vitest';
import { CATEGORIES_PROJET } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const creer = (s: Serveur, qui: string, corps: Record<string, unknown>) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/vie-pratique/projets`,
    headers: entete(qui),
    payload: corps,
  });

const ajouterJalon = (
  s: Serveur,
  qui: string,
  projetId: string,
  corps: Record<string, unknown>,
) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/vie-pratique/projets/${projetId}/jalons`,
    headers: entete(qui),
    payload: corps,
  });

const lire = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/vie-pratique`,
    headers: entete(qui),
  });

describe('catégorie de projet', () => {
  it('se garde telle qu’elle est posée', async () => {
    const s = await monterServeur();
    const r = await creer(s, GAELLE, {
      titre: 'Partir en Casamance',
      categorie: 'voyage',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().projet.categorie).toBe('voyage');
  });

  it('reste absente quand elle n’est pas donnée', async () => {
    const s = await monterServeur();
    const r = await creer(s, GAELLE, { titre: 'Sans catégorie' });
    expect(r.json().projet.categorie).toBeUndefined();
  });

  it('refuse une catégorie inventée', async () => {
    const s = await monterServeur();
    const r = await creer(s, GAELLE, { titre: 'Projet', categorie: 'licorne' });
    expect(r.statusCode).toBe(400);
  });

  it('accepte chacune des catégories du catalogue', async () => {
    const s = await monterServeur();
    for (const c of CATEGORIES_PROJET) {
      const r = await creer(s, GAELLE, { titre: `Projet ${c.code}`, categorie: c.code });
      expect(r.statusCode).toBe(201);
    }
  });
});

describe('jalons assignables', () => {
  it('revient aux deux quand personne n’est nommé', async () => {
    const s = await monterServeur();
    const projetId = (await creer(s, GAELLE, { titre: 'Voyage' })).json().projet.id;

    const r = await ajouterJalon(s, GAELLE, projetId, { titre: 'Réserver' });
    expect(r.statusCode).toBe(201);
    expect(r.json().projet.jalons[0].assigneA).toBeUndefined();
  });

  it('s’assigne à l’un ou à l’autre', async () => {
    const s = await monterServeur();
    const projetId = (await creer(s, GAELLE, { titre: 'Voyage' })).json().projet.id;

    await ajouterJalon(s, GAELLE, projetId, {
      titre: 'Réserver',
      assigneA: ROCHAMBEAU,
    });
    await ajouterJalon(s, ROCHAMBEAU, projetId, {
      titre: 'Faire les sacs',
      assigneA: GAELLE,
    });

    const projet = (await lire(s, GAELLE)).json().projets[0];
    expect(projet.jalons.map((j: { assigneA?: string }) => j.assigneA)).toEqual([
      ROCHAMBEAU,
      GAELLE,
    ]);
  });

  it('refuse quelqu’un qui n’est pas du couple', async () => {
    // Un identifiant étranger afficherait un jalon attribué à personne.
    const s = await monterServeur();
    const projetId = (await creer(s, GAELLE, { titre: 'Voyage' })).json().projet.id;

    const r = await ajouterJalon(s, GAELLE, projetId, {
      titre: 'Réserver',
      assigneA: 'quelquun-dautre',
    });
    expect(r.statusCode).toBe(400);
  });

  it('se voit des deux côtés', async () => {
    const s = await monterServeur();
    const projetId = (await creer(s, GAELLE, { titre: 'Voyage' })).json().projet.id;
    await ajouterJalon(s, GAELLE, projetId, {
      titre: 'Réserver',
      assigneA: ROCHAMBEAU,
    });

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const projet = (await lire(s, qui)).json().projets[0];
      expect(projet.jalons[0].assigneA).toBe(ROCHAMBEAU);
    }
  });

  it('survit à une modification du projet', async () => {
    // L'écriture remplace tous les jalons : l'assignation ne doit pas se
    // perdre au passage.
    const s = await monterServeur();
    const projetId = (await creer(s, GAELLE, { titre: 'Voyage' })).json().projet.id;
    await ajouterJalon(s, GAELLE, projetId, {
      titre: 'Réserver',
      assigneA: ROCHAMBEAU,
    });
    await ajouterJalon(s, GAELLE, projetId, { titre: 'Partir' });

    const projet = (await lire(s, GAELLE)).json().projets[0];
    expect(projet.jalons[0].assigneA).toBe(ROCHAMBEAU);
    expect(projet.jalons[1].assigneA).toBeUndefined();
  });
});
