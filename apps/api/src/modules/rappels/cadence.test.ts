/**
 * La cadence du balayage, et son extinction.
 *
 * Écrit après la panne où ce balayage — toutes les cinq minutes, sur une base
 * qui s'endort au bout de cinq minutes — a tenu Neon éveillé jour et nuit
 * jusqu'à épuiser le quota du palier gratuit.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  INTERVALLE_RAPPELS_MS,
  demarrerLePlanificateur,
  intervalleDepuisEnv,
} from './planificateur.ts';
import { creerDepotMemoire } from '../../domaine/depotMemoire.ts';

describe('la cadence du balayage', () => {
  it('vaut cinq minutes sans réglage', () => {
    expect(intervalleDepuisEnv({})).toBe(INTERVALLE_RAPPELS_MS);
    expect(intervalleDepuisEnv({ LONLONBENU_RAPPELS_INTERVALLE_MIN: '' })).toBe(
      INTERVALLE_RAPPELS_MS,
    );
  });

  it('se règle en minutes', () => {
    expect(
      intervalleDepuisEnv({ LONLONBENU_RAPPELS_INTERVALLE_MIN: '30' }),
    ).toBe(30 * 60_000);
  });

  it('s’éteint à zéro', () => {
    expect(intervalleDepuisEnv({ LONLONBENU_RAPPELS_INTERVALLE_MIN: '0' })).toBe(0);
  });

  it('garde cinq minutes devant une valeur illisible', () => {
    const chut = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(
      intervalleDepuisEnv({ LONLONBENU_RAPPELS_INTERVALLE_MIN: 'beaucoup' }),
    ).toBe(INTERVALLE_RAPPELS_MS);
    expect(
      intervalleDepuisEnv({ LONLONBENU_RAPPELS_INTERVALLE_MIN: '-5' }),
    ).toBe(INTERVALLE_RAPPELS_MS);
    chut.mockRestore();
  });

  it('à zéro, n’interroge jamais la base', async () => {
    vi.useFakeTimers();
    const depot = creerDepotMemoire();
    const espion = vi.spyOn(depot.couples, 'actifs');

    const arreter = demarrerLePlanificateur(
      depot,
      { envoyer: async () => undefined } as never,
      0,
    );
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(espion).not.toHaveBeenCalled();
    arreter();
    vi.useRealTimers();
  });
});
