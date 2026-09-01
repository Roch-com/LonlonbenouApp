/**
 * Nom d’espace du couple (§8.18).
 *
 * « Nom d’espace personnalisé (ex. "Rochaelle") ». La colonne existait depuis
 * le socle mais n’était ni lue ni écrite.
 */
import { describe, expect, it } from 'vitest';
import { LONGUEUR_MAX_NOM_ESPACE } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const nommer = (s: Serveur, qui: string, nom: unknown) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/nom`,
    headers: entete(qui),
    payload: { nom },
  });

const moi = (s: Serveur, qui: string) =>
  s.app.inject({ method: 'GET', url: '/moi', headers: entete(qui) });

describe('nom d’espace', () => {
  it('est absent tant qu’il n’a pas été choisi', async () => {
    const s = await monterServeur();
    expect((await moi(s, GAELLE)).json().nomEspace).toBeUndefined();
  });

  it('se pose et se voit des deux côtés', async () => {
    const s = await monterServeur();
    expect((await nommer(s, GAELLE, 'Rochaelle')).statusCode).toBe(200);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      expect((await moi(s, qui)).json().nomEspace).toBe('Rochaelle');
    }
  });

  it('se change depuis les deux côtés', async () => {
    // L'espace appartient au couple, pas à celui qui l'a nommé en premier.
    const s = await monterServeur();
    await nommer(s, GAELLE, 'Rochaelle');
    await nommer(s, ROCHAMBEAU, 'Chez nous');

    expect((await moi(s, GAELLE)).json().nomEspace).toBe('Chez nous');
  });

  it('revient au défaut sur un nom vide', async () => {
    // Se raviser sur un surnom doit rester possible.
    const s = await monterServeur();
    await nommer(s, GAELLE, 'Rochaelle');

    const r = await nommer(s, GAELLE, '   ');
    expect(r.statusCode).toBe(200);
    expect(r.json().nomEspace).toBeNull();
    expect((await moi(s, GAELLE)).json().nomEspace).toBeUndefined();
  });

  it('réduit les espaces et coupe ce qui dépasse', async () => {
    const s = await monterServeur();
    await nommer(s, GAELLE, '  Roch   aelle  ');
    expect((await moi(s, GAELLE)).json().nomEspace).toBe('Roch aelle');

    await nommer(s, GAELLE, 'x'.repeat(LONGUEUR_MAX_NOM_ESPACE + 20));
    expect((await moi(s, GAELLE)).json().nomEspace).toHaveLength(
      LONGUEUR_MAX_NOM_ESPACE,
    );
  });

  it('refuse un tiers', async () => {
    const s = await monterServeur();
    expect((await nommer(s, INTRUS, 'Chez moi')).statusCode).toBe(403);
  });

  it('refuse un corps sans nom', async () => {
    const s = await monterServeur();
    expect((await nommer(s, GAELLE, 42)).statusCode).toBe(400);
  });
});
