/**
 * La durée annoncée par la personne concernée prime sur la moyenne calculée.
 *
 * Avec une seule date saisie, il n'existe aucun intervalle à moyenner :
 * l'app retombait sur 28 jours et présentait ce chiffre comme le sien.
 */
import { describe, expect, it } from 'vitest';
import { DUREE_CYCLE_MAX, DUREE_CYCLE_MIN, estimer, etatDuCycle } from './calcul';
import type { Regles } from '../types/cycle';

const regles = (dates: string[]): Regles[] =>
  dates.map((debutLe, i) => ({
    id: `r${i}`,
    debutLe,
    saisiLe: `${debutLe}T08:00:00.000Z`,
  }));

describe('durée de cycle annoncée', () => {
  it('remplace le défaut quand rien n’est encore observable', () => {
    const uneSeule = regles(['2026-08-01']);

    expect(estimer(uneSeule).dureeCycle).toBe(28);
    expect(estimer(uneSeule).dureeAnnoncee).toBe(false);

    expect(estimer(uneSeule, 30).dureeCycle).toBe(30);
    expect(estimer(uneSeule, 30).dureeAnnoncee).toBe(true);
  });

  it('prime sur la moyenne observée', () => {
    // L'app n'a pas à contredire quelqu'un sur son propre cycle.
    const observees = regles(['2026-06-01', '2026-06-29', '2026-07-27']);
    expect(estimer(observees).dureeCycle).toBe(28);
    expect(estimer(observees, 31).dureeCycle).toBe(31);
  });

  it('borne une valeur aberrante au lieu de la propager', () => {
    const uneSeule = regles(['2026-08-01']);
    expect(estimer(uneSeule, 3).dureeCycle).toBe(DUREE_CYCLE_MIN);
    expect(estimer(uneSeule, 400).dureeCycle).toBe(DUREE_CYCLE_MAX);
  });

  it('cesse d’annoncer une simple estimation', () => {
    // « Repère indicatif » à quelqu'un qui vient de donner sa durée sonne
    // comme un doute sur ce qu'elle vient de dire.
    const uneSeule = regles(['2026-08-01']);
    expect(estimer(uneSeule).fiable).toBe(false);
    expect(estimer(uneSeule, 30).fiable).toBe(true);
  });

  it('décale les prochaines règles d’autant', () => {
    const uneSeule = regles(['2026-08-01']);
    const parDefaut = etatDuCycle(uneSeule, '2026-08-10T12:00:00.000Z');
    const annoncee = etatDuCycle(uneSeule, '2026-08-10T12:00:00.000Z', 30);

    expect(parDefaut?.prochainesReglesLe).toBe('2026-08-29');
    expect(annoncee?.prochainesReglesLe).toBe('2026-08-31');
  });
});
