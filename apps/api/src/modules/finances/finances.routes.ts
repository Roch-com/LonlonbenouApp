import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceFinances } from './finances.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  donnees_invalides: 400,
  contenu_non_scelle: 400,
  module_inactif: 409,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesFinances(
  app: FastifyInstance,
  finances: ServiceFinances,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/finances',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await finances.lire(
        coupleId,
        requete.identite!.partenaireId,
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
    '/couples/:coupleId/finances/reglages',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = (requete.body ?? {}) as {
        actif?: boolean;
        devise?: string;
        reglesScellees?: string | null;
      };

      const resultat = await finances.definirReglages(
        coupleId,
        requete.identite!.partenaireId,
        corps,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { reglages: resultat.reglages };
    },
  );

  app.post(
    '/couples/:coupleId/finances/depenses',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { jour?: string; contenuScelle?: string };
      if (!corps?.jour || !corps.contenuScelle) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await finances.ajouterDepense(
        coupleId,
        requete.identite!.partenaireId,
        corps.jour,
        corps.contenuScelle,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ depense: resultat.depense });
    },
  );

  app.delete(
    '/couples/:coupleId/finances/depenses/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await finances.supprimerDepense(
        coupleId,
        requete.identite!.partenaireId,
        id,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );
}
