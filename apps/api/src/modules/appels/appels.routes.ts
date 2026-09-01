/**
 * Canal de signalisation des appels.
 *
 * ## Pourquoi un WebSocket ici, et nulle part ailleurs
 *
 * Le reste de l'application se contente de sondages HTTP, et c'est très bien
 * pour des messages : quatre secondes de retard sur une phrase écrite ne se
 * remarquent pas. Un appel, si. Les chemins réseau candidats arrivent par
 * rafales pendant les deux premières secondes, et un sondage les perdrait.
 *
 * ## Ce qui transite
 *
 * Des enveloppes scellées, relayées sans être lues. Ce serveur connaît
 * l'existence d'un appel, ses deux participants et sa durée ; ni le son, ni
 * l'image, ni les empreintes qui les protègent.
 *
 * ## Le routage est explicite, jamais deviné
 *
 * Chaque signal est adressé au partenaire résolu depuis le couple. Une
 * première version poussait « à tous les sockets ouverts sauf le mien » pour
 * les fins d'appel : c'était une fuite vers les autres couples connectés au
 * même serveur.
 */

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { WebSocket } from 'ws';
import type { RaisonFin, SignalAppel, SorteAppel } from '@lonlonbenu/shared';
import type { ServeurAutorisation } from '../../securite/oauth/serveurAutorisation.ts';
import type { ServiceAppels } from './appels.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  pas_pour_moi: 403,
  couple_dissocie: 410,
  occupe: 409,
  etat_invalide: 409,
  charge_non_scellee: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesAppels(
  app: FastifyInstance,
  appels: ServiceAppels,
  autorisation: ServeurAutorisation,
  authentifier: preHandlerHookHandler,
): void {
  /**
   * Les sockets ouverts, par partenaire.
   *
   * Un seul par personne : une connexion plus récente remplace la précédente.
   * Sans cela, un socket resté ouvert après une coupure réseau capterait les
   * signaux sans que personne ne les reçoive.
   */
  const annuaire = new Map<string, WebSocket>();

  const pousser = (partenaireId: string, charge: unknown): boolean => {
    const socket = annuaire.get(partenaireId);
    if (!socket || socket.readyState !== socket.OPEN) return false;
    try {
      socket.send(JSON.stringify(charge));
      return true;
    } catch {
      return false;
    }
  };

  app.get('/appels/signal', { websocket: true }, async (socket, requete) => {
    // Le jeton passe en paramètre de requête : les en-têtes ne traversent pas
    // la poignée de main WebSocket depuis React Native.
    const { jeton } = requete.query as { jeton?: string };
    const identite = jeton ? await autorisation.verifierAcces(jeton) : undefined;
    if (!identite) {
      socket.close(4401, 'non_authentifie');
      return;
    }

    const moi = identite.partenaireId;
    annuaire.get(moi)?.close(4000, 'remplace');
    annuaire.set(moi, socket);

    socket.on('close', () => {
      if (annuaire.get(moi) === socket) annuaire.delete(moi);
    });

    socket.on('message', (brut: Buffer) => {
      void (async () => {
        let signal: SignalAppel & { coupleId?: string };
        try {
          signal = JSON.parse(brut.toString()) as SignalAppel & {
            coupleId?: string;
          };
        } catch {
          return;
        }
        if (!signal?.coupleId || !signal.appelId) return;

        // Le destinataire est résolu avant toute action : c'est lui, et
        // personne d'autre, qui recevra le signal.
        const destinataireId = await appels.partenaireOppose(
          signal.coupleId,
          moi,
        );
        if (!destinataireId) return;

        if (signal.sorte === 'fin') {
          const resultat = await appels.terminer(
            signal.coupleId,
            moi,
            signal.appelId,
            signal.raison,
          );
          if (resultat.ok && resultat.appel) {
            pousser(destinataireId, {
              sorte: 'fin',
              appel: resultat.appel,
              coupleId: signal.coupleId,
            });
          }
          return;
        }

        // Pour tout le reste, le service vérifie que l'appel est vivant et que
        // la charge a bien la forme d'une enveloppe scellée.
        const relais = await appels.autoriserRelais(
          signal.coupleId,
          moi,
          signal.appelId,
          signal.charge,
        );
        if (!relais.ok) return;

        pousser(destinataireId, { ...signal, de: moi });
      })();
    });
  });

  app.get(
    '/couples/:coupleId/appels/courant',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await appels.courant(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }
      return { appel: resultat.appel ?? null };
    },
  );

  app.post(
    '/couples/:coupleId/appels',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { sorte?: SorteAppel };
      if (corps?.sorte !== 'audio' && corps?.sorte !== 'video') {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const moi = requete.identite!.partenaireId;
      const resultat = await appels.proposer(coupleId, moi, corps.sorte);
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }

      // On fait sonner l'autre par le canal ouvert. S'il n'y est pas, la
      // notification push prendra le relais : un appel qui ne sonne pas n'est
      // pas un appel.
      const destinataireId = await appels.partenaireOppose(coupleId, moi);
      if (destinataireId) {
        pousser(destinataireId, {
          sorte: 'sonne',
          appel: resultat.appel,
          coupleId,
        });
      }

      return reponse.code(201).send({ appel: resultat.appel });
    },
  );

  app.post(
    '/couples/:coupleId/appels/:appelId/accepter',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, appelId } = requete.params as {
        coupleId: string;
        appelId: string;
      };
      const moi = requete.identite!.partenaireId;

      const resultat = await appels.accepter(coupleId, moi, appelId);
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }

      // L'appelant doit savoir qu'on a décroché : c'est ce qui déclenche
      // l'échange des descriptions de session de son côté.
      const destinataireId = await appels.partenaireOppose(coupleId, moi);
      if (destinataireId) {
        pousser(destinataireId, {
          sorte: 'decroche',
          appel: resultat.appel,
          coupleId,
        });
      }

      return { appel: resultat.appel };
    },
  );

  app.post(
    '/couples/:coupleId/appels/:appelId/fin',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, appelId } = requete.params as {
        coupleId: string;
        appelId: string;
      };
      const corps = requete.body as { raison?: RaisonFin };
      const moi = requete.identite!.partenaireId;

      const resultat = await appels.terminer(
        coupleId,
        moi,
        appelId,
        corps?.raison ?? 'raccroche',
      );
      if (!resultat.ok) {
        return reponse
          .code(repondre(resultat.motif))
          .send({ motif: resultat.motif });
      }

      const destinataireId = await appels.partenaireOppose(coupleId, moi);
      if (destinataireId) {
        pousser(destinataireId, {
          sorte: 'fin',
          appel: resultat.appel,
          coupleId,
        });
      }

      return { appel: resultat.appel };
    },
  );
}
