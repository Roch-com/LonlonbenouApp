import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceParcours } from './parcours.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  parcours_inconnu: 404,
  seance_inconnue: 404,
  parcours_non_engage: 409,
  parcours_termine: 409,
  pas_la_seance_courante: 409,
  deja_repondu: 409,
  deja_echangee: 409,
  reponses_incompletes: 409,
  texte_non_scelle: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesParcours(
  app: FastifyInstance,
  parcours: ServiceParcours,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/parcours',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await parcours.lister(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return {
        parcours: resultat.vues,
        // Absente la plupart du temps, et c'est voulu : une application qui a
        // toujours quelque chose à suggérer finit par n'être plus écoutée.
        recommandation: resultat.recommandation ?? null,
      };
    },
  );

  app.get(
    '/couples/:coupleId/parcours/:parcoursId',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, parcoursId } = requete.params as {
        coupleId: string;
        parcoursId: string;
      };
      const resultat = await parcours.lire(
        coupleId,
        requete.identite!.partenaireId,
        parcoursId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return resultat.vue;
    },
  );

  app.post(
    '/couples/:coupleId/parcours/:parcoursId/engager',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, parcoursId } = requete.params as {
        coupleId: string;
        parcoursId: string;
      };
      const resultat = await parcours.engager(
        coupleId,
        requete.identite!.partenaireId,
        parcoursId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return resultat.vue;
    },
  );

  app.post(
    '/couples/:coupleId/parcours/:parcoursId/seances/:seanceId',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, parcoursId, seanceId } = requete.params as {
        coupleId: string;
        parcoursId: string;
        seanceId: string;
      };
      const corps = requete.body as { texteScelle?: string };
      if (!corps?.texteScelle) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await parcours.repondre(
        coupleId,
        // L'auteur vient du jeton : on ne répond que pour soi.
        requete.identite!.partenaireId,
        parcoursId,
        seanceId,
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

  app.post(
    '/couples/:coupleId/parcours/:parcoursId/seances/:seanceId/echange',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, parcoursId, seanceId } = requete.params as {
        coupleId: string;
        parcoursId: string;
        seanceId: string;
      };
      const resultat = await parcours.echanger(
        coupleId,
        requete.identite!.partenaireId,
        parcoursId,
        seanceId,
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
