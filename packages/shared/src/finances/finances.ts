/**
 * Pôle ③ — Finances partagées (§8.11 du cahier).
 *
 * ## Le piège de ce module
 *
 * Un suivi de dépenses de couple peut très facilement devenir un instrument de
 * reproche : « j'ai payé trois fois plus que toi ce mois-ci ». Le §8.8 interdit
 * déjà au score d'implication de classer les personnes ; la même règle vaut ici,
 * et plus fort encore, parce que l'argent est le sujet sur lequel les couples se
 * déchirent le plus facilement.
 *
 * D'où deux décisions inscrites dans le modèle, pas seulement dans l'interface :
 *
 *   1. **On ne calcule jamais de total par personne comme une performance.**
 *      Ce qui est rendu, c'est un solde — l'écart entre ce qu'on a avancé et ce
 *      qui revenait à chacun selon la règle *que le couple a choisie ensemble*.
 *      Un solde se règle ; un classement se subit.
 *   2. **Le solde a toujours un sens de lecture neutre.** `equilibre` dit qui
 *      doit à qui et combien, sans qualifier personne. Aucune fonction de ce
 *      fichier ne rend « le plus dépensier ».
 *
 * ## Les montants
 *
 * En unité indivisible de la devise, toujours entière. Le franc CFA n'a pas de
 * centimes, l'euro en a cent : `decimales` porte cette différence. Manipuler
 * des flottants pour de l'argent produirait des écarts d'un centime qui ne se
 * répartissent nulle part et donnent des soldes faux.
 */

import type { PartenaireId } from '../types/couple';

export interface Devise {
  code: string;
  symbole: string;
  /** 0 pour le franc CFA, 2 pour l'euro. */
  decimales: number;
}

export const DEVISES: readonly Devise[] = [
  { code: 'XOF', symbole: 'F', decimales: 0 },
  { code: 'EUR', symbole: '€', decimales: 2 },
  { code: 'USD', symbole: '$', decimales: 2 },
] as const;

export const DEVISE_PAR_DEFAUT = DEVISES[0]!;

export function definitionDevise(code: string): Devise {
  return DEVISES.find((d) => d.code === code) ?? DEVISE_PAR_DEFAUT;
}

export type CategorieDepense =
  | 'courses'
  | 'logement'
  | 'transport'
  | 'sorties'
  | 'sante'
  | 'projet'
  | 'autre';

export interface DefinitionCategorieDepense {
  code: CategorieDepense;
  libelle: string;
  emoji: string;
}

export const CATEGORIES_DEPENSE: readonly DefinitionCategorieDepense[] = [
  { code: 'courses', libelle: 'Courses', emoji: '🛒' },
  { code: 'logement', libelle: 'Logement', emoji: '🏠' },
  { code: 'transport', libelle: 'Transport', emoji: '🚕' },
  { code: 'sorties', libelle: 'Sorties', emoji: '🍽️' },
  { code: 'sante', libelle: 'Santé', emoji: '💊' },
  { code: 'projet', libelle: 'Projet commun', emoji: '🎯' },
  { code: 'autre', libelle: 'Autre', emoji: '•' },
] as const;

export function definitionCategorieDepense(
  code: CategorieDepense,
): DefinitionCategorieDepense {
  return (
    CATEGORIES_DEPENSE.find((c) => c.code === code) ?? CATEGORIES_DEPENSE.at(-1)!
  );
}

/** Contenu clair d'une dépense. Il ne quitte jamais les téléphones. */
export interface ContenuDepense {
  libelle: string;
  /** En unité indivisible, toujours entier et positif. */
  montant: number;
  categorie: CategorieDepense;
  /** Qui a avancé l'argent. */
  payePar: PartenaireId;
  /** Rattachement facultatif à un projet du pôle ③. */
  projetId?: string;
}

export interface Depense extends ContenuDepense {
  id: string;
  /** `YYYY-MM-DD`, en clair : c'est ce qui permet de regrouper par mois. */
  jour: string;
  /**
   * Qui a saisi la dépense — distinct de `payePar`, qui dit qui a avancé
   * l'argent. On note souvent une dépense que l'autre a réglée, et confondre
   * les deux fausserait l'équilibre.
   */
  creePar: PartenaireId;
  creeLe: string;
}

/**
 * Comment le couple partage ses dépenses communes (§8.11).
 *
 * `revenus` n'est pas un jugement : c'est la règle qui évite qu'un partage
 * strictement égal pèse deux fois plus lourd sur celui qui gagne le moins.
 */
export type ModeRepartition = 'egal' | 'revenus' | 'personnalise';

export interface ReglesPartage {
  mode: ModeRepartition;
  /**
   * Part de chacun, entre 0 et 1, sommant à 1. Utilisée pour `revenus` et
   * `personnalise` ; ignorée en mode `egal`.
   */
  parts?: Record<PartenaireId, number>;
}

/** Parts effectives, quel que soit le mode. Toujours normalisées. */
export function partsEffectives(
  regles: ReglesPartage,
  partenaires: readonly [PartenaireId, PartenaireId],
): Record<PartenaireId, number> {
  const [a, b] = partenaires;

  if (regles.mode === 'egal' || !regles.parts) {
    return { [a]: 0.5, [b]: 0.5 };
  }

  const partA = Math.max(0, regles.parts[a] ?? 0);
  const partB = Math.max(0, regles.parts[b] ?? 0);
  const total = partA + partB;

  // Des parts qui ne somment pas à 1 — ou à 0 — donneraient des dus absurdes.
  // On renormalise plutôt que de refuser : le réglage vient d'une interface,
  // et un arrondi ne doit pas bloquer la saisie d'une dépense.
  if (total <= 0) return { [a]: 0.5, [b]: 0.5 };
  return { [a]: partA / total, [b]: partB / total };
}

export interface Equilibre {
  /** Total avancé par chacun sur la période. */
  avance: Record<PartenaireId, number>;
  /** Ce qui revenait à chacun selon la règle choisie. */
  du: Record<PartenaireId, number>;
  /** Qui doit rendre, et à qui. Absent quand le compte est juste. */
  regularisation?: {
    de: PartenaireId;
    vers: PartenaireId;
    /** Toujours strictement positif. */
    montant: number;
  };
}

/**
 * Solde du couple sur un ensemble de dépenses.
 *
 * **Rend un solde, jamais un classement.** Ce que la fonction dit, c'est
 * l'écart entre ce que chacun a avancé et ce qui lui revenait selon la règle
 * choisie ensemble — pas qui a le plus dépensé.
 *
 * L'arrondi va au centime près sur `du`, puis la régularisation se calcule sur
 * la différence : additionner des parts arrondies laisserait un résidu d'une
 * unité que personne ne doit à personne.
 */
export function equilibre(
  depenses: readonly ContenuDepense[],
  partenaires: readonly [PartenaireId, PartenaireId],
  regles: ReglesPartage,
): Equilibre {
  const [a, b] = partenaires;
  const parts = partsEffectives(regles, partenaires);

  const avance: Record<PartenaireId, number> = { [a]: 0, [b]: 0 };
  let total = 0;

  for (const depense of depenses) {
    const montant = Math.max(0, Math.round(depense.montant));
    if (!Number.isFinite(montant) || montant === 0) continue;
    if (depense.payePar !== a && depense.payePar !== b) continue;

    avance[depense.payePar] = (avance[depense.payePar] ?? 0) + montant;
    total += montant;
  }

  const duA = Math.round(total * (parts[a] ?? 0.5));
  const du: Record<PartenaireId, number> = { [a]: duA, [b]: total - duA };

  const ecart = (avance[a] ?? 0) - (du[a] ?? 0);
  if (ecart === 0) return { avance, du };

  return {
    avance,
    du,
    regularisation:
      ecart > 0
        ? { de: b, vers: a, montant: ecart }
        : { de: a, vers: b, montant: -ecart },
  };
}

/** Total par catégorie, du plus lourd au plus léger. */
export function parCategorie(
  depenses: readonly ContenuDepense[],
): { categorie: CategorieDepense; total: number }[] {
  const totaux = new Map<CategorieDepense, number>();

  for (const depense of depenses) {
    const montant = Math.max(0, Math.round(depense.montant));
    if (!Number.isFinite(montant) || montant === 0) continue;
    totaux.set(depense.categorie, (totaux.get(depense.categorie) ?? 0) + montant);
  }

  return [...totaux.entries()]
    .map(([categorie, total]) => ({ categorie, total }))
    .sort((x, y) => y.total - x.total);
}

/** Dépenses d'un mois donné, `YYYY-MM`. */
export function depensesDuMois<T extends { jour: string }>(
  depenses: readonly T[],
  mois: string,
): T[] {
  return depenses.filter((d) => d.jour.slice(0, 7) === mois);
}

export type EtatBudget = 'dans_le_budget' | 'proche' | 'depasse';

export interface LectureBudget {
  etat: EtatBudget;
  /** Part consommée, entre 0 et 1 — et au-delà en cas de dépassement. */
  part: number;
  /** Phrase prête à afficher. Jamais culpabilisante. */
  lecture: string;
}

/** À partir d'ici, on prévient — assez tôt pour que ce soit utile. */
const SEUIL_PROCHE = 0.85;

/**
 * Le cadre d'un budget : le mois du foyer, ou l'enveloppe d'un projet.
 *
 * Les deux se lisent pareil mais ne se disent pas pareil. « Le budget de ce
 * mois est dépassé » n'a aucun sens pour un voyage dont l'enveloppe a été
 * fixée une fois pour toutes.
 */
export type CadreBudget = 'mois' | 'projet';

const TEXTES_BUDGET: Record<CadreBudget, Record<EtatBudget, string>> = {
  mois: {
    depasse:
      'Le budget de ce mois est dépassé. Cela arrive — c’est un repère, pas une limite à tenir.',
    proche: 'Vous approchez du budget que vous vous étiez fixé pour ce mois.',
    dans_le_budget: 'Vous êtes dans ce que vous aviez prévu.',
  },
  projet: {
    depasse:
      'L’enveloppe de ce projet est dépassée. Il reste à décider ensemble ce que vous en faites.',
    proche: 'Vous approchez de l’enveloppe prévue pour ce projet.',
    dans_le_budget: 'Ce projet tient dans son enveloppe.',
  },
};

/**
 * Lecture d'un budget (§8.11 : « alertes douces de dépassement »).
 *
 * Le mot « douces » n'est pas décoratif. Un budget dépassé n'est pas une faute :
 * c'est un mois où la vie a coûté plus cher que prévu, souvent pour des raisons
 * qu'aucun réglage n'anticipe. Les textes constatent et ne reprochent pas, et
 * aucun ne désigne un responsable — le budget appartient au couple, pas à celui
 * qui a payé la dernière dépense.
 */
export function lectureBudget(
  depense: number,
  budget: number | undefined,
  cadre: CadreBudget = 'mois',
): LectureBudget | undefined {
  if (!budget || budget <= 0) return undefined;

  const part = depense / budget;
  const textes = TEXTES_BUDGET[cadre];

  if (part > 1) return { etat: 'depasse', part, lecture: textes.depasse };
  if (part >= SEUIL_PROCHE) return { etat: 'proche', part, lecture: textes.proche };
  return { etat: 'dans_le_budget', part, lecture: textes.dans_le_budget };
}

/** Dépenses rattachées à un projet (§8.11 : « budget partagé par projet »). */
export function depensesDuProjet<T extends { projetId?: string }>(
  depenses: readonly T[],
  projetId: string,
): T[] {
  return depenses.filter((d) => d.projetId === projetId);
}

/** Montant en toutes lettres, dans la devise du couple. */
export function montantLisible(montant: number, devise: Devise): string {
  const valeur = montant / 10 ** devise.decimales;
  const texte = valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: devise.decimales,
    maximumFractionDigits: devise.decimales,
  });
  return `${texte} ${devise.symbole}`;
}
