import { describe, expect, it } from 'vitest';
import {
  DUREE_MAX_VOCAL_S,
  DUREE_MIN_VOCAL_S,
  dureeLisible,
  dureeVocalValide,
  progressionVocal,
} from './vocal';

describe('durée valide', () => {
  it('accepte les bornes', () => {
    expect(dureeVocalValide(DUREE_MIN_VOCAL_S)).toBe(true);
    expect(dureeVocalValide(DUREE_MAX_VOCAL_S)).toBe(true);
  });

  it('refuse un appui malencontreux et un monologue', () => {
    expect(dureeVocalValide(0.4)).toBe(false);
    expect(dureeVocalValide(DUREE_MAX_VOCAL_S + 1)).toBe(false);
  });

  it('refuse ce qui n’est pas un nombre', () => {
    expect(dureeVocalValide(Number.NaN)).toBe(false);
    expect(dureeVocalValide(Number.POSITIVE_INFINITY)).toBe(false);
    expect(dureeVocalValide(-5)).toBe(false);
  });
});

describe('durée lisible', () => {
  it('rembourre les secondes, pas les minutes', () => {
    expect(dureeLisible(7)).toBe('0:07');
    expect(dureeLisible(65)).toBe('1:05');
    expect(dureeLisible(105)).toBe('1:45');
  });

  it('arrondit plutôt que de tronquer', () => {
    expect(dureeLisible(6.6)).toBe('0:07');
  });

  it('ne rend jamais de durée négative', () => {
    expect(dureeLisible(-3)).toBe('0:00');
  });
});

describe('progression', () => {
  it('rend une fraction entre 0 et 1', () => {
    expect(progressionVocal(15, 60)).toBe(0.25);
  });

  it('borne un dépassement de fin de piste', () => {
    // Certains lecteurs rendent une position légèrement supérieure à la durée.
    expect(progressionVocal(61, 60)).toBe(1);
  });

  it('rend 0 sur une durée absente ou absurde', () => {
    expect(progressionVocal(10, 0)).toBe(0);
    expect(progressionVocal(10, Number.NaN)).toBe(0);
    expect(progressionVocal(Number.NaN, 60)).toBe(0);
  });
});
