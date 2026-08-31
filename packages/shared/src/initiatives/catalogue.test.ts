import { describe, expect, it } from 'vitest';
import { CATALOGUE, suggestions } from './catalogue';
import {
  historiqueHebdomadaire,
  lectureTendance,
  SEMAINES_HISTORIQUE,
  type PointHistorique,
} from '../score/historique';
import type { Geste } from '../score/gestes';

describe('catalogue', () => {
  it('filtre sur ce qu’on demande', () => {
    const gratuites = suggestions({ budget: 'rien' }, 20);
    expect(gratuites.length).toBeGreaterThan(0);
    for (const idee of gratuites) expect(idee.budget).toBe('rien');
  });

  it('croise plusieurs critères', () => {
    const trouvees = suggestions(
      { budget: 'rien', duree: 'une_heure', energie: 'douce' },
      20,
    );
    for (const idee of trouvees) {
      expect(idee.budget).toBe('rien');
      expect(idee.duree).toBe('une_heure');
      expect(idee.energie).toBe('douce');
    }
  });

  it('propose quand même quelque chose si rien ne correspond', () => {
    // Un filtre trop étroit ne doit pas donner l'impression qu'il n'y a rien
    // à faire ensemble.
    const trouvees = suggestions(
      { budget: 'consequent', duree: 'une_heure', energie: 'douce' },
      3,
    );
    expect(trouvees.length).toBe(3);
  });

  it('met les inédites devant sans masquer le reste', () => {
    // On peut vouloir refaire ce qu'on a aimé : rien n'est retiré.
    const dejaVus = [CATALOGUE[0]!.titre];
    const trouvees = suggestions({ dejaVus }, CATALOGUE.length);
    expect(trouvees).toHaveLength(CATALOGUE.length);
    expect(trouvees.at(-1)!.titre).toBe(CATALOGUE[0]!.titre);
  });

  it('ne déduit rien de l’état du couple', () => {
    // Proposer une sortie parce que le score baisse transformerait une idée
    // en rappel à l'ordre. Les critères ne portent que sur la disponibilité.
    const criteres = suggestions.length;
    expect(criteres).toBeLessThanOrEqual(2);
  });
});

describe('historique du score', () => {
  const A = 'rochambeau';
  const B = 'gaelle';
  const DUO: readonly [string, string] = [A, B];

  const geste = (faitLe: string, auteurId: string): Geste => ({
    auteurId,
    type: 'message',
    faitLe,
  });

  it('rend une valeur par semaine, la plus ancienne en tête', () => {
    const points = historiqueHebdomadaire([], DUO, '2026-09-14T12:00:00.000Z');
    expect(points).toHaveLength(SEMAINES_HISTORIQUE);
    expect(points[0]!.jour < points.at(-1)!.jour).toBe(true);
  });

  it('n’inclut pas les gestes postérieurs à un point', () => {
    // Sinon la courbe entière changerait de forme à chaque nouveau geste.
    const points = historiqueHebdomadaire(
      [geste('2026-09-14T10:00:00.000Z', A)],
      DUO,
      '2026-09-14T12:00:00.000Z',
      3,
    );
    expect(points[0]!.valeur).toBe(0);
  });

  it('ne rend aucune série par personne', () => {
    // Le §8.8 interdit de noter les personnes ; deux courbes côte à côte
    // remettraient exactement ce jugement.
    const points = historiqueHebdomadaire([], DUO, '2026-09-14T12:00:00.000Z', 2);
    for (const point of points) {
      expect(Object.keys(point).sort()).toEqual(['jour', 'valeur']);
    }
  });
});

describe('tendance', () => {
  const points = (valeurs: number[]): PointHistorique[] =>
    valeurs.map((valeur, i) => ({ jour: `2026-09-0${i + 1}`, valeur }));

  it('ne commente pas le bruit', () => {
    // Le score bouge de quelques points sans que rien n'ait changé.
    expect(lectureTendance(points([50, 52, 47, 53])).tendance).toBe('stable');
  });

  it('reconnaît une vraie variation', () => {
    expect(lectureTendance(points([30, 40, 55])).tendance).toBe('monte');
    expect(lectureTendance(points([70, 55, 40])).tendance).toBe('descend');
  });

  it('ne reproche rien quand ça descend', () => {
    // Une courbe descendante est une accusation muette si on la laisse seule.
    const lecture = lectureTendance(points([70, 55, 40])).lecture;
    expect(lecture).not.toMatch(/effort|attention|devriez|manque de/i);
    expect(lecture).toContain('pas ce que vous valez');
  });

  it('reste stable sur trop peu de points', () => {
    expect(lectureTendance(points([10, 90])).tendance).toBe('stable');
  });
});
