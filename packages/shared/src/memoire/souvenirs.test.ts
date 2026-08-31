import { describe, expect, it } from 'vitest';
import {
  libelleAnniversaire,
  lieuxVisites,
  souvenirsDuJour,
  trierSouvenirs,
  type Souvenir,
} from './souvenirs';

const s = (jour: string, creeLe = `${jour}T10:00:00.000Z`) => ({ jour, creeLe });

const souvenir = (partiel: Partial<Souvenir>): Souvenir => ({
  id: 'x',
  sorte: 'moment',
  jour: '2024-09-14',
  creePar: 'a',
  creeLe: '2024-09-14T10:00:00.000Z',
  contenu: { titre: 'Un moment' },
  ...partiel,
});

describe('tri', () => {
  it('rend le plus récent d’abord', () => {
    const tries = trierSouvenirs([s('2024-01-02'), s('2026-03-04'), s('2025-06-07')]);
    expect(tries.map((x) => x.jour)).toEqual([
      '2026-03-04',
      '2025-06-07',
      '2024-01-02',
    ]);
  });

  it('départage deux souvenirs du même jour par leur saisie', () => {
    const tries = trierSouvenirs([
      s('2026-03-04', '2026-03-04T08:00:00.000Z'),
      s('2026-03-04', '2026-03-04T20:00:00.000Z'),
    ]);
    expect(tries[0]!.creeLe).toBe('2026-03-04T20:00:00.000Z');
  });
});

describe('il y a un an', () => {
  it('retrouve les souvenirs du même jour, les années passées', () => {
    const trouves = souvenirsDuJour(
      [s('2025-09-14'), s('2023-09-14'), s('2025-09-15')],
      '2026-09-14',
    );
    expect(trouves.map((a) => a.ans).sort()).toEqual([1, 3]);
  });

  it('ignore aujourd’hui et le futur', () => {
    // Un souvenir d'aujourd'hui n'est pas un anniversaire, c'est le présent.
    expect(souvenirsDuJour([s('2026-09-14')], '2026-09-14')).toHaveLength(0);
    expect(souvenirsDuJour([s('2027-09-14')], '2026-09-14')).toHaveLength(0);
  });

  it('ne perd pas le 29 février les années ordinaires', () => {
    // Le laisser disparaître trois années sur quatre ferait manquer les
    // souvenirs qu'on a justement le plus envie de revoir.
    expect(souvenirsDuJour([s('2024-02-29')], '2026-03-01')).toHaveLength(1);
    // L'année bissextile, il revient à sa vraie date et pas le 1er mars.
    expect(souvenirsDuJour([s('2024-02-29')], '2028-02-29')).toHaveLength(1);
    expect(souvenirsDuJour([s('2024-02-29')], '2028-03-01')).toHaveLength(0);
  });

  it('ne lève pas sur une date illisible', () => {
    expect(() => souvenirsDuJour([s('pas une date')], '2026-09-14')).not.toThrow();
    expect(souvenirsDuJour([s('2025-09-14')], 'pas une date')).toEqual([]);
  });
});

describe('libellé', () => {
  it('accorde le singulier', () => {
    expect(libelleAnniversaire(1)).toBe('il y a un an');
    expect(libelleAnniversaire(3)).toBe('il y a 3 ans');
  });
});

describe('Love Map', () => {
  it('ne retient que les lieux réellement situés', () => {
    const liste = [
      souvenir({ id: 'a', sorte: 'lieu', contenu: { titre: 'Plage', latitude: 6.1, longitude: 1.2 } }),
      souvenir({ id: 'b', sorte: 'lieu', contenu: { titre: 'Sans coordonnées' } }),
      souvenir({ id: 'c', sorte: 'moment', contenu: { titre: 'Un dîner' } }),
    ];
    expect(lieuxVisites(liste).map((l) => l.id)).toEqual(['a']);
  });
});
