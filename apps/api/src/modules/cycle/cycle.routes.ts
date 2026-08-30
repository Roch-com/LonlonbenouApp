import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { Intensite, NiveauCycle, TypeSymptome } from '@lonlonbenu/shared';
import type { ServiceCycle } from './cycle.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  cycle_non_declare: 409,
  pas_la_porteuse: 403,
  niveau_indisponible: 409,
  donnees_invalides: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesCycle(
  app: FastifyInstance,
  cycle: ServiceCycle,
  authentifier: preHandlerHookHandler,
): void {
  /**
   * Lecture. La forme de la réponse dépend de qui demande : la personne
   * concernée reçoit son cycle, l'autre reçoit la projection de
   * `vuePartenaire` — jamais la donnée brute.
   */
  app.get(
    '/couples/:coupleId/cycle',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await cycle.lire(coupleId, requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return resultat.vue;
    },
  );

  /** Déclarer qui suit un cycle. Verrouillé dès que quelqu'un est désigné. */
  app.put(
    '/couples/:coupleId/cycle/porteuse',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { porteuseId?: string };
      if (!corps?.porteuseId) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await cycle.declarer(
        coupleId,
        requete.identite!.partenaireId,
        corps.porteuseId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { partage: resultat.partage };
    },
  );

  app.put(
    '/couples/:coupleId/cycle/duree',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { duree?: number | null };

      // `null` explicite = revenir au calcul observé. L'absence du champ est
      // une requête mal formée, pas une demande d'effacement : confondre les
      // deux effacerait un réglage sur un simple corps vide.
      if (corps === undefined || !('duree' in (corps ?? {}))) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await cycle.definirDuree(
        coupleId,
        requete.identite!.partenaireId,
        corps.duree ?? undefined,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { partage: resultat.partage };
    },
  );

  app.put(
    '/couples/:coupleId/cycle/niveau',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { niveau?: NiveauCycle };
      if (!corps?.niveau) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await cycle.definirNiveau(
        coupleId,
        requete.identite!.partenaireId,
        corps.niveau,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { partage: resultat.partage };
    },
  );

  app.post(
    '/couples/:coupleId/cycle/regles',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { debutLe?: string; finLe?: string };
      if (!corps?.debutLe) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await cycle.enregistrerRegles(
        coupleId,
        requete.identite!.partenaireId,
        corps.debutLe,
        corps.finLe,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ enregistre: true });
    },
  );

  app.delete(
    '/couples/:coupleId/cycle/regles/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await cycle.supprimerRegles(
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

  app.post(
    '/couples/:coupleId/cycle/symptomes',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        date?: string;
        type?: TypeSymptome;
        intensite?: Intensite;
        note?: string;
      };
      if (!corps?.date || !corps.type || !corps.intensite) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await cycle.noterSymptome(
        coupleId,
        requete.identite!.partenaireId,
        corps.date,
        corps.type,
        corps.intensite,
        corps.note,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ enregistre: true });
    },
  );

  app.delete(
    '/couples/:coupleId/cycle/symptomes/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await cycle.retirerSymptome(
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
