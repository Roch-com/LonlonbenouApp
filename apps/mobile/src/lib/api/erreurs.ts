/** Erreurs de la couche réseau, typées pour que l'interface puisse réagir. */

export type GenreErreur =
  /** Pas de réseau, serveur injoignable, délai dépassé. */
  | 'hors_ligne'
  /** Jeton absent, invalide ou expiré, et le rafraîchissement a échoué. */
  | 'non_authentifie'
  /** Authentifié, mais pas le droit — non-membre, partage inactif. */
  | 'interdit'
  | 'introuvable'
  | 'conflit'
  | 'serveur';

export class ErreurApi extends Error {
  readonly genre: GenreErreur;
  readonly statut?: number;
  readonly motif?: string;

  constructor(genre: GenreErreur, message: string, statut?: number, motif?: string) {
    super(message);
    this.name = 'ErreurApi';
    this.genre = genre;
    this.statut = statut;
    this.motif = motif;
  }
}

export function genreDepuisStatut(statut: number): GenreErreur {
  if (statut === 401) return 'non_authentifie';
  if (statut === 403 || statut === 410) return 'interdit';
  if (statut === 404) return 'introuvable';
  if (statut === 409 || statut === 429) return 'conflit';
  return 'serveur';
}

/** Message affichable, sans jargon technique ni code d'erreur. */
export function messageLisible(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) {
    return 'Quelque chose n’a pas fonctionné. Réessayez dans un instant.';
  }
  switch (erreur.genre) {
    case 'hors_ligne':
      return 'Pas de connexion. Ce que vous voyez date de la dernière synchronisation.';
    case 'non_authentifie':
      return 'Votre session a expiré. Reconnectez-vous.';
    case 'interdit':
      return 'Cet espace n’est pas accessible pour l’instant.';
    case 'introuvable':
      return 'Introuvable — cela a peut-être été supprimé entre-temps.';
    case 'conflit':
      return 'Cette action n’est plus possible en l’état.';
    default:
      return 'Le serveur n’a pas pu répondre. Réessayez dans un instant.';
  }
}
