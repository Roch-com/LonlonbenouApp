/** Pôle ② — Axes de croissance (P0 : structure de base). */

import type { PartenaireId } from './couple';

export type ThemeAxe =
  | 'communication'
  | 'temps_ensemble'
  | 'quotidien'
  | 'projets'
  | 'famille'
  | 'intimite';

export interface DefinitionTheme {
  code: ThemeAxe;
  libelle: string;
  emoji: string;
}

export const THEMES_AXE: readonly DefinitionTheme[] = [
  { code: 'communication', libelle: 'Se parler', emoji: '💬' },
  { code: 'temps_ensemble', libelle: 'Temps ensemble', emoji: '⏳' },
  { code: 'quotidien', libelle: 'Le quotidien', emoji: '🏠' },
  { code: 'projets', libelle: 'Nos projets', emoji: '🗺️' },
  { code: 'famille', libelle: 'Familles & proches', emoji: '🫂' },
  { code: 'intimite', libelle: 'Notre intimité', emoji: '🌹' },
] as const;

export function definitionTheme(code: ThemeAxe): DefinitionTheme {
  const trouve = THEMES_AXE.find((t) => t.code === code);
  if (!trouve) throw new Error(`Thème inconnu : ${code}`);
  return trouve;
}

/**
 * La contribution d'un partenaire à un axe.
 * Deux champs volontairement distincts : ce que je ressens, et ce dont j'aurais
 * besoin. Séparer les deux est ce qui empêche l'axe de devenir une liste de
 * reproches.
 */
export interface ContributionAxe {
  partenaireId: PartenaireId;
  ressenti: string;
  besoin: string;
  majLe: string;
}

export interface AxeCroissance {
  id: string;
  theme: ThemeAxe;
  titre: string;
  ouvertPar: PartenaireId;
  ouvertLe: string;
  /** 0, 1 ou 2 contributions — une par partenaire au maximum. */
  contributions: readonly ContributionAxe[];
  clotureLe?: string;
}

/** Amorces proposées à l'ouverture d'un axe, pour éviter la page blanche. */
export const AXES_SUGGERES: readonly { theme: ThemeAxe; titre: string }[] = [
  { theme: 'communication', titre: 'Se dire les choses plus tôt' },
  { theme: 'temps_ensemble', titre: 'Retrouver des soirées à deux' },
  { theme: 'quotidien', titre: 'Répartir la charge de la maison' },
  { theme: 'projets', titre: 'Parler de la suite' },
  { theme: 'famille', titre: 'Trouver notre place avec nos familles' },
] as const;
