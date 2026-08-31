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

import * as Crypto from 'expo-crypto';
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

/** Délai d'une requête vers un serveur déjà éveillé. */
const DELAI_MS = 15_000;

/**
 * Délai accordé à une seconde tentative, quand la première a expiré.
 *
 * L'API est hébergée sur un palier gratuit qui met le serveur en veille après
 * un quart d'heure sans trafic ; le réveil prend jusqu'à une minute. Sans cette
 * patience, la toute première action de la journée échouerait
 * systématiquement, et l'app passerait pour cassée alors qu'elle attend.
 */
const DELAI_REVEIL_MS = 70_000;

let fournisseur: FournisseurDeJeton | undefined;

/**
 * Vrai tant qu'une requête est en cours de seconde tentative. L'interface peut
 * s'en servir pour dire « le serveur se réveille » plutôt que de laisser un
 * écran figé sans explication.
 */
let reveilEnCours = false;
const observateurs = new Set<(enCours: boolean) => void>();

export function serveurSeReveille(): boolean {
  return reveilEnCours;
}

export function observerLeReveil(ecouter: (enCours: boolean) => void): () => void {
  observateurs.add(ecouter);
  return () => observateurs.delete(ecouter);
}

function signalerReveil(enCours: boolean): void {
  if (reveilEnCours === enCours) return;
  reveilEnCours = enCours;
  for (const ecouter of observateurs) ecouter(enCours);
}

/** Branché une fois au démarrage par le store de session. */
export function brancherFournisseurDeJeton(nouveau: FournisseurDeJeton): void {
  fournisseur = nouveau;
}

async function envoyer(
  chemin: string,
  options: OptionsRequete,
  jeton: string | undefined,
  delaiMs: number = DELAI_MS,
  cleIdempotence?: string,
): Promise<Response> {
  const controleur = new AbortController();
  let expire = false;
  const minuterie = setTimeout(() => {
    expire = true;
    controleur.abort();
  }, delaiMs);

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
        ...(cleIdempotence ? { 'x-idempotence': cleIdempotence } : {}),
      },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: controleur.signal,
    });
  } catch (cause) {
    // Un délai dépassé n'est pas une absence de réseau : c'est peut-être un
    // serveur qui se réveille. L'appelant a besoin de la nuance pour décider
    // s'il attend davantage.
    throw new ErreurApi(
      expire ? 'reveil_trop_long' : 'hors_ligne',
      cause instanceof Error ? cause.message : 'Serveur injoignable',
    );
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Une tentative normale, puis une seconde beaucoup plus patiente si la
 * première a expiré. On ne réessaie que sur expiration : une absence de réseau
 * ne s'arrangera pas en attendant plus longtemps.
 */
async function envoyerAvecPatience(
  chemin: string,
  options: OptionsRequete,
  jeton: string | undefined,
  cleIdempotence?: string,
): Promise<Response> {
  try {
    return await envoyer(chemin, options, jeton, DELAI_MS, cleIdempotence);
  } catch (erreur) {
    if (!(erreur instanceof ErreurApi) || erreur.genre !== 'reveil_trop_long') {
      throw erreur;
    }
    signalerReveil(true);
    try {
      // **La même clé** que la tentative abandonnée. C'est tout l'intérêt :
      // `abort()` n'a interrompu que l'attente du téléphone, et le serveur a
      // pu traiter la première requête. Sans clé partagée, ce rejeu créait un
      // second message — le même mot affiché deux fois dans la conversation.
      return await envoyer(
        chemin,
        options,
        jeton,
        DELAI_REVEIL_MS,
        cleIdempotence,
      );
    } finally {
      signalerReveil(false);
    }
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
  // Une clé par appel logique, partagée par toutes ses tentatives. Seules les
  // créations en ont besoin : `PUT` et `DELETE` visent une ressource nommée et
  // sont déjà sans effet cumulé.
  const cle =
    (options.methode ?? 'GET') === 'POST' ? Crypto.randomUUID() : undefined;

  let reponse = await envoyerAvecPatience(chemin, options, jeton, cle);

  if (reponse.status === 401 && !options.sansJeton && fournisseur) {
    const renouvele = await fournisseur.rafraichir();
    if (!renouvele) {
      throw new ErreurApi('non_authentifie', 'Session expirée', 401);
    }
    reponse = await envoyerAvecPatience(chemin, options, renouvele, cle);
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
