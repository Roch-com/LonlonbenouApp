import { describe, expect, it } from 'vitest';
import {
  grilleDuMois,
  joursDuMois,
  marquesDuCouple,
  type MarqueJour,
} from './mois';
import type { Evenement } from '../types/calendrier';
import type { Initiative } from '../types/initiatives';
import type { Projet } from '../types/projets';

const evenement = (p: Partial<Evenement>): Evenement =>
  ({
    id: 'e1',
    titre: 'Dîner',
    categorie: 'a_deux',
    debut: '2026-09-10T19:00:00',
    journeeEntiere: false,
    creePar: 'a',
    creeLe: '2026-09-01T10:00:00.000Z',
    ...p,
  }) as Evenement;

const projet = (p: Partial<Projet>): Projet =>
  ({
    id: 'p1',
    titre: 'Voyage',
    jalons: [],
    creePar: 'a',
    creeLe: '2026-09-01T10:00:00.000Z',
    ...p,
  }) as Projet;

const initiative = (p: Partial<Initiative>): Initiative =>
  ({
    id: 'i1',
    titre: 'Cinéma',
    categorie: 'sortie',
    etat: 'prevue',
    proposeePar: 'a',
    proposeeLe: '2026-09-01T10:00:00.000Z',
    ...p,
  }) as Initiative;

describe('grille du mois', () => {
  it('rend des semaines complètes, débordant sur les mois voisins', () => {
    // Septembre 2026 commence un mardi : la première case doit être le lundi
    // 31 août. Une grille démarrant au 1er casserait l'alignement des colonnes.
    const semaines = grilleDuMois(2026, 9);
    expect(semaines[0]!.jours).toHaveLength(7);
    expect(semaines[0]!.jours[0]!.jour).toBe('2026-08-31');
    expect(semaines[0]!.jours[0]!.duMois).toBe(false);
    expect(semaines[0]!.jours[1]!.jour).toBe('2026-09-01');
    expect(semaines[0]!.jours[1]!.duMois).toBe(true);

    for (const semaine of semaines) expect(semaine.jours).toHaveLength(7);
    const dernier = semaines.at(-1)!.jours.at(-1)!;
    expect(dernier.jour).toBe('2026-10-04');
  });

  it('compte les jours de février sans cas particulier', () => {
    expect(joursDuMois(2026, 2)).toBe(28);
    expect(joursDuMois(2028, 2)).toBe(29);
    expect(joursDuMois(2026, 12)).toBe(31);
  });

  it('range chaque marque sur son jour', () => {
    const marques: MarqueJour[] = [
      { sorte: 'evenement', jour: '2026-09-10', titre: 'Dîner' },
      { sorte: 'jalon', jour: '2026-09-10', titre: 'Réserver' },
    ];
    const semaines = grilleDuMois(2026, 9, marques);
    const cases = semaines.flatMap((s) => s.jours);
    expect(cases.find((c) => c.jour === '2026-09-10')!.marques).toHaveLength(2);
    expect(cases.find((c) => c.jour === '2026-09-11')!.marques).toHaveLength(0);
  });
});

describe('agrégation', () => {
  it('réunit événements, jalons, initiatives et anniversaire', () => {
    const marques = marquesDuCouple({
      evenements: [evenement({})],
      projets: [
        projet({ jalons: [{ id: 'j1', titre: 'Réserver', echeance: '2026-09-12' }] }),
      ],
      initiatives: [initiative({ prevuePour: '2026-09-20' })],
      depuis: '2024-09-14',
      annee: 2026,
    });

    expect(marques.map((m) => m.sorte).sort()).toEqual([
      'anniversaire',
      'evenement',
      'initiative',
      'jalon',
    ]);
    const anniversaire = marques.find((m) => m.sorte === 'anniversaire')!;
    expect(anniversaire.jour).toBe('2026-09-14');
    expect(anniversaire.titre).toBe('2 ans tous les deux');
  });

  it('n’encombre pas la grille de ce qui n’attend plus rien', () => {
    // Un jalon coché et une sortie déjà vécue ne sont plus des échéances.
    const marques = marquesDuCouple({
      projets: [
        projet({
          jalons: [
            { id: 'j1', titre: 'Fait', echeance: '2026-09-12', faitLe: '2026-09-11' },
          ],
        }),
      ],
      initiatives: [initiative({ prevuePour: '2026-09-20', etat: 'vecue' })],
    });
    expect(marques).toHaveLength(0);
  });

  it('ignore un horodatage illisible plutôt que de lever', () => {
    // Même donnée que celle qui fermait le pôle ③ : elle ne doit pas non plus
    // casser le calendrier.
    expect(() =>
      marquesDuCouple({ evenements: [evenement({ debut: 'pas une date' })] }),
    ).not.toThrow();
    expect(marquesDuCouple({ evenements: [evenement({ debut: 'pas une date' })] }))
      .toHaveLength(0);
  });

  it('ne reçoit du cycle que ce qui a déjà été projeté', () => {
    // La fonction ne prend ni règles ni symptômes : aucune vue calendrier ne
    // peut devenir un contournement du pôle ④.
    const marques = marquesDuCouple({
      phasesCycle: [{ jour: '2026-09-05', libelle: 'Règles' }],
    });
    expect(marques).toEqual([
      { sorte: 'cycle', jour: '2026-09-05', titre: 'Règles' },
    ]);
  });

  it('n’annonce pas d’anniversaire l’année de la rencontre', () => {
    expect(
      marquesDuCouple({ depuis: '2026-09-14', annee: 2026 }),
    ).toHaveLength(0);
  });
});
