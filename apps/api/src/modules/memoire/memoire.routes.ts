import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { SorteSouvenir } from '@lonlonbenu/shared';
import type { ServiceMemoire } from './memoire.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  donnees_invalides: 400,
  contenu_non_scelle: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesMemoire(
  app: FastifyInstance,
  memoire: ServiceMemoire,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/souvenirs',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await memoire.lister(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { souvenirs: resultat.souvenirs };
    },
  );

  app.post(
    '/couples/:coupleId/souvenirs',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        sorte?: SorteSouvenir;
        jour?: string;
        contenuScelle?: string;
      };
      if (!corps?.sorte || !corps.jour || !corps.contenuScelle) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await memoire.ajouter(
        coupleId,
        requete.identite!.partenaireId,
        corps.sorte,
        corps.jour,
        corps.contenuScelle,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ souvenir: resultat.souvenir });
    },
  );

  app.delete(
    '/couples/:coupleId/souvenirs/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await memoire.supprimer(
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
