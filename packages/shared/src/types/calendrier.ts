/** Pôle ③ — Calendrier partagé (P0). */

import type { PartenaireId } from './couple';
import type { Visibilite } from '../privacy/visibilite';

export type CategorieEvenement =
  'a_deux' | 'rendez_vous' | 'famille' | 'sante' | 'travail' | 'autre';

export interface DefinitionCategorieEvenement {
  code: CategorieEvenement;
  libelle: string;
  emoji: string;
}

export const CATEGORIES_EVENEMENT: readonly DefinitionCategorieEvenement[] = [
  { code: 'a_deux', libelle: 'À deux', emoji: '💛' },
  { code: 'rendez_vous', libelle: 'Rendez-vous', emoji: '📌' },
  { code: 'famille', libelle: 'Famille', emoji: '🫂' },
  { code: 'sante', libelle: 'Santé', emoji: '🩺' },
  { code: 'travail', libelle: 'Travail', emoji: '💼' },
  { code: 'autre', libelle: 'Autre', emoji: '🗓️' },
] as const;

export function definitionCategorieEvenement(
  code: CategorieEvenement,
): DefinitionCategorieEvenement {
  const trouve = CATEGORIES_EVENEMENT.find((c) => c.code === code);
  if (!trouve) throw new Error(`Catégorie d’événement inconnue : ${code}`);
  return trouve;
}

export interface Evenement {
  id: string;
  titre: string;
  categorie: CategorieEvenement;
  /** ISO complet, ou `YYYY-MM-DD` pour une journée entière. */
  debut: string;
  fin?: string;
  journeeEntiere: boolean;
  lieu?: string;
  note?: string;
  creePar: PartenaireId;
  creeLe: string;
  /**
   * Toujours `couple` en P0 : c'est un calendrier *partagé*, pas un agenda
   * personnel avec des trous. Le champ existe parce que la convention l'exige
   * sur toute entité sensible, et parce que le projet surprise (P1) en aura
   * besoin — lui seul justifiera une valeur différente, bornée dans le temps
   * et consentie à la création.
   */
  visibilite: Visibilite;
  /** Heures avant le début. `undefined` = aucun rappel. */
  rappelHeures?: number;
}

/** Délais de rappel proposés, en heures. */
export const DELAIS_RAPPEL = [
  { heures: 1, libelle: '1 heure avant' },
  { heures: 3, libelle: '3 heures avant' },
  { heures: 24, libelle: 'La veille' },
  { heures: 72, libelle: '3 jours avant' },
] as const;
