/** Pôle ① — Chat du couple. Périmètre P0 : messagerie, notes douces, humeur. */

import type { PartenaireId } from './couple';
import type { Visibilite } from '../privacy/visibilite';

export type TypeMessage = 'texte' | 'note_douce';

export interface Message {
  id: string;
  auteurId: PartenaireId;
  type: TypeMessage;
  texte: string;
  envoyeLe: string;
  luLe?: string;
  /** Champ de visibilité obligatoire sur toute entité sensible. */
  visibilite: Visibilite;
}

export type CodeHumeur =
  'rayonnant' | 'serein' | 'fatigue' | 'tendu' | 'triste' | 'amoureux';

export interface DefinitionHumeur {
  code: CodeHumeur;
  libelle: string;
  emoji: string;
}

export const HUMEURS: readonly DefinitionHumeur[] = [
  { code: 'rayonnant', libelle: 'Rayonnant·e', emoji: '✨' },
  { code: 'serein', libelle: 'Serein·e', emoji: '🌿' },
  { code: 'amoureux', libelle: 'Amoureux·se', emoji: '💛' },
  { code: 'fatigue', libelle: 'Fatigué·e', emoji: '🌙' },
  { code: 'tendu', libelle: 'Tendu·e', emoji: '🌊' },
  { code: 'triste', libelle: 'Triste', emoji: '🕊️' },
] as const;

export function definitionHumeur(code: CodeHumeur): DefinitionHumeur {
  const trouve = HUMEURS.find((h) => h.code === code);
  if (!trouve) throw new Error(`Humeur inconnue : ${code}`);
  return trouve;
}

export interface Humeur {
  partenaireId: PartenaireId;
  code: CodeHumeur;
  mot?: string;
  majLe: string;
}

/** Amorces de notes douces, pour ne jamais laisser l'écran vide. */
export const NOTES_SUGGEREES = [
  'Je pense à toi, là, maintenant.',
  'Merci pour hier soir.',
  'Tu m’as manqué aujourd’hui.',
  'J’ai hâte de te retrouver.',
  'Prends soin de toi, je t’aime.',
] as const;
