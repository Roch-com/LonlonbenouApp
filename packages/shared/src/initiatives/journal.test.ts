import { describe, expect, it } from 'vitest';
import type { Initiative } from '../types/initiatives';
import * as moduleJournal from './journal';
import {
  idees,
  journal,
  marquerVecue,
  prevues,
  programmer,
  resumeJournal,
} from './journal';

const MAINTENANT = '2026-03-15T12:00:00.000Z';
const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';

const initiative = (
  id: string,
  modifications: Partial<Initiative> = {},
): Initiative => ({
  id,
  titre: `Sortie ${id}`,
  categorie: 'restaurant',
  etat: 'idee',
  proposeePar: ROCHAMBEAU,
  proposeeLe: '2026-03-01T10:00:00.000Z',
  ...modifications,
});

describe('tri par état', () => {
  it('sépare idées, sorties prévues et journal', () => {
    const liste = [
      initiative('idee'),
      initiative('prevue', { etat: 'prevue', prevuePour: '2026-03-20' }),
      initiative('vecue', { etat: 'vecue', vecueLe: '2026-03-10T20:00:00.000Z' }),
    ];

    expect(idees(liste).map((i) => i.id)).toEqual(['idee']);
    expect(prevues(liste).map((i) => i.id)).toEqual(['prevue']);
    expect(journal(liste).map((i) => i.id)).toEqual(['vecue']);
  });

  it('range le journal du plus récent au plus ancien', () => {
    const liste = [
      initiative('vieille', { etat: 'vecue', vecueLe: '2026-01-05T20:00:00.000Z' }),
      initiative('recente', { etat: 'vecue', vecueLe: '2026-03-10T20:00:00.000Z' }),
    ];
    expect(journal(liste).map((i) => i.id)).toEqual(['recente', 'vieille']);
  });

  it('range les sorties prévues de la plus proche à la plus lointaine', () => {
    const liste = [
      initiative('avril', { etat: 'prevue', prevuePour: '2026-04-10' }),
      initiative('mars', { etat: 'prevue', prevuePour: '2026-03-20' }),
    ];
    expect(prevues(liste).map((i) => i.id)).toEqual(['mars', 'avril']);
  });
});

describe('cycle de vie d’une initiative', () => {
  it('passe d’idée à prévue, puis à vécue avec son souvenir', () => {
    const idee = initiative('a');

    const programmee = programmer(idee, '2026-03-20');
    expect(programmee.etat).toBe('prevue');
    expect(programmee.prevuePour).toBe('2026-03-20');

    const vecue = marquerVecue(
      programmee,
      '  On a ri tout le repas.  ',
      MAINTENANT,
    );
    expect(vecue.etat).toBe('vecue');
    expect(vecue.vecueLe).toBe(MAINTENANT);
    expect(vecue.souvenir).toBe('On a ri tout le repas.');
  });

  it('n’efface pas un souvenir déjà écrit quand on n’en fournit pas', () => {
    const avec = initiative('a', { etat: 'vecue', souvenir: 'Beau moment' });
    expect(marquerVecue(avec, '   ', MAINTENANT).souvenir).toBe('Beau moment');
  });
});

describe('résumé', () => {
  it('compte les sorties vécues et les catégories explorées', () => {
    const liste = [
      initiative('a', {
        etat: 'vecue',
        vecueLe: '2026-03-10T20:00:00.000Z',
        categorie: 'restaurant',
      }),
      initiative('b', {
        etat: 'vecue',
        vecueLe: '2026-02-10T20:00:00.000Z',
        categorie: 'nature',
      }),
      initiative('c'),
    ];

    const resume = resumeJournal(liste, MAINTENANT);
    expect(resume.vecues).toBe(2);
    expect(resume.categoriesExplorees).toBe(2);
    expect(resume.depuisDerniere).toBe(5);
  });

  it('ne dit rien plutôt que zéro quand rien n’a été vécu', () => {
    expect(
      resumeJournal([initiative('a')], MAINTENANT).depuisDerniere,
    ).toBeUndefined();
  });
});

describe('aucun décompte par personne', () => {
  it('n’expose rien qui compterait qui propose le plus', () => {
    // Savoir « qui propose le plus » transformerait un élan en dette.
    const interdits = /parPartenaire|parPersonne|classement|qui/i;
    expect(Object.keys(moduleJournal).filter((n) => interdits.test(n))).toEqual([]);
  });

  it('donne le même résumé quel que soit celui qui a proposé', () => {
    const parLun = [
      initiative('a', {
        etat: 'vecue',
        vecueLe: '2026-03-10T20:00:00.000Z',
        proposeePar: ROCHAMBEAU,
      }),
    ];
    const parLautre = [
      initiative('a', {
        etat: 'vecue',
        vecueLe: '2026-03-10T20:00:00.000Z',
        proposeePar: GAELLE,
      }),
    ];

    expect(resumeJournal(parLun, MAINTENANT)).toEqual(
      resumeJournal(parLautre, MAINTENANT),
    );
  });
});
