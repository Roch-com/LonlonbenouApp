import { describe, expect, it } from 'vitest';
import { controlerNomEspace, propositionsNomEspace } from './espace';

describe('propositions de nom', () => {
  it('retrouve le nom du couple pilote', () => {
    expect(propositionsNomEspace('Rochambeau', 'Gaëlle')).toContain('Rochaelle');
  });

  it('propose toujours un repli utilisable', () => {
    for (const [a, b] of [
      ['Léa', 'Tom'],
      ['Yu', 'Bo'],
      ['Jean-Baptiste', 'Marie'],
      ['Ada', 'Ève'],
    ]) {
      const propositions = propositionsNomEspace(a!, b!);
      expect(propositions.length).toBeGreaterThan(0);
      expect(propositions).toContain('Notre espace');
    }
  });

  it('ne propose rien si un prénom manque', () => {
    expect(propositionsNomEspace('', 'Gaëlle')).toEqual([]);
    expect(propositionsNomEspace('  ', '  ')).toEqual([]);
  });

  it('ne répète pas deux fois la même idée', () => {
    const propositions = propositionsNomEspace('Camille', 'Camille');
    const uniques = new Set(propositions.map((p) => p.toLowerCase()));
    expect(uniques.size).toBe(propositions.length);
  });

  it('reste dans une longueur affichable', () => {
    for (const p of propositionsNomEspace('Maximilienne', 'Barthélémy')) {
      expect(p.length).toBeLessThanOrEqual(24);
    }
  });
});

describe('contrôle du nom saisi', () => {
  it('accepte un nom court mais réel', () => {
    expect(controlerNomEspace('Nous').valide).toBe(true);
    expect(controlerNomEspace('  Rochaelle  ').valide).toBe(true);
  });

  it('refuse le vide et l’excessif, en expliquant', () => {
    expect(controlerNomEspace(' ').valide).toBe(false);
    expect(controlerNomEspace('a'.repeat(30)).message).toContain('24');
  });
});
