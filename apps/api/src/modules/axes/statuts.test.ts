/**
 * Axes : importance, progrès reconnus et limite d’ouverture (§8.5).
 *
 * La limite est un garde-fou du cahier — « pour éviter l’effet liste de
 * griefs » — donc elle se vérifie **côté serveur**, pas seulement à l’écran.
 */
import { describe, expect, it } from 'vitest';
import { LIMITE_AXES_ACTIFS } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const ouvrir = (
  s: Serveur,
  qui: string,
  titre: string,
  importance?: string,
) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/axes`,
    headers: entete(qui),
    payload: { theme: 'communication', titre, ...(importance ? { importance } : {}) },
  });

const cloturer = (s: Serveur, qui: string, axeId: string) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/axes/${axeId}/cloture`,
    headers: entete(qui),
    payload: { cloture: true },
  });

const reconnaitre = (s: Serveur, qui: string, axeId: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/axes/${axeId}/progres`,
    headers: entete(qui),
  });

const lister = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/axes`,
    headers: entete(qui),
  });

describe('importance', () => {
  it('se garde telle qu’elle est posée', async () => {
    const s = await monterServeur();
    const r = await ouvrir(s, GAELLE, 'Se dire les choses', 'forte');
    expect(r.statusCode).toBe(201);
    expect(r.json().axe.importance).toBe('forte');
  });

  it('reste absente quand elle n’est pas donnée', async () => {
    // On n'invente pas une importance : ce serait faire dire à l'auteur
    // quelque chose qu'il n'a pas dit.
    const s = await monterServeur();
    expect((await ouvrir(s, GAELLE, 'Sans niveau')).json().axe.importance).toBeUndefined();
  });

  it('refuse un niveau inventé', async () => {
    const s = await monterServeur();
    expect((await ouvrir(s, GAELLE, 'Axe', 'urgentissime')).statusCode).toBe(400);
  });
});

describe('la limite d’axes ouverts', () => {
  it('laisse ouvrir jusqu’à la limite', async () => {
    const s = await monterServeur();
    for (let n = 0; n < LIMITE_AXES_ACTIFS; n += 1) {
      expect((await ouvrir(s, GAELLE, `Axe ${n}`)).statusCode).toBe(201);
    }
  });

  it('refuse au-delà, avec un motif explicite', async () => {
    const s = await monterServeur();
    for (let n = 0; n < LIMITE_AXES_ACTIFS; n += 1) {
      await ouvrir(s, GAELLE, `Axe ${n}`);
    }

    const refus = await ouvrir(s, GAELLE, 'Un de trop');
    expect(refus.statusCode).toBe(409);
    expect(refus.json().motif).toBe('trop_daxes_ouverts');
  });

  it('compte le couple, pas la personne', async () => {
    // Deux listes de trois feraient six griefs affichés.
    const s = await monterServeur();
    for (let n = 0; n < LIMITE_AXES_ACTIFS; n += 1) {
      await ouvrir(s, GAELLE, `Axe ${n}`);
    }
    expect((await ouvrir(s, ROCHAMBEAU, 'Le mien')).statusCode).toBe(409);
  });

  it('rouvre la place quand on referme', async () => {
    const s = await monterServeur();
    const ids: string[] = [];
    for (let n = 0; n < LIMITE_AXES_ACTIFS; n += 1) {
      ids.push((await ouvrir(s, GAELLE, `Axe ${n}`)).json().axe.id);
    }

    await cloturer(s, GAELLE, ids[0]!);
    expect((await ouvrir(s, GAELLE, 'De la place')).statusCode).toBe(201);
  });
});

describe('reconnaître un progrès', () => {
  it('n’est possible que pour l’autre', async () => {
    const s = await monterServeur();
    const id = (await ouvrir(s, GAELLE, 'Se dire les choses')).json().axe.id;

    // Gaëlle a ouvert l'axe : elle ne peut pas se décerner son propre progrès.
    const refus = await reconnaitre(s, GAELLE, id);
    expect(refus.statusCode).toBe(403);
    expect(refus.json().motif).toBe('progres_a_soi_meme');
  });

  it('se pose depuis l’autre côté et fait passer le statut', async () => {
    const s = await monterServeur();
    const id = (await ouvrir(s, GAELLE, 'Se dire les choses')).json().axe.id;

    const r = await reconnaitre(s, ROCHAMBEAU, id);
    expect(r.statusCode).toBe(200);
    expect(r.json().axe.reconnaissances).toHaveLength(1);

    // Et les deux le voient.
    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const axe = (await lister(s, qui)).json().axes.find(
        (a: { id: string }) => a.id === id,
      );
      expect(axe.reconnaissances).toHaveLength(1);
    }
  });

  it('ne se compte pas deux fois', async () => {
    const s = await monterServeur();
    const id = (await ouvrir(s, GAELLE, 'Se dire les choses')).json().axe.id;

    await reconnaitre(s, ROCHAMBEAU, id);
    const second = await reconnaitre(s, ROCHAMBEAU, id);
    expect(second.statusCode).toBe(200);
    expect(second.json().axe.reconnaissances).toHaveLength(1);
  });

  it('refuse sur un axe qui n’existe pas', async () => {
    const s = await monterServeur();
    expect((await reconnaitre(s, ROCHAMBEAU, 'fantome')).statusCode).toBe(404);
  });
});
