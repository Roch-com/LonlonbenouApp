/**
 * Pôle ① — Chat du couple. **Le serveur achemine, il ne lit pas.**
 *
 * C'est la différence avec les tranches précédentes : ailleurs, le serveur
 * décidait de ce qui redescend. Ici il n'a rien à décider, parce qu'il n'a rien
 * compris. Une enveloppe `m1.<nonce>.<scellé>` entre, la même ressort.
 *
 * Ce qui rend la promesse crédible n'est pas une discipline d'appel mais
 * l'absence de surface : **aucun champ de texte en clair n'existe** — ni dans
 * le modèle, ni dans le schéma, ni dans les corps de requête acceptés. On ne
 * divulgue pas ce qu'on n'a pas de place pour stocker.
 *
 * Ce que le serveur voit malgré tout, et qu'il faut assumer : qui écrit à qui,
 * quand, à quel rythme, et la taille des messages. Les métadonnées ne sont pas
 * chiffrées, et aucune formulation ne doit laisser croire le contraire.
 */

import { randomUUID } from 'node:crypto';
import { estScelleMessage, type PartenaireId } from '@lonlonbenu/shared';
import type {
  CoupleServeur,
  Depot,
  EpingleServeur,
  MessageScelle,
} from '../../domaine/depot.ts';

export type RefusChat =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'enveloppe_invalide'
  | 'date_invalide'
  | 'deja_remis'
  | 'introuvable'
  | 'cle_manquante'
  /** On ne retire que ses propres messages. */
  | 'pas_mon_message'
  /** Un message déjà retiré n'a plus rien à retirer. */
  | 'deja_retire';

export interface ClesDuCouple {
  /** Ma clé publique, si je l'ai publiée. */
  mienne?: string;
  /** Celle de l'autre, indispensable pour lui écrire. */
  autre?: string;
  /** Faux tant que l'un des deux n'a pas publié la sienne. */
  echangePret: boolean;
}

export interface ServiceChat {
  publierClePublique(
    coupleId: string,
    partenaireId: PartenaireId,
    clePublique: string,
  ): Promise<{ ok: boolean; motif?: RefusChat; cles?: ClesDuCouple }>;
  cles(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat; cles?: ClesDuCouple }>;
  lister(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat; messages?: MessageScelle[] }>;
  envoyer(
    coupleId: string,
    auteurId: PartenaireId,
    enveloppe: string,
    /**
     * Message programmé (§8.3) : instant de remise, ISO 8601. Absent = tout
     * de suite.
     */
    remettreLe?: string,
  ): Promise<{ ok: boolean; motif?: RefusChat; message?: MessageScelle }>;
  /** Messages que j'ai programmés et qui n'ont pas encore été remis. */
  enAttente(
    coupleId: string,
    auteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat; messages?: MessageScelle[] }>;
  /** Annule un envoi programmé. Seul son auteur le peut. */
  annuler(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusChat }>;
  marquerLus(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat }>;
  /** Retire un message pour les deux. Seul son auteur le peut. */
  retirer(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusChat; message?: MessageScelle }>;
  /** Pose, remplace ou retire sa réaction. `undefined` retire. */
  reagir(
    coupleId: string,
    partenaireId: PartenaireId,
    messageId: string,
    emojiScelle?: string,
  ): Promise<{ ok: boolean; motif?: RefusChat; message?: MessageScelle }>;
  epingle(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat; epingle?: EpingleServeur }>;
  /** Épingle un message, ou décroche l'épingle si `messageId` est absent. */
  epingler(
    coupleId: string,
    partenaireId: PartenaireId,
    messageId?: string,
  ): Promise<{ ok: boolean; motif?: RefusChat; epingle?: EpingleServeur }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusChat }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceChat(depot: Depot): ServiceChat {
  async function clesDuCouple(
    couple: CoupleServeur,
    lecteurId: PartenaireId,
  ): Promise<ClesDuCouple> {
    const autreId = couple.couple.partenaires.find((p) => p.id !== lecteurId)?.id;
    const [mienne, autre] = await Promise.all([
      depot.chat.clePublique(lecteurId),
      autreId ? depot.chat.clePublique(autreId) : Promise.resolve(undefined),
    ]);
    return { mienne, autre, echangePret: !!mienne && !!autre };
  }

  return {
    async publierClePublique(coupleId, partenaireId, clePublique) {
      const acces = await autoriser(depot, coupleId, partenaireId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!clePublique.trim()) return { ok: false, motif: 'cle_manquante' };

      // Le serveur ne stocke que des clés publiques. Il n'existe aucun endpoint
      // qui accepterait une clé privée, et il ne doit jamais en exister.
      await depot.chat.definirClePublique(partenaireId, clePublique.trim());
      return { ok: true, cles: await clesDuCouple(acces.couple, partenaireId) };
    },

    async cles(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      return { ok: true, cles: await clesDuCouple(acces.couple, lecteurId) };
    },

    async lister(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // Les deux membres ont droit aux mêmes enveloppes, et le serveur serait
      // de toute façon incapable de trier sur un contenu qu'il ne peut pas
      // lire. Le seul filtre porte sur le temps : un message programmé
      // n'apparaît dans la conversation qu'à l'heure dite — et pas même chez
      // son auteur, sinon la capsule n'aurait plus de sens pour lui.
      const maintenant = Date.now();
      const messages = (await depot.chat.messages(coupleId)).filter(
        (m) => !m.remettreLe || Date.parse(m.remettreLe) <= maintenant,
      );

      return { ok: true, messages };
    },

    async enAttente(coupleId, auteurId) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const maintenant = Date.now();
      // Les siens seulement : voir ceux de l'autre reviendrait à connaître
      // à l'avance une surprise qu'il prépare.
      return {
        ok: true,
        messages: (await depot.chat.messages(coupleId)).filter(
          (m) =>
            m.auteurId === auteurId &&
            m.remettreLe !== undefined &&
            Date.parse(m.remettreLe) > maintenant,
        ),
      };
    },

    async annuler(coupleId, auteurId, id) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const message = (await depot.chat.messages(coupleId)).find(
        (m) => m.id === id,
      );
      if (!message || message.auteurId !== auteurId) {
        return { ok: false, motif: 'introuvable' };
      }

      // Un message déjà remis ne s'annule pas : il a été lu, peut-être
      // répondu. Le retirer réécrirait une conversation à deux.
      if (!message.remettreLe || Date.parse(message.remettreLe) <= Date.now()) {
        return { ok: false, motif: 'deja_remis' };
      }

      await depot.chat.supprimer(coupleId, id);
      return { ok: true };
    },

    async envoyer(coupleId, auteurId, enveloppe, remettreLe) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // Refus de tout ce qui n'a pas la forme d'une enveloppe scellée : c'est
      // la seule vérification possible, et elle empêche un client bogué de
      // déposer du clair par inadvertance.
      if (!estScelleMessage(enveloppe)) {
        return { ok: false, motif: 'enveloppe_invalide' };
      }

      // Une date de remise illisible ferait un message jamais délivré : il
      // disparaîtrait de la conversation sans que personne ne sache pourquoi.
      if (remettreLe !== undefined && Number.isNaN(Date.parse(remettreLe))) {
        return { ok: false, motif: 'date_invalide' };
      }

      const message: MessageScelle = {
        id: randomUUID(),
        auteurId,
        enveloppe,
        // Une date déjà passée n'est pas une erreur : c'est un envoi
        // immédiat, et refuser ferait échouer une programmation à la minute
        // près pour rien.
        remettreLe:
          remettreLe && Date.parse(remettreLe) > Date.now() ? remettreLe : undefined,
        envoyeLe: new Date().toISOString(),
      };
      await depot.chat.ajouter(coupleId, message);
      return { ok: true, message };
    },

    async marquerLus(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      await depot.chat.marquerLus(coupleId, lecteurId, new Date().toISOString());
      return { ok: true };
    },

    /**
     * Retire un message pour les deux.
     *
     * **Seul son auteur le peut.** Retirer le message de l'autre reviendrait à
     * effacer sa parole, ce qu'aucune messagerie ne permet et qu'un couple ne
     * devrait pas pouvoir faire.
     *
     * L'enveloppe est vidée du serveur : le texte disparaît vraiment. La ligne
     * reste, et les deux voient qu'un message a été retiré — sans quoi l'autre
     * verrait un trou dans la conversation et douterait de ce qu'il a lu.
     */
    async retirer(coupleId, auteurId, id) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const message = await depot.chat.messageParId(coupleId, id);
      if (!message) return { ok: false, motif: 'introuvable' };
      if (message.auteurId !== auteurId) {
        return { ok: false, motif: 'pas_mon_message' };
      }
      if (message.retireLe) return { ok: false, motif: 'deja_retire' };

      await depot.chat.retirer(coupleId, id, new Date().toISOString());

      // Un message épinglé qui vient d'être retiré ne doit pas rester en
      // bandeau : l'épingle pointerait sur un vide.
      const epingle = await depot.chat.epingle(coupleId);
      if (epingle?.messageId === id) await depot.chat.desepingler(coupleId);

      return {
        ok: true,
        message: (await depot.chat.messageParId(coupleId, id))!,
      };
    },

    /**
     * Réagit à un message, ou retire sa réaction.
     *
     * On réagit à ses propres messages comme à ceux de l'autre : c'est ainsi
     * partout, et l'interdire n'aurait protégé de rien.
     */
    async reagir(coupleId, partenaireId, messageId, emojiScelle) {
      const acces = await autoriser(depot, coupleId, partenaireId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const message = await depot.chat.messageParId(coupleId, messageId);
      if (!message) return { ok: false, motif: 'introuvable' };
      // Un message retiré n'a plus de contenu : il n'y a plus à quoi réagir.
      if (message.retireLe) return { ok: false, motif: 'deja_retire' };

      if (emojiScelle === undefined) {
        await depot.chat.retirerReaction(coupleId, messageId, partenaireId);
      } else {
        if (!estScelleMessage(emojiScelle)) {
          return { ok: false, motif: 'enveloppe_invalide' };
        }
        await depot.chat.reagir(coupleId, messageId, {
          partenaireId,
          emojiScelle,
          majLe: new Date().toISOString(),
        });
      }

      return {
        ok: true,
        message: (await depot.chat.messageParId(coupleId, messageId))!,
      };
    },

    async epingle(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const epingle = await depot.chat.epingle(coupleId);
      return { ok: true, ...(epingle ? { epingle } : {}) };
    },

    /**
     * Épingle un message, ou décroche l'épingle.
     *
     * Les deux peuvent épingler et décrocher : l'épingle appartient à la
     * conversation, pas à celui qui l'a posée. Une épingle que seul son auteur
     * pourrait retirer serait une décision imposée à l'autre.
     */
    async epingler(coupleId, partenaireId, messageId) {
      const acces = await autoriser(depot, coupleId, partenaireId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (messageId === undefined) {
        await depot.chat.desepingler(coupleId);
        return { ok: true };
      }

      const message = await depot.chat.messageParId(coupleId, messageId);
      if (!message) return { ok: false, motif: 'introuvable' };
      if (message.retireLe) return { ok: false, motif: 'deja_retire' };

      const epingle: EpingleServeur = {
        messageId,
        epinglePar: partenaireId,
        epingleLe: new Date().toISOString(),
      };
      await depot.chat.epingler(coupleId, epingle);
      return { ok: true, epingle };
    },
  };
}
