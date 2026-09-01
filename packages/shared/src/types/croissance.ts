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

/**
 * Ce que l'axe pèse pour celui qui l'ouvre (§8.5).
 *
 * Trois niveaux et pas cinq : au-delà, on hiérarchise des nuances qu'on ne
 * ressent pas, et l'échelle finit par dire l'humeur du jour plutôt que
 * l'importance du sujet.
 */
export type NiveauImportance = 'douce' | 'moyenne' | 'forte';

export interface DefinitionImportance {
  code: NiveauImportance;
  libelle: string;
  /** Ce que le niveau annonce à l'autre. Jamais une mise en demeure. */
  lecture: string;
}

export const IMPORTANCES: readonly DefinitionImportance[] = [
  {
    code: 'douce',
    libelle: 'Sans urgence',
    lecture: 'Un sujet à garder en tête, sans presser.',
  },
  {
    code: 'moyenne',
    libelle: 'Ça compte',
    lecture: 'Un sujet qui revient et qu’il vaudrait mieux ne pas laisser.',
  },
  {
    code: 'forte',
    libelle: 'C’est important pour moi',
    lecture: 'Un sujet qui pèse. En parler tôt vaut mieux que le laisser grandir.',
  },
] as const;

export const IMPORTANCE_PAR_DEFAUT: NiveauImportance = 'moyenne';

export function definitionImportance(
  code: NiveauImportance,
): DefinitionImportance {
  const trouve = IMPORTANCES.find((i) => i.code === code);
  if (!trouve) throw new Error(`Importance inconnue : ${code}`);
  return trouve;
}

/** Un progrès reconnu par l'un des deux. */
export interface Reconnaissance {
  partenaireId: PartenaireId;
  le: string;
}

/**
 * Les quatre statuts du §8.5.
 *
 * Dérivés plutôt que stockés : un statut qu'on pose à la main se désynchronise
 * du contenu — un axe marqué « en cours » dont personne n'a rien écrit ment
 * sur l'état réel de la conversation.
 */
export type EtatAxe = 'a_travailler' | 'en_cours' | 'progres_reconnu' | 'clos';

export const LIBELLES_ETAT_AXE: Record<EtatAxe, string> = {
  a_travailler: 'À travailler',
  en_cours: 'En cours',
  progres_reconnu: 'Progrès reconnu',
  clos: 'Clos',
};

export interface AxeCroissance {
  id: string;
  theme: ThemeAxe;
  titre: string;
  ouvertPar: PartenaireId;
  ouvertLe: string;
  /** 0, 1 ou 2 contributions — une par partenaire au maximum. */
  contributions: readonly ContributionAxe[];
  importance?: NiveauImportance;
  /** Progrès reconnus. Un axe peut en porter un de chaque côté. */
  reconnaissances?: readonly Reconnaissance[];
  clotureLe?: string;
}

/**
 * Le statut d'un axe, déduit de son contenu.
 *
 * « Progrès reconnu » l'emporte sur « en cours » : c'est l'information qui
 * compte, et la voir remonter est ce qui donne envie de continuer.
 */
export function etatAxe(axe: AxeCroissance): EtatAxe {
  if (axe.clotureLe) return 'clos';
  if ((axe.reconnaissances ?? []).length > 0) return 'progres_reconnu';
  if (axe.contributions.length >= 2) return 'en_cours';
  return 'a_travailler';
}

/**
 * Combien d'axes peuvent être ouverts en même temps (§8.5).
 *
 * Le cahier demande une limite « pour éviter l'effet liste de griefs », et
 * c'est la seule raison de ce nombre. Trois sujets ouverts, c'est déjà
 * beaucoup à porter à deux ; au-delà, la page cesse d'être un endroit où l'on
 * travaille et devient un inventaire de ce qui ne va pas.
 *
 * La limite porte sur le couple, pas sur la personne : deux listes de trois
 * font six griefs affichés, ce que la règle cherche précisément à éviter.
 */
export const LIMITE_AXES_ACTIFS = 3;

export function axesActifs(
  axes: readonly AxeCroissance[],
): AxeCroissance[] {
  return axes.filter((a) => !a.clotureLe);
}

/**
 * Reste-t-il de la place pour un axe de plus ?
 *
 * Refuser n'est pas une punition : c'est une invitation à refermer ce qui a
 * avancé avant d'ouvrir autre chose. Le message qui accompagne ce refus doit
 * le dire ainsi.
 */
export function peutOuvrirUnAxe(axes: readonly AxeCroissance[]): boolean {
  return axesActifs(axes).length < LIMITE_AXES_ACTIFS;
}

/** Amorces proposées à l'ouverture d'un axe, pour éviter la page blanche. */
export const AXES_SUGGERES: readonly { theme: ThemeAxe; titre: string }[] = [
  { theme: 'communication', titre: 'Se dire les choses plus tôt' },
  { theme: 'temps_ensemble', titre: 'Retrouver des soirées à deux' },
  { theme: 'quotidien', titre: 'Répartir la charge de la maison' },
  { theme: 'projets', titre: 'Parler de la suite' },
  { theme: 'famille', titre: 'Trouver notre place avec nos familles' },
] as const;
