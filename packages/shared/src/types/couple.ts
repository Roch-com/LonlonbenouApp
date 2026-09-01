export type PartenaireId = string;
export type CoupleId = string;

export interface Partenaire {
  id: PartenaireId;
  prenom: string;
  /** Initiales affichées quand aucune photo n'est disponible. */
  initiales: string;
  photoUrl?: string;
}

export interface Couple {
  id: CoupleId;
  partenaires: readonly [Partenaire, Partenaire];
  /** Date de mise en couple, ISO 8601 (YYYY-MM-DD). Base du compteur. */
  depuis: string;
  /**
   * Nom que le couple donne à son espace (§8.18) — « Rochaelle » pour le
   * couple pilote.
   *
   * Facultatif : un couple qui n'en a pas choisi n'en a pas, et lui en
   * fabriquer un à partir des deux prénoms serait décider à sa place de la
   * façon dont il se nomme. `NOM_ESPACE_PAR_DEFAUT` sert alors à l'affichage.
   */
  nomEspace?: string;
}

export const NOM_ESPACE_PAR_DEFAUT = 'Notre espace';

/** Longueur retenue à la saisie : de quoi nommer, pas de quoi écrire. */
export const LONGUEUR_MAX_NOM_ESPACE = 40;

/**
 * Nettoie un nom d'espace, ou rend `undefined` s'il n'en reste rien.
 *
 * Les espaces multiples sont réduits : un nom qui dépend d'espaces invisibles
 * s'affiche différemment selon l'écran, et se retape mal.
 */
export function nettoyerNomEspace(brut: string): string | undefined {
  const propre = brut.replace(/\s+/g, ' ').trim();
  if (!propre) return undefined;
  return propre.slice(0, LONGUEUR_MAX_NOM_ESPACE);
}

export function partenaireAvec(
  couple: Couple,
  id: PartenaireId,
): Partenaire | undefined {
  return couple.partenaires.find((p) => p.id !== id);
}

export function partenaire(
  couple: Couple,
  id: PartenaireId,
): Partenaire | undefined {
  return couple.partenaires.find((p) => p.id === id);
}
