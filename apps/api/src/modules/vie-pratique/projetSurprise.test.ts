/**
 * Pôle ③ — projet surprise (§8.10).
 *
 * C'est la seule asymétrie assumée de l'application. Elle ne contredit pas le
 * garde-fou n°1 : ce qui est caché n'est pas une observation de l'autre, c'est
 * un cadeau qu'on lui prépare. Encore faut-il que le secret tienne vraiment —
 * et qu'il se lève tout seul le jour dit.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';
import { encoreSecret, projetsVisiblesPar } from '@lonlonbenu/shared';
import type { Projet } from '@lonlonbenu/shared';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

const creer = (app: App, qui: string, corps: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/vie-pratique/projets`,
    headers: entete(qui),
    payload: { titre: 'Un voyage', ...corps },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/vie-pratique`,
    headers: entete(qui),
  });

/** Une date largement dans le futur, insensible au jour du test. */
const DEMAIN = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

describe('le secret tient', () => {
  it('ne montre pas le projet à l’autre avant la date', async () => {
    const { app } = await monterServeur();
    await creer(app, GAELLE, { titre: 'Son anniversaire', revelerLe: DEMAIN });

    const vu = await lire(app, ROCHAMBEAU);
    expect(vu.json().projets).toHaveLength(0);
    // La preuve qui compte : le titre n'est pas dans le corps HTTP.
    expect(vu.body).not.toContain('Son anniversaire');
  });

  it('le montre toujours à son auteur', async () => {
    const { app } = await monterServeur();
    await creer(app, GAELLE, { revelerLe: DEMAIN });
    expect((await lire(app, GAELLE)).json().projets).toHaveLength(1);
  });

  it('se lève tout seul le jour venu', async () => {
    // Un drapeau « révélé » obligerait quelqu'un à penser à le basculer, et un
    // projet oublié resterait secret pour toujours.
    const { app } = await monterServeur();
    await creer(app, GAELLE, { revelerLe: HIER });
    expect((await lire(app, ROCHAMBEAU)).json().projets).toHaveLength(1);
  });

  it('ne cache rien sans date de révélation', async () => {
    const { app } = await monterServeur();
    await creer(app, GAELLE, {});
    expect((await lire(app, ROCHAMBEAU)).json().projets).toHaveLength(1);
  });

  it('refuse une date de révélation mal formée', async () => {
    // Elle ferait un projet secret pour toujours.
    const { app } = await monterServeur();
    const reponse = await creer(app, GAELLE, { revelerLe: '14/09/2026' });
    expect(reponse.statusCode).toBe(400);
  });
});

describe('la règle, isolée', () => {
  const projet = (partiel: Partial<Projet>): Projet =>
    ({
      id: 'p1',
      titre: 'Un projet',
      jalons: [],
      creePar: GAELLE,
      creeLe: '2026-01-01T00:00:00.000Z',
      ...partiel,
    }) as Projet;

  it('cesse d’être secret le jour même', () => {
    const maintenant = '2026-09-14T08:00:00.000Z';
    expect(encoreSecret({ revelerLe: '2026-09-14' }, maintenant)).toBe(false);
    expect(encoreSecret({ revelerLe: '2026-09-15' }, maintenant)).toBe(true);
  });

  it('filtre pour le lecteur, pas pour l’auteur', () => {
    const secret = projet({ revelerLe: '2026-12-25' });
    const maintenant = '2026-09-14T08:00:00.000Z';
    expect(projetsVisiblesPar([secret], GAELLE, maintenant)).toHaveLength(1);
    expect(projetsVisiblesPar([secret], ROCHAMBEAU, maintenant)).toHaveLength(0);
  });
});
