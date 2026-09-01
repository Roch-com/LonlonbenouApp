/** Erreurs de la couche réseau, typées pour que l'interface puisse réagir. */

export type GenreErreur =
  /** Pas de réseau, serveur injoignable, délai dépassé. */
  | 'hors_ligne'
  /**
   * Le serveur était en veille et n'a pas répondu à temps, même après une
   * seconde tentative patiente. Distinct de `hors_ligne` : le téléphone a bien
   * du réseau, et rien n'est perdu — il faut simplement réessayer.
   */
  | 'reveil_trop_long'
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

  constructor(
    genre: GenreErreur,
    message: string,
    statut?: number,
    motif?: string,
  ) {
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

/**
 * Message affichable, sans jargon technique ni code d'erreur.
 *
 * Quand le serveur a pris la peine d'expliquer — « Un compte existe déjà avec
 * cette adresse. Connectez-vous. » — c'est son message qui passe : il connaît
 * la situation précise, là où une catégorie générique ne dit que la famille de
 * l'erreur. On ne le fait que pour les erreurs de client (4xx) : au-delà, le
 * détail relève du diagnostic interne et n'aiderait personne.
 */
/**
 * Messages liés à un motif précis du serveur.
 *
 * La lecture générique d'un conflit — « cette action n'est plus possible » —
 * conviendrait mal ici : un refus de garde-fou doit dire ce qu'il protège et
 * ce qu'on peut faire, pas annoncer un quota.
 */
const PAR_MOTIF: Record<string, string> = {
  trop_daxes_ouverts:
    'Vous avez déjà plusieurs axes ouverts. Refermez-en un qui a avancé avant d’en ouvrir un autre — quelques sujets à la fois se travaillent, une longue liste se subit.',
  progres_a_soi_meme:
    'Un progrès se reconnaît à l’autre. C’est ce qui lui donne sa valeur.',
  module_inactif:
    'Ce module n’est pas activé. Vous pouvez l’allumer tous les deux quand vous le souhaitez.',
};

export function messageLisible(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) {
    return 'Quelque chose n’a pas fonctionné. Réessayez dans un instant.';
  }

  const parMotif = erreur.motif ? PAR_MOTIF[erreur.motif] : undefined;
  if (parMotif) return parMotif;

  const duServeur = erreur.message?.trim();
  const estClient = erreur.statut !== undefined && erreur.statut < 500;
  // Un message utile se reconnaît à ce qu'il forme une phrase : les codes
  // techniques du genre `invalid_grant` ou `HTTP 409` n'ont rien à afficher.
  if (estClient && duServeur && /\s/.test(duServeur) && !/^HTTP /.test(duServeur)) {
    return duServeur;
  }
  switch (erreur.genre) {
    case 'hors_ligne':
      return 'Pas de connexion. Ce que vous voyez date de la dernière synchronisation.';
    case 'reveil_trop_long':
      return 'Le serveur met du temps à se réveiller. Réessayez dans un instant, rien n’est perdu.';
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
