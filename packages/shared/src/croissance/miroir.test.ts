import { describe, expect, it } from 'vitest';
import type { AxeCroissance } from '../types/croissance';
import {
  axeVisiblePar,
  deposerContribution,
  etatMiroir,
  peutLireContribution,
  verifierMiroir,
} from './miroir';

const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';
const T0 = '2026-01-01T10:00:00.000Z';

const AXE_VIERGE: AxeCroissance = {
  id: 'axe-1',
  theme: 'communication',
  titre: 'Se dire les choses plus tôt',
  ouvertPar: ROCHAMBEAU,
  ouvertLe: T0,
  contributions: [],
};

const ecrit = (axe: AxeCroissance, qui: string) =>
  deposerContribution(axe, qui, `ressenti de ${qui}`, `besoin de ${qui}`, T0);

describe('état du miroir', () => {
  it('suit les quatre étapes', () => {
    expect(etatMiroir(AXE_VIERGE, ROCHAMBEAU)).toBe('vierge');

    const unSeul = ecrit(AXE_VIERGE, ROCHAMBEAU);
    expect(etatMiroir(unSeul, ROCHAMBEAU)).toBe('en_attente_de_lautre');
    expect(etatMiroir(unSeul, GAELLE)).toBe('en_attente_de_moi');

    const lesDeux = ecrit(unSeul, GAELLE);
    expect(etatMiroir(lesDeux, ROCHAMBEAU)).toBe('complet');
    expect(etatMiroir(lesDeux, GAELLE)).toBe('complet');
  });
});

describe('miroir : personne ne lit sans avoir écrit', () => {
  it('couvre la contribution de l’autre tant que je n’ai pas écrit', () => {
    const unSeul = ecrit(AXE_VIERGE, ROCHAMBEAU);

    expect(peutLireContribution(unSeul, ROCHAMBEAU, ROCHAMBEAU)).toBe(true);
    expect(peutLireContribution(unSeul, GAELLE, ROCHAMBEAU)).toBe(false);
    expect(axeVisiblePar(unSeul, GAELLE).contributions).toHaveLength(0);
  });

  it('laisse voir QUE l’autre a écrit, sans laisser voir ce qu’il a écrit', () => {
    const unSeul = ecrit(AXE_VIERGE, ROCHAMBEAU);
    const vuParGaelle = axeVisiblePar(unSeul, GAELLE);

    expect(vuParGaelle.lautreAContribue).toBe(true);
    expect(vuParGaelle.etat).toBe('en_attente_de_moi');
    expect(JSON.stringify(vuParGaelle)).not.toContain('ressenti de rochambeau');
  });

  it('découvre les deux côtés en même temps', () => {
    const lesDeux = ecrit(ecrit(AXE_VIERGE, ROCHAMBEAU), GAELLE);

    expect(axeVisiblePar(lesDeux, ROCHAMBEAU).contributions).toHaveLength(2);
    expect(axeVisiblePar(lesDeux, GAELLE).contributions).toHaveLength(2);
  });

  it('tient l’invariant sur les quatre combinaisons', () => {
    const combinaisons: AxeCroissance[] = [
      AXE_VIERGE,
      ecrit(AXE_VIERGE, ROCHAMBEAU),
      ecrit(AXE_VIERGE, GAELLE),
      ecrit(ecrit(AXE_VIERGE, ROCHAMBEAU), GAELLE),
    ];

    for (const axe of combinaisons) {
      expect(() => verifierMiroir(axe, ROCHAMBEAU, GAELLE)).not.toThrow();

      // L'invariant porte sur ce que chacun voit DE L'AUTRE. Voir son propre
      // texte n'est pas une asymétrie : on ne s'observe pas soi-même.
      expect(peutLireContribution(axe, ROCHAMBEAU, GAELLE)).toBe(
        peutLireContribution(axe, GAELLE, ROCHAMBEAU),
      );

      // Et chacun voit toujours au moins ce qu'il a écrit lui-même.
      for (const [qui, axeVu] of [
        [ROCHAMBEAU, axeVisiblePar(axe, ROCHAMBEAU)],
        [GAELLE, axeVisiblePar(axe, GAELLE)],
      ] as const) {
        const mienne = axe.contributions.some((c) => c.partenaireId === qui);
        expect(axeVu.contributions.some((c) => c.partenaireId === qui)).toBe(
          mienne,
        );
      }
    }
  });

  it('détecte un axe trafiqué qui exposerait l’autre à sens unique', () => {
    // On force un état que l'API ne permet pas de construire, pour vérifier que
    // l'assertion sert vraiment de garde-fou.
    const trafique = {
      ...AXE_VIERGE,
      contributions: [
        { partenaireId: GAELLE, ressenti: 'x', besoin: 'y', majLe: T0 },
        { partenaireId: GAELLE, ressenti: 'x', besoin: 'y', majLe: T0 },
      ],
    } satisfies AxeCroissance;

    expect(() => verifierMiroir(trafique, ROCHAMBEAU, GAELLE)).toThrow(
      /sans avoir contribué/,
    );
  });
});

describe('dépôt de contribution', () => {
  it('remplace la contribution existante au lieu de l’empiler', () => {
    const axe = ecrit(AXE_VIERGE, ROCHAMBEAU);
    const revise = deposerContribution(
      axe,
      ROCHAMBEAU,
      'ressenti revu',
      'besoin revu',
      T0,
    );

    expect(revise.contributions).toHaveLength(1);
    expect(revise.contributions[0]?.ressenti).toBe('ressenti revu');
  });

  it('refuse un troisième contributeur', () => {
    const lesDeux = ecrit(ecrit(AXE_VIERGE, ROCHAMBEAU), GAELLE);
    expect(() => deposerContribution(lesDeux, 'intrus', 'a', 'b', T0)).toThrow();
  });

  it('nettoie les espaces superflus', () => {
    const axe = deposerContribution(AXE_VIERGE, GAELLE, '  vécu  ', ' besoin ', T0);
    expect(axe.contributions[0]?.ressenti).toBe('vécu');
    expect(axe.contributions[0]?.besoin).toBe('besoin');
  });
});

describe('marquage de ma propre contribution', () => {
  it('désigne la mienne sans que le client ait à comparer des identifiants', () => {
    const axe = deposerContribution(
      deposerContribution(AXE_VIERGE, ROCHAMBEAU, 'lui', 'son besoin'),
      GAELLE,
      'elle',
      'son besoin',
    );

    for (const [lecteur, sien] of [
      [ROCHAMBEAU, 'lui'],
      [GAELLE, 'elle'],
    ] as const) {
      const vue = axeVisiblePar(axe, lecteur);
      expect(vue.contributions.find((c) => c.estLaMienne)?.ressenti).toBe(sien);
      expect(vue.contributions.filter((c) => c.estLaMienne)).toHaveLength(1);
    }
  });

  it('marque la mienne même quand le miroir est incomplet', () => {
    const axe = deposerContribution(AXE_VIERGE, ROCHAMBEAU, 'lui', 'besoin');
    const vue = axeVisiblePar(axe, ROCHAMBEAU);

    expect(vue.contributions).toHaveLength(1);
    expect(vue.contributions[0]?.estLaMienne).toBe(true);
  });
});
