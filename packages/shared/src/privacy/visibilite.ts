/**
 * Visibilité explicite portée par toute entité sensible
 * (position, cycle, confidences, messages).
 *
 * Convention CLAUDE.md : aucune requête ne doit contourner ce champ.
 * Le filtrage se fait toujours via `estVisiblePar`, jamais en lisant
 * l'entité brute côté écran.
 */
export type Visibilite =
  /** Visible du seul auteur. */
  | 'prive'
  /** Visible des deux partenaires, dans les mêmes conditions. */
  | 'couple';

export interface EntiteSensible {
  auteurId: string;
  visibilite: Visibilite;
}

export function estVisiblePar(entite: EntiteSensible, lecteurId: string): boolean {
  if (entite.auteurId === lecteurId) return true;
  return entite.visibilite === 'couple';
}

export function filtrerVisibles<T extends EntiteSensible>(
  entites: readonly T[],
  lecteurId: string,
): T[] {
  return entites.filter((e) => estVisiblePar(e, lecteurId));
}
