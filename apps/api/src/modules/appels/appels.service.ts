/**
 * Pôle ① — appels, côté serveur.
 *
 * ## Le serveur ne fait que relayer
 *
 * Il ne voit passer ni son ni image : ceux-là vont directement d'un téléphone
 * à l'autre. Il achemine la négociation, et il la relaie **scellée** — il ne
 * peut donc ni la lire ni y substituer ses propres empreintes, ce qui est la
 * seule chose qui l'empêcherait de s'intercaler dans un appel.
 *
 * ## Un appel à la fois
 *
 * À deux, il n'y a pas de raison d'en avoir plusieurs, et l'autoriser
 * ouvrirait des questions sans réponse — que fait-on du premier ? Une
 * proposition reçue pendant qu'un appel est en cours est refusée « occupé »,
 * comme partout.
 *
 * ## Ce qui n'est pas conservé
 *
 * Aucune trace du contenu, évidemment, mais aussi aucune trace des chemins
 * réseau échangés : les candidats sont relayés puis oubliés. Ils décrivent la
 * position réseau des deux téléphones, ce qui est exactement le genre
 * d'historique que le module Carte & Présence a refusé de tenir.
 */

import { randomUUID } from 'node:crypto';
import {
  appelActif,
  estScelleMessage,
  sonnerieExpiree,
  type Appel,
  type PartenaireId,
  type RaisonFin,
  type SorteAppel,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusAppel =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'occupe'
  | 'introuvable'
  | 'pas_pour_moi'
  | 'charge_non_scellee'
  | 'etat_invalide';

/**
 * Les appels vivent en mémoire, pas en base.
 *
 * Un appel dure quelques minutes et n'a aucun sens une fois terminé : le
 * conserver reviendrait à tenir le journal de qui appelle qui et quand, ce que
 * cette application ne fait nulle part ailleurs. Un redémarrage du serveur
 * coupe les appels en cours, et c'est acceptable — ils se rappellent.
 */
interface AppelEnCours {
  appel: Appel;
  coupleId: string;
}

export interface ServiceAppels {
  /** L'appel en cours pour ce couple, s'il y en a un. */
  courant(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusAppel; appel?: Appel }>;
  proposer(
    coupleId: string,
    appelantId: PartenaireId,
    sorte: SorteAppel,
  ): Promise<{ ok: boolean; motif?: RefusAppel; appel?: Appel }>;
  accepter(
    coupleId: string,
    quiId: PartenaireId,
    appelId: string,
  ): Promise<{ ok: boolean; motif?: RefusAppel; appel?: Appel }>;
  terminer(
    coupleId: string,
    quiId: PartenaireId,
    appelId: string,
    raison: RaisonFin,
  ): Promise<{ ok: boolean; motif?: RefusAppel; appel?: Appel }>;
  /**
   * Vérifie qu'une charge de négociation peut être relayée.
   *
   * Le contenu n'est jamais inspecté — il est scellé. On contrôle seulement
   * qu'il en a la forme, et que l'émetteur participe bien à cet appel.
   */
  autoriserRelais(
    coupleId: string,
    emetteurId: PartenaireId,
    appelId: string,
    charge: string,
  ): Promise<{ ok: boolean; motif?: RefusAppel; destinataireId?: PartenaireId }>;
  /**
   * L'autre membre du couple.
   *
   * Indispensable pour router un signal : sans lui, il faudrait deviner le
   * destinataire, et une fin d'appel partirait à tous les sockets ouverts —
   * y compris ceux d'autres couples.
   */
  partenaireOppose(
    coupleId: string,
    moiId: PartenaireId,
  ): Promise<PartenaireId | undefined>;
  /** Termine les appels dont la sonnerie a assez duré. Rend l'appel et le couple. */
  balayerLesSonneries(
    maintenant?: string,
  ): { appel: Appel; coupleId: string }[];
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusAppel }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceAppels(depot: Depot): ServiceAppels {
  const parCouple = new Map<string, AppelEnCours>();

  /** L'appel vivant du couple, en écartant une sonnerie déjà périmée. */
  const vivant = (coupleId: string): AppelEnCours | undefined => {
    const en = parCouple.get(coupleId);
    if (!en) return undefined;
    if (!appelActif(en.appel) || sonnerieExpiree(en.appel)) {
      return undefined;
    }
    return en;
  };

  const clore = (
    en: AppelEnCours,
    raison: RaisonFin,
    quand = new Date().toISOString(),
  ): Appel => {
    const appel: Appel = {
      ...en.appel,
      etat: 'termine',
      termineLe: quand,
      raison,
    };
    parCouple.delete(en.coupleId);
    return appel;
  };

  return {
    async courant(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const en = vivant(coupleId);
      return { ok: true, ...(en ? { appel: en.appel } : {}) };
    },

    async proposer(coupleId, appelantId, sorte) {
      const acces = await autoriser(depot, coupleId, appelantId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // Un appel déjà vivant : on ne le remplace pas en silence.
      if (vivant(coupleId)) return { ok: false, motif: 'occupe' };

      const appel: Appel = {
        id: randomUUID(),
        sorte,
        appelantId,
        etat: 'sonne',
        proposeeLe: new Date().toISOString(),
      };
      parCouple.set(coupleId, { appel, coupleId });
      return { ok: true, appel };
    },

    /**
     * Décrochage.
     *
     * Seul celui qu'on appelle peut accepter. Laisser l'appelant « accepter »
     * son propre appel permettrait d'ouvrir un flux sans que l'autre ait rien
     * fait — c'est-à-dire un micro à distance.
     */
    async accepter(coupleId, quiId, appelId) {
      const acces = await autoriser(depot, coupleId, quiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const en = vivant(coupleId);
      if (!en || en.appel.id !== appelId) {
        return { ok: false, motif: 'introuvable' };
      }
      if (en.appel.appelantId === quiId) {
        return { ok: false, motif: 'pas_pour_moi' };
      }
      if (en.appel.etat !== 'sonne') {
        return { ok: false, motif: 'etat_invalide' };
      }

      const appel: Appel = {
        ...en.appel,
        etat: 'en_cours',
        decrocheLe: new Date().toISOString(),
      };
      parCouple.set(coupleId, { ...en, appel });
      return { ok: true, appel };
    },

    /** Les deux peuvent raccrocher, à tout moment. */
    async terminer(coupleId, quiId, appelId, raison) {
      const acces = await autoriser(depot, coupleId, quiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const en = parCouple.get(coupleId);
      if (!en || en.appel.id !== appelId) {
        return { ok: false, motif: 'introuvable' };
      }
      return { ok: true, appel: clore(en, raison) };
    },

    async autoriserRelais(coupleId, emetteurId, appelId, charge) {
      const acces = await autoriser(depot, coupleId, emetteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // La forme, et rien d'autre : le contenu est scellé, et c'est ce qui
      // empêche ce serveur de remplacer une empreinte par la sienne.
      if (!estScelleMessage(charge)) {
        return { ok: false, motif: 'charge_non_scellee' };
      }

      const en = vivant(coupleId);
      if (!en || en.appel.id !== appelId) {
        return { ok: false, motif: 'introuvable' };
      }

      const destinataire = acces.couple.couple.partenaires.find(
        (p) => p.id !== emetteurId,
      );
      if (!destinataire) return { ok: false, motif: 'introuvable' };

      return { ok: true, destinataireId: destinataire.id };
    },

    async partenaireOppose(coupleId, moiId) {
      const enregistrement = await depot.couples.parId(coupleId);
      if (!enregistrement || enregistrement.dissocieLe) return undefined;
      return enregistrement.couple.partenaires.find((p) => p.id !== moiId)?.id;
    },

    balayerLesSonneries(maintenant = new Date().toISOString()) {
      const finis: { appel: Appel; coupleId: string }[] = [];
      for (const en of [...parCouple.values()]) {
        if (sonnerieExpiree(en.appel, maintenant)) {
          finis.push({
            appel: clore(en, 'sans_reponse', maintenant),
            coupleId: en.coupleId,
          });
        }
      }
      return finis;
    },
  };
}
