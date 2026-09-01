import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceChat } from './chat.service.ts';
import type { ServicePresence } from '../presence/presence.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  enveloppe_invalide: 400,
  cle_manquante: 400,
  donnees_invalides: 400,
  position_non_scellee: 400,
  date_invalide: 400,
  deja_remis: 409,
  pas_mon_message: 403,
  deja_retire: 409,
  duree_invalide: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesChat(
  app: FastifyInstance,
  chat: ServiceChat,
  authentifier: preHandlerHookHandler,
): void {
  /**
   * Publication de la clé publique d'échange. Il n'existe **aucune** route
   * acceptant une clé privée, et il ne doit jamais en exister.
   */
  app.put(
    '/couples/:coupleId/chat/cle',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { clePublique?: string };
      if (!corps?.clePublique) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await chat.publierClePublique(
        coupleId,
        requete.identite!.partenaireId,
        corps.clePublique,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { cles: resultat.cles };
    },
  );

  app.get(
    '/couples/:coupleId/chat/cles',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await chat.cles(coupleId, requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { cles: resultat.cles };
    },
  );

  app.get(
    '/couples/:coupleId/chat',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await chat.lister(coupleId, requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { messages: resultat.messages };
    },
  );

  /**
   * Envoi. Le corps n'accepte **qu'une enveloppe scellée** : il n'y a pas de
   * champ `texte`, et un client qui en ajouterait un le verrait ignoré.
   */
  app.post(
    '/couples/:coupleId/chat',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        enveloppe?: string;
        remettreLe?: string;
        vocal?: { audioScelle?: string; dureeS?: number };
      };
      if (!corps?.enveloppe) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const vocal =
        corps.vocal?.audioScelle && typeof corps.vocal.dureeS === 'number'
          ? {
              audioScelle: corps.vocal.audioScelle,
              dureeS: corps.vocal.dureeS,
            }
          : undefined;

      const resultat = await chat.envoyer(
        coupleId,
        requete.identite!.partenaireId,
        corps.enveloppe,
        corps.remettreLe,
        vocal,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ message: resultat.message });
    },
  );

  app.put(
    '/couples/:coupleId/chat/lecture',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await chat.marquerLus(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );

  /** Mes envois programmés, pas encore remis. */
  app.get(
    '/couples/:coupleId/chat/programmes',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await chat.enAttente(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { messages: resultat.messages };
    },
  );

  app.delete(
    '/couples/:coupleId/chat/programmes/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await chat.annuler(
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

  // Retrait d'un message pour les deux. Seul son auteur le peut.
  app.delete(
    '/couples/:coupleId/chat/messages/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await chat.retirer(
        coupleId,
        requete.identite!.partenaireId,
        id,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { message: resultat.message };
    },
  );

  // Réaction. Un corps sans `emojiScelle` retire la sienne.
  app.put(
    '/couples/:coupleId/chat/messages/:id/reaction',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const corps = requete.body as { emojiScelle?: string };

      const resultat = await chat.reagir(
        coupleId,
        requete.identite!.partenaireId,
        id,
        corps?.emojiScelle,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { message: resultat.message };
    },
  );

  app.get(
    '/couples/:coupleId/chat/epingle',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await chat.epingle(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { epingle: resultat.epingle ?? null };
    },
  );

  // Un corps sans `messageId` décroche l'épingle.
  app.put(
    '/couples/:coupleId/chat/epingle',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { messageId?: string };

      const resultat = await chat.epingler(
        coupleId,
        requete.identite!.partenaireId,
        corps?.messageId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { epingle: resultat.epingle ?? null };
    },
  );
}

export function enregistrerRoutesPresence(
  app: FastifyInstance,
  presence: ServicePresence,
  authentifier: preHandlerHookHandler,
): void {
  app.get(
    '/couples/:coupleId/presence',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await presence.lire(
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
    '/couples/:coupleId/presence/statut',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        code?: string;
        noteScellee?: string;
        annoncer?: boolean;
      };
      if (!corps?.code) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await presence.definirStatut(
        coupleId,
        requete.identite!.partenaireId,
        corps.code,
        corps.noteScellee,
        corps.annoncer === true,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );

  /**
   * Dépôt de sa propre position, scellée.
   *
   * Aucun paramètre de partenaire : on ne pose que la sienne. La réciprocité
   * s'applique à la lecture, où le service décide si l'enveloppe de l'autre
   * franchit ou non la frontière du serveur.
   */
  app.put(
    '/couples/:coupleId/presence/position',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { positionScellee?: string };
      if (!corps?.positionScellee) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await presence.definirPosition(
        coupleId,
        requete.identite!.partenaireId,
        corps.positionScellee,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );

  app.put(
    '/couples/:coupleId/presence/humeur',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { code?: string; motScelle?: string };
      if (!corps?.code) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await presence.definirHumeur(
        coupleId,
        requete.identite!.partenaireId,
        corps.code,
        corps.motScelle,
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
    '/couples/:coupleId/presence/check-ins',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { lieuScelle?: string; motScelle?: string };
      if (!corps?.lieuScelle) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await presence.faireUnCheckIn(
        coupleId,
        requete.identite!.partenaireId,
        corps.lieuScelle,
        corps.motScelle,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ enregistre: true });
    },
  );

  app.post(
    '/couples/:coupleId/presence/sos',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        lieuScelle?: string;
        messageScelle?: string;
      };

      const resultat = await presence.declencherSos(
        coupleId,
        requete.identite!.partenaireId,
        corps?.lieuScelle,
        corps?.messageScelle,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ alerte: resultat.alerte });
    },
  );

  app.put(
    '/couples/:coupleId/presence/sos/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const corps = requete.body as { action?: 'vue' | 'resolue' };
      if (corps?.action !== 'vue' && corps?.action !== 'resolue') {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await presence.changerEtatAlerte(
        coupleId,
        requete.identite!.partenaireId,
        id,
        corps.action,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { alerte: resultat.alerte };
    },
  );
}
