/**
 * Distinguer « la base n'est pas joignable » de « la requête est fautive ».
 *
 * La différence décide de tout au démarrage : une base absente est un état
 * passager dont on peut se relever seul, tandis qu'une migration erronée est
 * un défaut qu'il faut voir tout de suite. Les confondre donnerait soit un
 * serveur qui meurt pour une panne d'hébergeur, soit un serveur qui réessaie
 * en boucle une migration qui ne passera jamais.
 */

/** Codes PostgreSQL et réseau qui disent l'indisponibilité, et leur nom. */
const INDISPONIBLES: Record<string, string> = {
  // Le palier gratuit de Neon rend celui-ci : la base est joignable, elle
  // refuse de servir. C'est ce qui a mis l'application à terre.
  '53000': 'quota_depasse',
  '53300': 'trop_de_connexions',
  '57P03': 'base_en_demarrage',
  '08006': 'connexion_interrompue',
  '08001': 'connexion_impossible',
  '08004': 'connexion_rejetee',
  '28P01': 'mot_de_passe_refuse',
  '28000': 'authentification_refusee',
  '3D000': 'base_inexistante',
  ECONNREFUSED: 'connexion_refusee',
  ECONNRESET: 'connexion_coupee',
  ENOTFOUND: 'hote_introuvable',
  EAI_AGAIN: 'hote_introuvable',
  ETIMEDOUT: 'delai_depasse',
};

/**
 * Le nom de la cause si la base est indisponible, `null` si l'erreur vient
 * d'ailleurs — d'une requête fautive, par exemple.
 */
export function causeIndisponibilite(erreur: unknown): string | null {
  const code = (erreur as { code?: string } | null)?.code;
  if (!code) return null;
  return INDISPONIBLES[code] ?? null;
}

/**
 * Le nom de la cause, quoi qu'il arrive : `code_<x>` pour ce qui n'est pas
 * répertorié, `inconnue` pour une erreur sans code. Pour l'affichage.
 */
export function nommerLaCause(erreur: unknown): string {
  const connue = causeIndisponibilite(erreur);
  if (connue) return connue;
  const code = (erreur as { code?: string } | null)?.code;
  return code ? `code_${code}` : 'inconnue';
}
