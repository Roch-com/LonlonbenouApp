/**
 * Client HTTP de l'API.
 *
 * Deux responsabilités, et pas une de plus : porter le jeton d'accès, et le
 * rafraîchir quand le serveur répond 401.
 *
 * Le rafraîchissement passe par `volUnique` : si dix requêtes partent ensemble
 * et se prennent toutes un 401, une seule rotation a lieu et les neuf autres
 * attendent son résultat. Sans cela, dix rotations concurrentes s'invalideraient
 * mutuellement — le serveur révoque la famille dès qu'un jeton déjà tourné est
 * rejoué, et l'utilisateur serait déconnecté par son propre client.
 */

import { CONFIGURATION_API } from './configuration';
import { ErreurApi, genreDepuisStatut } from './erreurs';

export { volUnique } from './volUnique';

export interface OptionsRequete {
  methode?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  corps?: unknown;
  /** Requêtes du flux d'authentification : ne pas tenter de rafraîchir. */
  sansJeton?: boolean;
  signal?: AbortSignal;
}

export interface FournisseurDeJeton {
  jetonActuel(): string | undefined;
  /** Rend le nouveau jeton d'accès, ou `undefined` si la session est perdue. */
  rafraichir(): Promise<string | undefined>;
}

const DELAI_MS = 15_000;

let fournisseur: FournisseurDeJeton | undefined;

/** Branché une fois au démarrage par le store de session. */
export function brancherFournisseurDeJeton(nouveau: FournisseurDeJeton): void {
  fournisseur = nouveau;
}

async function envoyer(
  chemin: string,
  options: OptionsRequete,
  jeton: string | undefined,
): Promise<Response> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);

  // Un signal fourni par l'appelant doit aussi pouvoir annuler.
  options.signal?.addEventListener('abort', () => controleur.abort());

  try {
    return await fetch(`${CONFIGURATION_API.base}${chemin}`, {
      method: options.methode ?? 'GET',
      headers: {
        // Pas de corps, pas de `content-type` : l'annoncer à vide fait
        // légitimement échouer les serveurs stricts.
        ...(options.corps === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: controleur.signal,
    });
  } catch (cause) {
    throw new ErreurApi(
      'hors_ligne',
      cause instanceof Error ? cause.message : 'Serveur injoignable',
    );
  } finally {
    clearTimeout(minuterie);
  }
}

async function lireLeCorps<T>(reponse: Response): Promise<T> {
  if (reponse.status === 204) return undefined as T;
  const texte = await reponse.text();
  if (!texte) return undefined as T;
  try {
    return JSON.parse(texte) as T;
  } catch {
    throw new ErreurApi('serveur', 'Réponse illisible', reponse.status);
  }
}

export async function appeler<T>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const jeton = options.sansJeton ? undefined : fournisseur?.jetonActuel();
  let reponse = await envoyer(chemin, options, jeton);

  if (reponse.status === 401 && !options.sansJeton && fournisseur) {
    const renouvele = await fournisseur.rafraichir();
    if (!renouvele) {
      throw new ErreurApi('non_authentifie', 'Session expirée', 401);
    }
    reponse = await envoyer(chemin, options, renouvele);
  }

  if (!reponse.ok) {
    const corps = await lireLeCorps<{ motif?: string; message?: string }>(
      reponse,
    ).catch(() => undefined);
    throw new ErreurApi(
      genreDepuisStatut(reponse.status),
      corps?.message ?? corps?.motif ?? `HTTP ${reponse.status}`,
      reponse.status,
      corps?.motif,
    );
  }

  return lireLeCorps<T>(reponse);
}
