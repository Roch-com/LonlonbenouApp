/**
 * Le cas qui fermait l'application : « 9 » complété en « 00009 » par
 * `padStart`, donc un horodatage que `toISOString` refusait de relire.
 */
import { describe, expect, it } from 'vitest';
import { horodatage, normaliserHeure } from './heures';

describe('normaliserHeure', () => {
  it('lit les formes qu’on tape vraiment', () => {
    expect(normaliserHeure('9')).toBe('09:00');
    expect(normaliserHeure('09')).toBe('09:00');
    expect(normaliserHeure('9:30')).toBe('09:30');
    expect(normaliserHeure('9h')).toBe('09:00');
    expect(normaliserHeure('9h30')).toBe('09:30');
    expect(normaliserHeure('0930')).toBe('09:30');
    expect(normaliserHeure('21:00')).toBe('21:00');
    expect(normaliserHeure(' 20 h 05 ')).toBe('20:05');
  });

  it('rend undefined plutôt qu’une chaîne douteuse', () => {
    // « 9 » et « 20h » passaient et devenaient « 00009 » et « 0020h ».
    for (const saisie of ['', 'midi', '25:00', '9:75', '99', 'abc', '-1']) {
      expect(normaliserHeure(saisie)).toBeUndefined();
    }
  });

  it('ne fabrique jamais un horodatage illisible', () => {
    for (const saisie of ['9', '20h', '0930', 'midi', '25:00', '']) {
      const heure = normaliserHeure(saisie);
      const iso = horodatage('2026-08-30', heure);
      if (iso === undefined) continue;
      // La garantie qui compte : ce que l'on construit se relit toujours.
      expect(Number.isNaN(Date.parse(iso))).toBe(false);
      expect(() => new Date(iso).toISOString()).not.toThrow();
    }
  });

  it('refuse un jour mal formé', () => {
    expect(horodatage('30-08-2026', '09:00')).toBeUndefined();
    expect(horodatage('2026-08-30', undefined)).toBeUndefined();
  });
});
