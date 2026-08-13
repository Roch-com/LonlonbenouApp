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
import type { CoupleServeur, Depot, MessageScelle } from '../../domaine/depot.ts';

export type RefusChat =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'enveloppe_invalide'
  | 'cle_manquante';

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
  ): Promise<{ ok: boolean; motif?: RefusChat; message?: MessageScelle }>;
  marquerLus(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusChat }>;
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

      // Aucun filtrage à faire : les deux membres du couple ont droit aux mêmes
      // enveloppes, et le serveur serait de toute façon incapable de trier sur
      // un contenu qu'il ne peut pas lire.
      return { ok: true, messages: await depot.chat.messages(coupleId) };
    },

    async envoyer(coupleId, auteurId, enveloppe) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // Refus de tout ce qui n'a pas la forme d'une enveloppe scellée : c'est
      // la seule vérification possible, et elle empêche un client bogué de
      // déposer du clair par inadvertance.
      if (!estScelleMessage(enveloppe)) {
        return { ok: false, motif: 'enveloppe_invalide' };
      }

      const message: MessageScelle = {
        id: randomUUID(),
        auteurId,
        enveloppe,
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
  };
}
