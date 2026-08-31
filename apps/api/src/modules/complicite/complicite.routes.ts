import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceComplicite } from './complicite.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  donnees_invalides: 400,
  texte_non_scelle: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

/** Jour civil du serveur, à défaut de celui demandé par le client. */
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function enregistrerRoutesComplicite(
  app: FastifyInstance,
  complicite: ServiceComplicite,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/complicite',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const { jour } = requete.query as { jour?: string };

      const resultat = await complicite.lire(
        coupleId,
        requete.identite!.partenaireId,
        // Le jour vient du client : deux téléphones peuvent être de part et
        // d'autre de minuit, et forcer l'heure du serveur ferait répondre à
        // la question de la veille sans qu'on comprenne pourquoi.
        jour ?? aujourdhui(),
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
    '/couples/:coupleId/complicite',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { jour?: string; texteScelle?: string };
      if (!corps?.texteScelle) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await complicite.repondre(
        coupleId,
        requete.identite!.partenaireId,
        corps.jour ?? aujourdhui(),
        corps.texteScelle,
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
