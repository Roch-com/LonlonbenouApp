/**
 * Pôle ③ — catalogue d'idées de sorties (§8.12).
 *
 * « Catalogue d'idées filtrable par budget, durée, énergie requise » — et,
 * dans la ligne MVP, « catalogue suggéré algorithmique ».
 *
 * ## Ce que « algorithmique » veut dire ici, et ce qu'il ne veut pas dire
 *
 * Le filtrage sur ce qu'on demande — un budget, une heure devant soi, l'envie
 * ou non de bouger — plus une préférence pour ce qu'on n'a pas déjà fait.
 * Rien d'autre.
 *
 * En particulier, **aucune suggestion déduite de l'état du couple**. Proposer
 * « une soirée à deux » parce que le score baisse, ou parce qu'aucune sortie
 * n'a été notée depuis trois semaines, transformerait une idée en rappel à
 * l'ordre. Le §8.14 prévoit des « rappels doux en cas de distanciation » ; ce
 * catalogue-ci n'en fait pas partie, et mélanger les deux rendrait chaque
 * suggestion suspecte.
 */

import type { CategorieSortie } from '../types/initiatives';

/** Ce qu'on est prêt à y mettre, dans la devise du couple — sans montant. */
export type NiveauBudget = 'rien' | 'petit' | 'consequent';

/** Le temps devant soi. */
export type Duree = 'une_heure' | 'une_soiree' | 'une_journee';

/** L'énergie disponible, qui n'est pas la même chose que le temps. */
export type Energie = 'douce' | 'moyenne' | 'active';

export interface IdeeSortie {
  id: string;
  titre: string;
  categorie: CategorieSortie;
  budget: NiveauBudget;
  duree: Duree;
  energie: Energie;
  /** Ce que l'idée demande vraiment, en une ligne. */
  detail: string;
}

/**
 * Le catalogue.
 *
 * Volontairement ancré dans le quotidien plutôt que dans le spectaculaire :
 * un couple qui cherche une idée un mardi soir n'a pas besoin qu'on lui
 * propose un week-end en montagne. Les idées coûteuses existent, mais elles
 * sont minoritaires.
 */
export const CATALOGUE: readonly IdeeSortie[] = [
  {
    id: 'c01',
    titre: 'Marcher sans destination',
    categorie: 'nature',
    budget: 'rien',
    duree: 'une_heure',
    energie: 'douce',
    detail: 'Sortir ensemble sans savoir où l’on va, et rentrer quand on veut.',
  },
  {
    id: 'c02',
    titre: 'Cuisiner un plat qu’aucun de vous ne sait faire',
    categorie: 'maison',
    budget: 'petit',
    duree: 'une_soiree',
    energie: 'moyenne',
    detail: 'Un plat nouveau pour les deux : personne n’est le sachant.',
  },
  {
    id: 'c03',
    titre: 'Une soirée sans écran',
    categorie: 'maison',
    budget: 'rien',
    duree: 'une_soiree',
    energie: 'douce',
    detail: 'Téléphones rangés jusqu’au lendemain matin.',
  },
  {
    id: 'c04',
    titre: 'Petit-déjeuner dehors, un jour de semaine',
    categorie: 'restaurant',
    budget: 'petit',
    duree: 'une_heure',
    energie: 'douce',
    detail: 'Se lever un peu plus tôt pour commencer la journée ensemble.',
  },
  {
    id: 'c05',
    titre: 'Retourner là où vous êtes allés la première fois',
    categorie: 'culture',
    budget: 'petit',
    duree: 'une_soiree',
    energie: 'moyenne',
    detail: 'Le même endroit, des années après.',
  },
  {
    id: 'c06',
    titre: 'Une journée sans plan',
    categorie: 'nature',
    budget: 'petit',
    duree: 'une_journee',
    energie: 'active',
    detail: 'Décider le matin, improviser le reste.',
  },
  {
    id: 'c07',
    titre: 'Apprendre quelque chose à deux',
    categorie: 'culture',
    budget: 'petit',
    duree: 'une_soiree',
    energie: 'moyenne',
    detail: 'Un tutoriel, une recette, un pas de danse — peu importe le sujet.',
  },
  {
    id: 'c08',
    titre: 'Écrire chacun trois choses sur l’autre',
    categorie: 'maison',
    budget: 'rien',
    duree: 'une_heure',
    energie: 'douce',
    detail: 'Chacun de son côté, puis on échange les feuilles.',
  },
  {
    id: 'c09',
    titre: 'Un vrai restaurant, sans occasion',
    categorie: 'restaurant',
    budget: 'consequent',
    duree: 'une_soiree',
    energie: 'moyenne',
    detail: 'Pas un anniversaire, pas une réconciliation. Juste un mardi.',
  },
  {
    id: 'c10',
    titre: 'Partir une nuit quelque part',
    categorie: 'voyage',
    budget: 'consequent',
    duree: 'une_journee',
    energie: 'active',
    detail: 'Une seule nuit suffit à couper avec le quotidien.',
  },
  {
    id: 'c11',
    titre: 'Ranger ensemble ce qui traîne depuis des mois',
    categorie: 'maison',
    budget: 'rien',
    duree: 'une_heure',
    energie: 'active',
    detail: 'Moins romantique, mais on en sort tous les deux soulagés.',
  },
  {
    id: 'c12',
    titre: 'Regarder des photos d’avant',
    categorie: 'maison',
    budget: 'rien',
    duree: 'une_heure',
    energie: 'douce',
    detail: 'Les vôtres, ou celles de chacun avant l’autre.',
  },
] as const;

export interface CriteresSuggestion {
  budget?: NiveauBudget;
  duree?: Duree;
  energie?: Energie;
  /** Titres déjà proposés ou vécus : on ne les remet pas en avant. */
  dejaVus?: readonly string[];
}

/**
 * Idées correspondant aux critères, les inédites d'abord.
 *
 * Rien n'est masqué : une idée déjà vécue reste proposable — on peut vouloir
 * refaire ce qu'on a aimé. Elle passe simplement après.
 */
export function suggestions(
  criteres: CriteresSuggestion = {},
  limite = 5,
): IdeeSortie[] {
  const dejaVus = new Set(
    (criteres.dejaVus ?? []).map((t) => t.trim().toLowerCase()),
  );

  const correspond = (idee: IdeeSortie) =>
    (criteres.budget === undefined || idee.budget === criteres.budget) &&
    (criteres.duree === undefined || idee.duree === criteres.duree) &&
    (criteres.energie === undefined || idee.energie === criteres.energie);

  const retenues = CATALOGUE.filter(correspond);

  // Aucune idée ne correspond exactement : on rend le catalogue plutôt qu'un
  // vide. Un filtre trop étroit ne doit pas donner l'impression qu'il n'y a
  // rien à faire ensemble.
  const base = retenues.length > 0 ? retenues : CATALOGUE;

  return [...base]
    .sort((a, b) => {
      const vuA = dejaVus.has(a.titre.toLowerCase()) ? 1 : 0;
      const vuB = dejaVus.has(b.titre.toLowerCase()) ? 1 : 0;
      return vuA - vuB;
    })
    .slice(0, limite);
}

export const LIBELLES_BUDGET: Record<NiveauBudget, string> = {
  rien: 'Rien',
  petit: 'Un petit budget',
  consequent: 'On met le prix',
};

export const LIBELLES_DUREE: Record<Duree, string> = {
  une_heure: 'Une heure',
  une_soiree: 'Une soirée',
  une_journee: 'Une journée',
};

export const LIBELLES_ENERGIE: Record<Energie, string> = {
  douce: 'Tranquille',
  moyenne: 'Normale',
  active: 'En forme',
};
