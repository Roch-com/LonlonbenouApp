/**
 * Journal du couple, côté serveur (§8.17).
 *
 * Le module ne stocke rien : ce qui se vérifie ici est donc ce qui **sort** —
 * ce qui entre dans la frise, ce qui n’y entre pas, et surtout ce qui ne doit
 * pas y fuir.
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

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const lire = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/journal`,
    headers: entete(qui),
  });

type Entree = { id: string; sorte: string; jour: string };

const entrees = async (s: Serveur, qui: string) =>
  (await lire(s, qui)).json().entrees as Entree[];

/**
 * La frise sans les anniversaires.
 *
 * Le couple de test date de 2019 : il en produit un par an, qui noieraient les
 * cas portant sur les autres sortes. Ils ont leur propre bloc plus bas.
 */
const horsAnniversaires = async (s: Serveur, qui: string) =>
  (await entrees(s, qui)).filter((e) => e.sorte !== 'anniversaire');

describe('accès', () => {
  it('refuse un tiers', async () => {
    const s = await monterServeur();
    expect((await lire(s, INTRUS)).statusCode).toBe(403);
  });

  it('ne rend que les anniversaires sur un couple sans rien', async () => {
    const s = await monterServeur();
    expect(await horsAnniversaires(s, GAELLE)).toEqual([]);
  });
});

describe('ce qui entre', () => {
  it('prend un projet terminé', async () => {
    const s = await monterServeur();
    await s.depot.viePratique.enregistrerProjet(COUPLE_ID, {
      id: 'p1',
      titre: 'Partir en Casamance',
      jalons: [{ id: 'j1', titre: 'Partir', faitLe: '2026-04-02T10:00:00.000Z' }],
      creePar: GAELLE,
      creeLe: '2026-01-05T10:00:00.000Z',
    });

    expect(await horsAnniversaires(s, GAELLE)).toMatchObject([
      { id: 'projet-p1', sorte: 'projet' },
    ]);
  });

  it('prend un axe refermé et une sortie vécue', async () => {
    const s = await monterServeur();
    await s.depot.axes.enregistrer(COUPLE_ID, {
      id: 'a1',
      theme: 'communication',
      titre: 'Se dire les choses plus tôt',
      ouvertPar: GAELLE,
      ouvertLe: '2026-02-01T10:00:00.000Z',
      contributions: [],
      clotureLe: '2026-06-15T10:00:00.000Z',
    });
    await s.depot.viePratique.enregistrerInitiative(COUPLE_ID, {
      id: 'i1',
      titre: 'Dîner sans téléphone',
      categorie: 'restaurant',
      etat: 'vecue',
      proposeePar: ROCHAMBEAU,
      proposeeLe: '2026-05-01T10:00:00.000Z',
      vecueLe: '2026-05-08T10:00:00.000Z',
    });

    expect((await horsAnniversaires(s, GAELLE)).map((e) => e.id)).toEqual([
      'progres-a1',
      'initiative-i1',
    ]);
  });

  it('prend un parcours achevé, avec son titre du catalogue', async () => {
    const s = await monterServeur();
    await s.depot.parcours.enregistrer(COUPLE_ID, {
      parcoursId: 'communication-1',
      commenceLe: '2026-07-01T10:00:00.000Z',
      avancees: [],
      termineLe: '2026-08-01T10:00:00.000Z',
    });

    expect(await horsAnniversaires(s, GAELLE)).toMatchObject([
      { sorte: 'parcours', titre: 'Se dire les choses plus tôt' },
    ]);
  });

  it('écarte un parcours seulement commencé', async () => {
    const s = await monterServeur();
    await s.depot.parcours.enregistrer(COUPLE_ID, {
      parcoursId: 'communication-1',
      commenceLe: '2026-07-01T10:00:00.000Z',
      avancees: [],
    });

    expect(await horsAnniversaires(s, GAELLE)).toEqual([]);
  });
});

describe('anniversaires', () => {
  it('en rend un par an depuis l’origine, et aucun à venir', async () => {
    const s = await monterServeur();
    const jours = (await entrees(s, GAELLE))
      .filter((e) => e.sorte === 'anniversaire')
      .map((e) => e.jour);

    expect(jours.length).toBeGreaterThan(0);
    for (const jour of jours) {
      expect(jour.slice(4)).toBe('-11-23');
      expect(jour <= new Date().toISOString().slice(0, 10)).toBe(true);
    }
    // Du plus récent au plus ancien, sans doublon.
    expect(new Set(jours).size).toBe(jours.length);
    expect([...jours].sort().reverse()).toEqual(jours);
  });
});

describe('ce qui ne doit pas fuir', () => {
  it('n’évente pas un projet surprise encore caché', async () => {
    const s = await monterServeur();
    await s.depot.viePratique.enregistrerProjet(COUPLE_ID, {
      id: 'surprise',
      titre: 'Un week-end à Ouidah',
      jalons: [
        { id: 'j1', titre: 'Réserver', faitLe: '2026-05-02T10:00:00.000Z' },
      ],
      creePar: GAELLE,
      creeLe: '2026-04-01T10:00:00.000Z',
      revelerLe: '2027-02-14',
    });

    // Gaëlle le prépare : elle le voit.
    expect((await horsAnniversaires(s, GAELLE)).map((e) => e.id)).toEqual([
      'projet-surprise',
    ]);
    // Rochambeau ne doit rien en savoir, pas même par la frise.
    expect(await horsAnniversaires(s, ROCHAMBEAU)).toEqual([]);
    expect((await lire(s, ROCHAMBEAU)).body).not.toContain('Ouidah');
  });

  it('ne nomme personne', async () => {
    const s = await monterServeur();
    await s.depot.viePratique.enregistrerInitiative(COUPLE_ID, {
      id: 'i1',
      titre: 'Une marche',
      categorie: 'nature',
      etat: 'vecue',
      proposeePar: ROCHAMBEAU,
      proposeeLe: '2026-05-01T10:00:00.000Z',
      vecueLe: '2026-05-08T10:00:00.000Z',
    });

    const corps = (await lire(s, GAELLE)).body;
    expect(corps).not.toContain(ROCHAMBEAU);
    expect(corps).not.toContain(GAELLE);
  });
});
