/**
 * Fonctionnement en miroir des axes de croissance — garde-fou n°1 de CLAUDE.md
 * appliqué au pôle ②. Même esprit que `privacy/reciprocite.ts`, mais au niveau
 * d'un axe : ici la réciprocité ne porte pas sur un consentement, elle porte sur
 * l'engagement.
 *
 * Règle unique, et tout en découle :
 *
 *   je vois toujours ma propre contribution ;
 *   je ne vois celle de l'autre que lorsque nous avons écrit tous les deux.
 *
 * Ce n'est pas de la rétention d'information, c'est ce qui rend l'exercice
 * honnête. Sans cette règle, le premier qui écrit s'expose seul, et le second
 * répond à ce qu'il vient de lire au lieu de dire ce qu'il vit. Et surtout :
 * personne ne peut ouvrir un axe pour lire l'autre sans se livrer — l'axe à
 * sens unique devient structurellement impossible.
 *
 * L'accès à un axe est par ailleurs conditionné au partage réciproque du module
 * `croissance` (`privacy/reciprocite.ts`) : les deux garde-fous se cumulent.
 */

import type { PartenaireId } from '../types/couple';
import type { AxeCroissance, ContributionAxe } from '../types/croissance';

export type EtatMiroir =
  /** Personne n'a encore écrit. */
  | 'vierge'
  /** L'autre a écrit, à moi de jouer — son texte reste couvert. */
  | 'en_attente_de_moi'
  /** J'ai écrit, j'attends l'autre. */
  | 'en_attente_de_lautre'
  /** Les deux ont écrit : tout est visible, des deux côtés. */
  | 'complet';

export function contributionDe(
  axe: AxeCroissance,
  partenaireId: PartenaireId,
): ContributionAxe | undefined {
  return axe.contributions.find((c) => c.partenaireId === partenaireId);
}

export function miroirComplet(axe: AxeCroissance): boolean {
  return axe.contributions.length >= 2;
}

export function etatMiroir(
  axe: AxeCroissance,
  moiId: PartenaireId,
): EtatMiroir {
  const jaiEcrit = !!contributionDe(axe, moiId);
  const lautreAEcrit = axe.contributions.some((c) => c.partenaireId !== moiId);

  if (jaiEcrit && lautreAEcrit) return 'complet';
  if (jaiEcrit) return 'en_attente_de_lautre';
  if (lautreAEcrit) return 'en_attente_de_moi';
  return 'vierge';
}

/**
 * Le lecteur peut-il lire la contribution de `auteurId` ?
 * Invariant : le résultat est le même dans les deux sens. Toujours.
 */
export function peutLireContribution(
  axe: AxeCroissance,
  lecteurId: PartenaireId,
  auteurId: PartenaireId,
): boolean {
  if (!contributionDe(axe, auteurId)) return false;
  if (lecteurId === auteurId) return true;
  return miroirComplet(axe);
}

/**
 * Contribution telle qu'elle est servie au lecteur. `estLaMienne` évite au
 * client d'avoir à comparer des identifiants pour savoir laquelle est la
 * sienne — et donc d'avoir à connaître celui de l'autre.
 */
export interface ContributionVisible extends ContributionAxe {
  estLaMienne: boolean;
}

export interface AxeVisible extends Omit<AxeCroissance, 'contributions'> {
  contributions: readonly ContributionVisible[];
  etat: EtatMiroir;
  /**
   * L'autre a-t-il déposé sa contribution ? Le fait, jamais le contenu.
   * C'est une information symétrique — les deux la voient au même moment — et
   * c'est elle qui permet d'inviter sans dévoiler.
   */
  lautreAContribue: boolean;
}

/**
 * L'axe tel que le lecteur a le droit de le voir : le texte de l'autre
 * disparaît tant que le miroir n'est pas complet, mais son existence, elle,
 * reste visible des deux côtés.
 */
export function axeVisiblePar(
  axe: AxeCroissance,
  lecteurId: PartenaireId,
): AxeVisible {
  return {
    ...axe,
    contributions: axe.contributions
      .filter((c) => peutLireContribution(axe, lecteurId, c.partenaireId))
      .map((c) => ({ ...c, estLaMienne: c.partenaireId === lecteurId })),
    etat: etatMiroir(axe, lecteurId),
    lautreAContribue: axe.contributions.some(
      (c) => c.partenaireId !== lecteurId,
    ),
  };
}

/**
 * Dépose ou remplace la contribution d'un partenaire.
 * Il n'existe aucun autre chemin d'écriture : c'est ce qui garantit qu'un axe
 * ne peut pas contenir deux contributions du même partenaire, ni celle d'un
 * tiers.
 */
export function deposerContribution(
  axe: AxeCroissance,
  partenaireId: PartenaireId,
  ressenti: string,
  besoin: string,
  horodatage: string = new Date().toISOString(),
): AxeCroissance {
  const contribution: ContributionAxe = {
    partenaireId,
    ressenti: ressenti.trim(),
    besoin: besoin.trim(),
    majLe: horodatage,
  };

  const existante = contributionDe(axe, partenaireId);
  const contributions = existante
    ? axe.contributions.map((c) =>
        c.partenaireId === partenaireId ? contribution : c,
      )
    : [...axe.contributions, contribution];

  if (contributions.length > 2) {
    throw new Error('Un axe n’accueille que les deux partenaires du couple');
  }

  return { ...axe, contributions };
}

/**
 * Assertion d'invariant, à appeler dans les tests de tout écran d'axe.
 * Lève si un axe expose une lecture à sens unique.
 */
export function verifierMiroir(
  axe: AxeCroissance,
  a: PartenaireId,
  b: PartenaireId,
): void {
  const aLitB = peutLireContribution(axe, a, b);
  const bLitA = peutLireContribution(axe, b, a);

  // Cas asymétrique légitime : une seule contribution existe, donc l'un n'a
  // rien à lire. Ce qui est interdit, c'est que les deux aient écrit et qu'un
  // seul puisse lire.
  const lesDeuxOntEcrit = !!contributionDe(axe, a) && !!contributionDe(axe, b);
  if (lesDeuxOntEcrit && aLitB !== bLitA) {
    throw new Error(
      `Miroir rompu sur l’axe « ${axe.titre} » : ${a}→${b}=${aLitB}, ${b}→${a}=${bLitA}`,
    );
  }

  // Et dans tous les cas : lire l'autre sans avoir écrit soi-même est exclu.
  for (const [lecteur, auteur] of [
    [a, b],
    [b, a],
  ] as const) {
    if (
      peutLireContribution(axe, lecteur, auteur) &&
      !contributionDe(axe, lecteur)
    ) {
      throw new Error(
        `Miroir rompu : ${lecteur} lit ${auteur} sans avoir contribué`,
      );
    }
  }
}
