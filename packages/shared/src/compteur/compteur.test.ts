import { describe, expect, it } from 'vitest';
import { joursEnsemble, prochainJalon } from './compteur';

describe('joursEnsemble', () => {
  it('vaut 0 le jour même', () => {
    expect(joursEnsemble('2024-02-14', '2024-02-14')).toBe(0);
  });

  it('ignore l’heure de la journée', () => {
    expect(joursEnsemble('2024-02-14', '2024-02-15T23:59:00.000Z')).toBe(1);
    expect(joursEnsemble('2024-02-14', '2024-02-15T00:01:00.000Z')).toBe(1);
  });

  it('traverse une année bissextile', () => {
    expect(joursEnsemble('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('prochainJalon', () => {
  it('vise la centaine suivante en début de relation', () => {
    const jalon = prochainJalon('2024-02-14', '2024-03-14');
    expect(jalon.type).toBe('centaine');
    expect(jalon.jour).toBe(100);
    expect(jalon.joursRestants).toBe(71);
  });

  it('propose l’anniversaire quand il tombe avant la centaine', () => {
    // 360 jours écoulés : l'anniversaire (366 j, année bissextile) précède 400.
    const jalon = prochainJalon('2024-02-14', '2025-02-08');
    expect(jalon.type).toBe('anniversaire');
    expect(jalon.libelle).toBe('1 an ensemble');
  });

  it('reste toujours dans le futur', () => {
    const jalon = prochainJalon('2024-02-14', '2026-08-09');
    expect(jalon.joursRestants).toBeGreaterThan(0);
  });
});
