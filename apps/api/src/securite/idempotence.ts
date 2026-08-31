import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Rejeu sans effet : une même création envoyée deux fois n'en produit qu'une.
 *
 * ## Le problème que cela répare
 *
 * Le client abandonne une requête au bout de quinze secondes puis la rejoue,
 * parce que l'hébergement gratuit met jusqu'à une minute à se réveiller. Or
 * `abort()` n'annule que l'attente du téléphone : le serveur, lui, a très bien
 * pu recevoir la requête et la traiter. Le message était donc créé une fois
 * par la tentative abandonnée, une seconde fois par le rejeu — et la
 * conversation affichait le même mot deux fois.
 *
 * Renoncer au rejeu réglerait le doublon et ramènerait l'autre défaut : la
 * première action de la journée échouerait, systématiquement, pendant le
 * réveil du serveur. Il faut donc pouvoir rejouer **sans** dupliquer.
 *
 * ## La clé
 *
 * Le client tire un identifiant par requête logique et le réutilise pour ses
 * tentatives. La première réponse est mémorisée sous cette clé ; toute
 * tentative suivante la reçoit telle quelle, sans que la route ne s'exécute.
 *
 * La clé est portée par la personne authentifiée : deux appareils ne peuvent
 * pas se voler mutuellement une réponse, même en devinant une clé.
 *
 * ## Ce que cela ne couvre pas
 *
 * Seules les requêtes `POST`. `PUT` et `DELETE` visent ici des ressources
 * nommées et sont déjà idempotentes par construction — poser deux fois le même
 * niveau de partage donne le même état.
 *
 * La mémoire suffit : la fenêtre à couvrir est celle d'un rejeu, quelques
 * dizaines de secondes. Un redémarrage entre les deux tentatives ferait
 * réapparaître le doublon, mais il rendrait aussi la seconde tentative
 * inutile — c'est un cas où l'on n'a rien à sauver.
 */

/** Au-delà, un rejeu n'a plus de sens : le client a renoncé depuis longtemps. */
const DUREE_MS = 5 * 60_000;

/** Garde-fou mémoire. Bien au-delà de ce que deux téléphones produisent. */
const ENTREES_MAX = 500;

interface ReponseMemorisee {
  statut: number;
  corps: unknown;
  expireA: number;
}

export interface RegistreIdempotence {
  /** Purge les entrées expirées. Exposé pour les tests. */
  nettoyer(maintenant?: number): void;
  taille(): number;
}

export function enregistrerIdempotence(
  app: FastifyInstance,
): RegistreIdempotence {
  const memoire = new Map<string, ReponseMemorisee>();

  const nettoyer = (maintenant = Date.now()) => {
    for (const [cle, entree] of memoire) {
      if (entree.expireA <= maintenant) memoire.delete(cle);
    }
  };

  /**
   * Clé complète : sans identité, une clé devinée lirait la réponse d'autrui.
   *
   * L'identité vient du jeton **brut** et non de `requete.identite` : les
   * crochets d'instance s'exécutent avant les `preHandler` de route, donc
   * avant l'authentification. En lisant `identite`, la recherche se faisait
   * sous « anonyme » et la mémorisation sous le vrai identifiant — les deux
   * clés ne se rencontraient jamais et le rejeu créait un second message.
   *
   * Le jeton est haché : il n'a pas à traîner en clair dans une clé de Map,
   * et un préfixe de hachage suffit à séparer deux appareils.
   */
  const cleComplete = (
    requete: { headers: Record<string, unknown>; url: string },
    fournie: string,
  ) => {
    const entete = requete.headers['authorization'];
    const porteur =
      typeof entete === 'string'
        ? createHash('sha256').update(entete).digest('hex').slice(0, 16)
        : 'anonyme';
    return `${porteur}|${requete.url}|${fournie}`;
  };

  app.addHook('preHandler', async (requete, reponse) => {
    if (requete.method !== 'POST') return;
    const fournie = requete.headers['x-idempotence'];
    if (typeof fournie !== 'string' || !fournie) return;

    nettoyer();
    const memorisee = memoire.get(cleComplete(requete, fournie));
    if (!memorisee) return;

    // Rejeu reconnu : on rend la première réponse sans exécuter la route.
    return reponse.code(memorisee.statut).send(memorisee.corps);
  });

  app.addHook('onSend', async (requete, reponse, charge) => {
    if (requete.method !== 'POST') return charge;
    const fournie = requete.headers['x-idempotence'];
    if (typeof fournie !== 'string' || !fournie) return charge;

    const cle = cleComplete(requete, fournie);
    // Déjà mémorisée : c'est le rejeu que l'on vient de servir.
    if (memoire.has(cle)) return charge;

    // Les échecs ne sont pas mémorisés : un rejeu doit pouvoir réussir là où
    // la première tentative a échoué pour une raison passagère.
    if (reponse.statusCode >= 400) return charge;

    if (memoire.size >= ENTREES_MAX) {
      nettoyer();
      // Toujours plein : on sacrifie la plus ancienne plutôt que de grossir.
      if (memoire.size >= ENTREES_MAX) {
        const premiere = memoire.keys().next();
        if (!premiere.done) memoire.delete(premiere.value);
      }
    }

    let corps: unknown;
    try {
      corps = typeof charge === 'string' ? JSON.parse(charge) : charge;
    } catch {
      // Corps non-JSON : on ne mémorise pas plutôt que de rendre n'importe quoi.
      return charge;
    }

    memoire.set(cle, {
      statut: reponse.statusCode,
      corps,
      expireA: Date.now() + DUREE_MS,
    });
    return charge;
  });

  return { nettoyer, taille: () => memoire.size };
}
