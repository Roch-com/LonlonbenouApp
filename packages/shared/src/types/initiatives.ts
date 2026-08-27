/** Pôle ③ — Initiatives & sorties (P0 : création + journal). */

import type { PartenaireId } from './couple';

export type CategorieSortie =
  'restaurant' | 'nature' | 'culture' | 'sport' | 'maison' | 'voyage';

export interface DefinitionCategorieSortie {
  code: CategorieSortie;
  libelle: string;
  emoji: string;
}

export const CATEGORIES_SORTIE: readonly DefinitionCategorieSortie[] = [
  { code: 'restaurant', libelle: 'Table', emoji: '🍷' },
  { code: 'nature', libelle: 'Dehors', emoji: '🌿' },
  { code: 'culture', libelle: 'Culture', emoji: '🎭' },
  { code: 'sport', libelle: 'Bouger', emoji: '🏃' },
  { code: 'maison', libelle: 'À la maison', emoji: '🕯️' },
  { code: 'voyage', libelle: 'Voyage', emoji: '🧳' },
] as const;

export function definitionCategorieSortie(
  code: CategorieSortie,
): DefinitionCategorieSortie {
  const trouve = CATEGORIES_SORTIE.find((c) => c.code === code);
  if (!trouve) throw new Error(`Catégorie de sortie inconnue : ${code}`);
  return trouve;
}

export type EtatInitiative =
  /** Une envie posée, sans date. */
  | 'idee'
  /** Une date est prévue. */
  | 'prevue'
  /** C'est arrivé : l'initiative rejoint le journal. */
  | 'vecue';

export interface Initiative {
  id: string;
  titre: string;
  categorie: CategorieSortie;
  etat: EtatInitiative;
  proposeePar: PartenaireId;
  proposeeLe: string;
  /** `YYYY-MM-DD`. */
  prevuePour?: string;
  vecueLe?: string;
  /**
   * Le mot du journal, écrit après coup. Il porte sur le moment, jamais sur la
   * personne : ce n'est pas une note attribuée à celui qui a proposé.
   */
  souvenir?: string;
}

export const IDEES_SUGGEREES: readonly {
  titre: string;
  categorie: CategorieSortie;
}[] = [
  { titre: 'Un dîner sans téléphone', categorie: 'restaurant' },
  { titre: 'Une marche au lever du jour', categorie: 'nature' },
  { titre: 'Un film qu’aucun des deux n’a vu', categorie: 'maison' },
  { titre: 'Une expo au hasard', categorie: 'culture' },
  { titre: 'Un week-end à moins de deux heures', categorie: 'voyage' },
] as const;
