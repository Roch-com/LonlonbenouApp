import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Depot } from '../domaine/depot.ts';
import type { ServeurAutorisation } from './oauth/serveurAutorisation.ts';

export interface Identite {
  partenaireId: string;
  jti: string;
  portee: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    identite?: Identite;
  }
}

/**
 * Vérifie le jeton d'accès et pose l'identité sur la requête.
 *
 * **L'appartenance au couple n'est pas dans le jeton**, elle est résolue en
 * base à chaque requête. Un identifiant de couple porté par un JWT resterait
 * vrai dix minutes après une dissociation : une révocation qui met dix minutes
 * n'est pas une révocation immédiate.
 */
export function creerAuthentification(
  autorisation: ServeurAutorisation,
  depot: Depot,
) {
  return async function authentifier(
    requete: FastifyRequest,
    reponse: FastifyReply,
  ): Promise<void> {
    const entete = requete.headers.authorization;
    const jeton = entete?.startsWith('Bearer ') ? entete.slice(7).trim() : undefined;
    if (!jeton) {
      await reponse.code(401).send({ motif: 'non_authentifie' });
      return;
    }

    const charge = await autorisation.verifierAcces(jeton);
    if (!charge) {
      await reponse.code(401).send({ motif: 'jeton_invalide' });
      return;
    }

    const params = requete.params as { coupleId?: string };
    if (params.coupleId !== undefined) {
      const couple = await depot.couples.parPartenaire(charge.partenaireId);
      if (!couple || couple.id !== params.coupleId) {
        // Ne pas distinguer « ce couple n'existe pas » de « vous n'en êtes
        // pas » : la réponse ne doit pas servir à énumérer les couples.
        await reponse.code(403).send({ motif: 'non_membre' });
        return;
      }
    }

    requete.identite = {
      partenaireId: charge.partenaireId,
      jti: charge.jti,
      portee: charge.portee,
    };
  };
}
