import { describe, expect, it } from 'vitest';
import type { Confidence } from '../types/confidences';
import {
  confidencesVisiblesPar,
  envoyer,
  estBrouillon,
  nonLues,
} from './confidences';

const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';
const T0 = '2026-01-01T10:00:00.000Z';

const brouillon: Confidence = {
  id: 'l-1',
  auteurId: GAELLE,
  type: 'lettre',
  titre: 'Ce que je n’arrive pas à te dire',
  texte: 'J’ai eu peur ces dernières semaines.',
  creeLe: T0,
  visibilite: 'prive',
};

const gratitude: Confidence = {
  id: 'g-1',
  auteurId: ROCHAMBEAU,
  type: 'gratitude',
  texte: 'Merci d’avoir pris le relais hier.',
  creeLe: T0,
  envoyeeLe: T0,
  visibilite: 'couple',
};

describe('brouillons', () => {
  it('reste invisible pour le partenaire, quoi qu’il arrive', () => {
    expect(confidencesVisiblesPar([brouillon], ROCHAMBEAU)).toHaveLength(0);
    expect(confidencesVisiblesPar([brouillon], GAELLE)).toHaveLength(1);
    expect(estBrouillon(brouillon)).toBe(true);
  });

  it('ne devient lisible qu’après un envoi explicite', () => {
    const envoyee = envoyer(brouillon, T0);
    expect(confidencesVisiblesPar([envoyee], ROCHAMBEAU)).toHaveLength(1);
    expect(envoyee.envoyeeLe).toBe(T0);
  });

  it('refuse d’envoyer un texte vide', () => {
    expect(() => envoyer({ ...brouillon, texte: '   ' })).toThrow();
  });

  it('n’écrase pas la date d’un envoi déjà fait', () => {
    const envoyee = envoyer(brouillon, T0);
    expect(envoyer(envoyee, '2026-02-02T10:00:00.000Z').envoyeeLe).toBe(T0);
  });
});

describe('lecture symétrique', () => {
  it('donne exactement la même chose aux deux une fois envoyée', () => {
    const vuParR = confidencesVisiblesPar([gratitude], ROCHAMBEAU);
    const vuParG = confidencesVisiblesPar([gratitude], GAELLE);
    expect(vuParR).toEqual(vuParG);
  });

  it('filtre par type sans jamais élargir la visibilité', () => {
    const tout = [brouillon, gratitude];
    expect(confidencesVisiblesPar(tout, ROCHAMBEAU, 'lettre')).toHaveLength(0);
    expect(confidencesVisiblesPar(tout, ROCHAMBEAU, 'gratitude')).toHaveLength(1);
    expect(confidencesVisiblesPar(tout, GAELLE, 'lettre')).toHaveLength(1);
  });

  it('ne compte comme non lu que ce qu’on a reçu', () => {
    const tout = [brouillon, gratitude];
    expect(nonLues(tout, GAELLE).map((c) => c.id)).toEqual(['g-1']);
    // Rochambeau est l'auteur de la gratitude : elle ne lui est pas « non lue ».
    expect(nonLues(tout, ROCHAMBEAU)).toHaveLength(0);
  });
});
