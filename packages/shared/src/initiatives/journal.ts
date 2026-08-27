/**
 * Pôle ③ — Initiatives & sorties : journal.
 *
 * Comme pour les projets, **rien n'est compté par personne**. Savoir « qui
 * propose le plus » transformerait un élan en dette, et le pôle ② a déjà tranché
 * la question pour le score : on regarde ce que le couple vit, pas qui marque
 * des points.
 */

import { joursEntre } from '../temps/jours';
import type { Initiative } from '../types/initiatives';

export function idees(initiatives: readonly Initiative[]): Initiative[] {
  return initiatives
    .filter((i) => i.etat === 'idee')
    .sort((a, b) => b.proposeeLe.localeCompare(a.proposeeLe));
}

/** Sorties prévues, de la plus proche à la plus lointaine. */
export function prevues(initiatives: readonly Initiative[]): Initiative[] {
  return initiatives
    .filter((i) => i.etat === 'prevue')
    .sort((a, b) => (a.prevuePour ?? '').localeCompare(b.prevuePour ?? ''));
}

/** Le journal proprement dit : ce qui a été vécu, du plus récent au plus ancien. */
export function journal(initiatives: readonly Initiative[]): Initiative[] {
  return initiatives
    .filter((i) => i.etat === 'vecue')
    .sort((a, b) => (b.vecueLe ?? '').localeCompare(a.vecueLe ?? ''));
}

export interface ResumeJournal {
  vecues: number;
  /** Jours depuis la dernière sortie vécue. `undefined` s'il n'y en a aucune. */
  depuisDerniere?: number;
  /** Catégories déjà explorées, pour donner envie d'en essayer d'autres. */
  categoriesExplorees: number;
}

export function resumeJournal(
  initiatives: readonly Initiative[],
  maintenant: string = new Date().toISOString(),
): ResumeJournal {
  const vecues = journal(initiatives);
  const derniere = vecues[0];

  return {
    vecues: vecues.length,
    depuisDerniere: derniere?.vecueLe
      ? joursEntre(derniere.vecueLe, maintenant)
      : undefined,
    categoriesExplorees: new Set(vecues.map((i) => i.categorie)).size,
  };
}

export function marquerVecue(
  initiative: Initiative,
  souvenir?: string,
  maintenant: string = new Date().toISOString(),
): Initiative {
  return {
    ...initiative,
    etat: 'vecue',
    vecueLe: maintenant,
    souvenir: souvenir?.trim() || initiative.souvenir,
  };
}

export function programmer(initiative: Initiative, prevuePour: string): Initiative {
  return { ...initiative, etat: 'prevue', prevuePour };
}
