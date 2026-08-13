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
