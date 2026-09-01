import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceConnexion } from './connexion.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  choix_invalides: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

/** Jour civil du serveur, à défaut de celui demandé par le client. */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Le jour vient du client quand il est lisible.
 *
 * Deux téléphones peuvent être de part et d'autre de minuit, et le rituel du
 * jour doit être le même des deux côtés — pas celui de la veille pour l'un.
 */
const jourDemande = (brut: unknown) =>
  typeof brut === 'string' && FORMAT_JOUR.test(brut) ? brut : aujourdhui();

export function enregistrerRoutesConnexion(
  app: FastifyInstance,
  connexion: ServiceConnexion,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/connexion',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const { jour } = requete.query as { jour?: string };

      const resultat = await connexion.lire(
        coupleId,
        requete.identite!.partenaireId,
        jourDemande(jour),
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return resultat.vue;
    },
  );

  app.put(
    '/couples/:coupleId/connexion/langages',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { choix?: unknown; jour?: string };
      if (!corps || typeof corps !== 'object' || !('choix' in corps)) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await connexion.repondre(
        coupleId,
        // On ne répond que pour soi : l'identité vient du jeton.
        requete.identite!.partenaireId,
        corps.choix as never,
        jourDemande(corps.jour),
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return resultat.vue;
    },
  );
}
