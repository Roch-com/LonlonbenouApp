import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceJournal } from './journal.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
};

export function enregistrerRoutesJournal(
  app: FastifyInstance,
  journal: ServiceJournal,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/journal',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await journal.lire(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
      }
      // Incomplet par construction : les souvenirs sont scelles, le mobile
      // ajoute les siens une fois ouverts.
      return { entrees: resultat.entrees };
    },
  );
}
