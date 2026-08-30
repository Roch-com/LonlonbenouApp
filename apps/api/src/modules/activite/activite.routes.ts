import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceActivite } from './activite.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesActivite(
  app: FastifyInstance,
  activite: ServiceActivite,
  authentifier: preHandlerHookHandler,
): void {
  /**
   * Battement de cœur. Appelé pendant qu'une conversation est à l'écran, et
   * avec `ecrit` pendant qu'on tape.
   *
   * Volontairement combiné à la lecture : signaler puis lire, en un seul
   * aller-retour. Deux requêtes toutes les vingt secondes pour afficher une
   * ligne de sous-titre seraient un mauvais compte.
   */
  app.post(
    '/couples/:coupleId/activite',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = (requete.body ?? {}) as { ecrit?: boolean };

      const signal = await activite.signaler(
        coupleId,
        requete.identite!.partenaireId,
        corps.ecrit === true,
      );
      if (!signal.ok) {
        return reponse.code(repondre(signal.motif)).send({ motif: signal.motif });
      }

      const lu = await activite.lire(coupleId, requete.identite!.partenaireId);
      if (!lu.ok) {
        return reponse.code(repondre(lu.motif)).send({ motif: lu.motif });
      }
      return lu.vue;
    },
  );

  /** Lecture seule, pour un écran qui veut regarder sans se signaler. */
  app.get(
    '/couples/:coupleId/activite',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await activite.lire(
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
}
