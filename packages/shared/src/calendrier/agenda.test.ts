import { describe, expect, it } from 'vitest';
import type { Evenement } from '../types/calendrier';
import {
  estPasse,
  evenementsAVenir,
  evenementsPasses,
  grouperParJour,
  quand,
} from './agenda';

const MAINTENANT = '2026-03-15T12:00:00.000Z';

const evenement = (
  id: string,
  debut: string,
  modifications: Partial<Evenement> = {},
): Evenement => ({
  id,
  titre: `Événement ${id}`,
  categorie: 'a_deux',
  debut,
  journeeEntiere: !debut.includes('T'),
  creePar: 'rochambeau',
  creeLe: '2026-03-01T10:00:00.000Z',
  visibilite: 'couple',
  ...modifications,
});

describe('passé et à venir', () => {
  it('sépare selon l’instant courant', () => {
    const liste = [
      evenement('a', '2026-03-10T18:00:00.000Z'),
      evenement('b', '2026-03-20T18:00:00.000Z'),
    ];

    expect(evenementsAVenir(liste, MAINTENANT).map((e) => e.id)).toEqual(['b']);
    expect(evenementsPasses(liste, MAINTENANT).map((e) => e.id)).toEqual(['a']);
  });

  it('tient compte de l’heure de fin quand elle existe', () => {
    const enCours = evenement('c', '2026-03-15T09:00:00.000Z', {
      fin: '2026-03-15T18:00:00.000Z',
    });
    expect(estPasse(enCours, MAINTENANT)).toBe(false);
  });

  it('traite une journée entière comme le jour civil', () => {
    expect(estPasse(evenement('d', '2026-03-15'), MAINTENANT)).toBe(false);
    expect(estPasse(evenement('e', '2026-03-14'), MAINTENANT)).toBe(true);
  });

  it('rend les prochains dans l’ordre, et sait se limiter', () => {
    const liste = [
      evenement('loin', '2026-04-01T10:00:00.000Z'),
      evenement('proche', '2026-03-16T10:00:00.000Z'),
      evenement('moyen', '2026-03-20T10:00:00.000Z'),
    ];

    expect(evenementsAVenir(liste, MAINTENANT).map((e) => e.id)).toEqual([
      'proche',
      'moyen',
      'loin',
    ]);
    expect(evenementsAVenir(liste, MAINTENANT, 2)).toHaveLength(2);
  });

  it('rend le passé du plus récent au plus ancien', () => {
    const liste = [
      evenement('vieux', '2026-01-01T10:00:00.000Z'),
      evenement('recent', '2026-03-14T10:00:00.000Z'),
    ];
    expect(evenementsPasses(liste, MAINTENANT).map((e) => e.id)).toEqual([
      'recent',
      'vieux',
    ]);
  });
});

describe('regroupement par jour', () => {
  it('rassemble les événements d’un même jour, sans jour vide', () => {
    const groupes = grouperParJour([
      evenement('matin', '2026-03-16T09:00:00.000Z'),
      evenement('soir', '2026-03-16T20:00:00.000Z'),
      evenement('autre', '2026-03-18T09:00:00.000Z'),
    ]);

    expect(groupes.map((g) => g.jour)).toEqual(['2026-03-16', '2026-03-18']);
    expect(groupes[0]?.evenements.map((e) => e.id)).toEqual(['matin', 'soir']);
  });

  it('mêle journées entières et horaires', () => {
    const groupes = grouperParJour([
      evenement('journee', '2026-03-16'),
      evenement('rdv', '2026-03-16T14:00:00.000Z'),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.evenements).toHaveLength(2);
  });
});

describe('libellé relatif', () => {
  it('reste humain sur les jours proches', () => {
    expect(quand('2026-03-15', MAINTENANT)).toBe('aujourd’hui');
    expect(quand('2026-03-16', MAINTENANT)).toBe('demain');
    expect(quand('2026-03-14', MAINTENANT)).toBe('hier');
    expect(quand('2026-03-18', MAINTENANT)).toBe('dans 3 jours');
    expect(quand('2026-03-12', MAINTENANT)).toBe('il y a 3 jours');
  });

  it('passe à la date au-delà d’une semaine', () => {
    expect(quand('2026-04-02', MAINTENANT)).toContain('avril');
  });
});
