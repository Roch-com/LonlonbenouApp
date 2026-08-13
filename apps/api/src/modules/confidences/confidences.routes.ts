import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { TypeConfidence } from '@lonlonbenu/shared';
import type { ServiceConfidences } from './confidences.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  pas_le_destinataire: 403,
  couple_dissocie: 410,
  texte_vide: 400,
  type_inconnu: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesConfidences(
  app: FastifyInstance,
  confidences: ServiceConfidences,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/confidences',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const { type } = requete.query as { type?: TypeConfidence };

      const resultat = await confidences.lister(
        coupleId,
        requete.identite!.partenaireId,
        type,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return { confidences: resultat.confidences };
    },
  );

  /**
   * Envoi — et **seule** création possible. Il n'existe volontairement aucun
   * endpoint de brouillon : une lettre non envoyée n'a rien à faire ici.
   */
  app.post(
    '/couples/:coupleId/confidences',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        type?: TypeConfidence;
        texte?: string;
        titre?: string;
      };
      if (!corps?.type || !corps.texte) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await confidences.envoyer(
        coupleId,
        requete.identite!.partenaireId,
        corps.type,
        corps.texte,
        corps.titre,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ confidence: resultat.confidence });
    },
  );

  app.put(
    '/couples/:coupleId/confidences/:id/lecture',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await confidences.marquerLue(
        coupleId,
        requete.identite!.partenaireId,
        id,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return { confidence: resultat.confidence };
    },
  );

  // Ni DELETE, ni PUT sur le contenu : l'envoi est irréversible. Un texte
  // offert appartient aussi à celui qui l'a reçu.
}
