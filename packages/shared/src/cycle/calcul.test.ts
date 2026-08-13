import { describe, expect, it } from 'vitest';
import type { Regles } from '../types/cycle';
import {
  DUREE_CYCLE_DEFAUT,
  DUREE_CYCLE_MAX,
  DUREE_CYCLE_MIN,
  DUREE_REGLES_DEFAUT,
  estimer,
  etatDuCycle,
  frisePhases,
  jourOvulation,
  phasePourJour,
} from './calcul';

const MAINTENANT = '2026-03-15T12:00:00.000Z';

const regles = (debutLe: string, finLe?: string): Regles => ({
  id: debutLe,
  debutLe,
  finLe,
  saisiLe: `${debutLe}T08:00:00.000Z`,
});

describe('estimations', () => {
  it('retombe sur les valeurs par défaut sans historique', () => {
    const e = estimer([]);
    expect(e.dureeCycle).toBe(DUREE_CYCLE_DEFAUT);
    expect(e.dureeRegles).toBe(DUREE_REGLES_DEFAUT);
    expect(e.cyclesObserves).toBe(0);
    expect(e.fiable).toBe(false);
  });

  it('ne parle de prévision fiable qu’à partir de deux cycles observés', () => {
    expect(estimer([regles('2026-02-01'), regles('2026-03-01')]).fiable).toBe(false);
    expect(
      estimer([regles('2026-01-04'), regles('2026-02-01'), regles('2026-03-01')])
        .fiable,
    ).toBe(true);
  });

  it('moyenne les intervalles réellement observés', () => {
    // 30 puis 28 jours → 29 en moyenne.
    const e = estimer([
      regles('2026-01-04'),
      regles('2026-02-03'),
      regles('2026-03-03'),
    ]);
    expect(e.dureeCycle).toBe(29);
    expect(e.cyclesObserves).toBe(2);
  });

  it('écarte les intervalles aberrants plutôt que de fausser la moyenne', () => {
    // Une saisie oubliée crée un « cycle » de 90 jours : on l'ignore.
    const e = estimer([
      regles('2025-12-01'),
      regles('2026-03-01'),
      regles('2026-03-29'),
    ]);
    expect(e.dureeCycle).toBe(28);
    expect(e.cyclesObserves).toBe(1);
  });

  it('borne la durée dans des limites physiologiques', () => {
    const e = estimer([regles('2026-03-01'), regles('2026-03-02')]);
    expect(e.dureeCycle).toBeGreaterThanOrEqual(DUREE_CYCLE_MIN);
    expect(e.dureeCycle).toBeLessThanOrEqual(DUREE_CYCLE_MAX);
  });

  it('déduit la durée des règles quand la fin est saisie', () => {
    const e = estimer([regles('2026-03-01', '2026-03-06')]);
    expect(e.dureeRegles).toBe(6);
  });
});

describe('phases', () => {
  const standard = estimer([]);

  it('attribue exactement une phase à chaque jour du cycle', () => {
    for (let duree = DUREE_CYCLE_MIN; duree <= DUREE_CYCLE_MAX; duree++) {
      const estimations = { ...standard, dureeCycle: duree };
      for (let jour = 1; jour <= duree; jour++) {
        expect(phasePourJour(jour, estimations)).toBeTruthy();
      }
    }
  });

  it('suit l’ordre attendu sur un cycle de 28 jours', () => {
    expect(phasePourJour(1, standard)).toBe('menstruelle');
    expect(phasePourJour(5, standard)).toBe('menstruelle');
    expect(phasePourJour(8, standard)).toBe('folliculaire');
    expect(phasePourJour(14, standard)).toBe('ovulatoire');
    expect(phasePourJour(20, standard)).toBe('luteale');
    expect(phasePourJour(27, standard)).toBe('spm');
  });

  it('place l’ovulation quatorze jours avant la fin du cycle', () => {
    expect(jourOvulation({ ...standard, dureeCycle: 28 })).toBe(14);
    expect(jourOvulation({ ...standard, dureeCycle: 35 })).toBe(21);
  });

  it('ne laisse ni trou ni chevauchement sur un cycle court', () => {
    // Un cycle de 21 jours écrase la phase folliculaire : la précédence doit
    // malgré tout rendre une frise continue.
    const frise = frisePhases({ ...standard, dureeCycle: 21, dureeRegles: 5 });

    expect(frise[0]?.debut).toBe(1);
    expect(frise[frise.length - 1]?.fin).toBe(21);
    for (let i = 1; i < frise.length; i++) {
      expect(frise[i]!.debut).toBe(frise[i - 1]!.fin + 1);
    }
  });

  it('commence toujours la frise par les règles et la finit par le SPM', () => {
    const frise = frisePhases(standard);
    expect(frise[0]?.phase).toBe('menstruelle');
    expect(frise[frise.length - 1]?.phase).toBe('spm');
  });
});

describe('état courant', () => {
  it('ne rend rien tant qu’aucune date n’a été saisie', () => {
    expect(etatDuCycle([], MAINTENANT)).toBeUndefined();
  });

  it('compte le premier jour des règles comme le jour 1', () => {
    const etat = etatDuCycle([regles('2026-03-15')], MAINTENANT);
    expect(etat?.jourDuCycle).toBe(1);
    expect(etat?.phase).toBe('menstruelle');
  });

  it('projette les prochaines règles depuis la durée estimée', () => {
    const etat = etatDuCycle([regles('2026-03-01')], MAINTENANT);
    expect(etat?.prochainesReglesLe).toBe('2026-03-29');
    expect(etat?.joursAvantProchaines).toBe(14);
  });

  it('ignore une date de règles postérieure à aujourd’hui', () => {
    expect(etatDuCycle([regles('2026-04-01')], MAINTENANT)).toBeUndefined();
  });

  it('signale un cycle qui s’allonge, sans rien en conclure', () => {
    const enRetard = etatDuCycle([regles('2026-01-20')], MAINTENANT);
    expect(enRetard?.cycleInhabituellementLong).toBe(true);
    // La phase reste la dernière connue : on ne redémarre pas un cycle tout seul.
    expect(enRetard?.phase).toBe('spm');
  });

  it('reste dans une phase valide bien au-delà de la durée estimée', () => {
    const etat = etatDuCycle([regles('2026-02-01')], MAINTENANT);
    expect(etat?.jourDuCycle).toBeGreaterThan(28);
    expect(etat?.phase).toBe('spm');
  });
});
