/** Pôle ② — Espace de confidences (P0 : gratitude + lettres). */

import type { PartenaireId } from './couple';
import type { Visibilite } from '../privacy/visibilite';

export type TypeConfidence =
  /** Un merci court, envoyé tout de suite. */
  | 'gratitude'
  /** Un texte long, écrit en plusieurs fois, envoyé quand on est prêt. */
  | 'lettre';

export interface Confidence {
  id: string;
  auteurId: PartenaireId;
  type: TypeConfidence;
  /** Réservé aux lettres. */
  titre?: string;
  texte: string;
  creeLe: string;
  envoyeeLe?: string;
  luLe?: string;
  /**
   * `prive` tant que c'est un brouillon, `couple` une fois envoyé.
   * Champ obligatoire : aucune lecture ne se fait sans passer par ce filtre.
   */
  visibilite: Visibilite;
}

/** Amorces de gratitude, pour ne jamais laisser l'écran vide. */
export const GRATITUDES_SUGGEREES = [
  'Merci d’avoir pris le relais hier.',
  'J’ai aimé ta façon de me faire rire ce matin.',
  'Merci d’avoir écouté sans rien dire.',
  'Tu m’as facilité la journée sans le savoir.',
] as const;

/** Amorces de lettres — un cadre, pas un modèle imposé. */
export const AMORCES_LETTRE = [
  'Ce que je n’arrive pas à te dire de vive voix…',
  'Ce que j’admire chez toi et que je ne dis jamais…',
  'Ce dont j’ai eu peur ces derniers temps…',
  'Ce que j’espère pour nous dans un an…',
] as const;
