/** Pôle ① — Carte & Présence. Périmètre P0 : statuts manuels, check-in, SOS. */

import type { PartenaireId } from './couple';

export type CodeStatut =
  'disponible' | 'occupe' | 'en_route' | 'au_calme' | 'je_pense_a_toi';

export interface DefinitionStatut {
  code: CodeStatut;
  libelle: string;
  /** Phrase affichée côté partenaire — jamais injonctive. */
  lecture: string;
  emoji: string;
}

export const STATUTS: readonly DefinitionStatut[] = [
  {
    code: 'disponible',
    libelle: 'Disponible',
    lecture: 'est disponible',
    emoji: '☕️',
  },
  { code: 'occupe', libelle: 'Occupé·e', lecture: 'est pris·e', emoji: '💼' },
  { code: 'en_route', libelle: 'En route', lecture: 'est en route', emoji: '🚗' },
  {
    code: 'au_calme',
    libelle: 'Au calme',
    lecture: 'a besoin de calme',
    emoji: '🌙',
  },
  {
    code: 'je_pense_a_toi',
    libelle: 'Je pense à toi',
    lecture: 'pense à toi',
    emoji: '💛',
  },
] as const;

export function definitionStatut(code: CodeStatut): DefinitionStatut {
  const trouve = STATUTS.find((s) => s.code === code);
  if (!trouve) throw new Error(`Statut inconnu : ${code}`);
  return trouve;
}

export interface Statut {
  partenaireId: PartenaireId;
  code: CodeStatut;
  /** Précision libre facultative, ex. « jusqu'à 18h ». */
  note?: string;
  majLe: string;
}

/** Check-in P0 : lieu choisi manuellement, sans géolocalisation. */
export interface CheckIn {
  id: string;
  partenaireId: PartenaireId;
  lieu: string;
  mot?: string;
  faitLe: string;
}

export type EtatSos = 'actif' | 'resolu';

export interface AlerteSos {
  id: string;
  partenaireId: PartenaireId;
  /** Lieu saisi au moment de l'alerte, si la personne a pu le préciser. */
  lieu?: string;
  message?: string;
  etat: EtatSos;
  emiseLe: string;
  resolueLe?: string;
  /** Horodatage de la prise en compte par le partenaire. */
  vueLe?: string;
}

/** Lieux proposés au check-in tant qu'il n'y a pas de backend. */
export const LIEUX_SUGGERES = [
  'À la maison',
  'Au travail',
  'Chez des amis',
  'En déplacement',
  'À la salle',
  'Chez mes parents',
] as const;
