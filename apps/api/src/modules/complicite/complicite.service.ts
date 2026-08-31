/**
 * Pôle ② — questions de complicité, côté serveur (§8.6).
 *
 * Le serveur **rejoue `vueEchange`** plutôt que de réécrire la règle du
 * miroir. C'est ce qui garantit que la réponse de l'autre ne franchit pas la
 * frontière avant que les deux aient répondu : il n'y a rien à filtrer côté
 * client, et rien qu'un client puisse oublier de masquer.
 *
 * Même principe que le cycle et les axes — la règle vit dans le paquet
 * partagé, le serveur l'applique, l'écran affiche ce qu'il reçoit.
 */

import {
  estScelleMessage,
  vueEchange,
  type PartenaireId,
  type VueEchange,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusComplicite =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'donnees_invalides'
  | 'texte_non_scelle';

export interface ServiceComplicite {
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
    jour: string,
  ): Promise<{ ok: boolean; motif?: RefusComplicite; vue?: VueEchange }>;
  repondre(
    coupleId: string,
    auteurId: PartenaireId,
    jour: string,
    texteScelle: string,
  ): Promise<{ ok: boolean; motif?: RefusComplicite; vue?: VueEchange }>;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusComplicite }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceComplicite(depot: Depot): ServiceComplicite {
  /** Construit la vue filtrée pour un lecteur donné. */
  async function vuePour(
    coupleId: string,
    lecteurId: PartenaireId,
    jour: string,
  ): Promise<VueEchange> {
    const reponses = await depot.complicite.reponses(coupleId, jour);
    return vueEchange(
      reponses.length > 0
        ? {
            questionId: '',
            jour,
            reponses: reponses.map((r) => ({
              partenaireId: r.partenaireId,
              texteScelle: r.texteScelle,
              repondeLe: r.reponduLe,
            })),
          }
        : undefined,
      jour,
      lecteurId,
    );
  }

  return {
    async lire(coupleId, lecteurId, jour) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      if (!FORMAT_JOUR.test(jour)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      return { ok: true, vue: await vuePour(coupleId, lecteurId, jour) };
    },

    async repondre(coupleId, auteurId, jour, texteScelle) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!FORMAT_JOUR.test(jour)) {
        return { ok: false, motif: 'donnees_invalides' };
      }
      if (!estScelleMessage(texteScelle)) {
        return { ok: false, motif: 'texte_non_scelle' };
      }

      await depot.complicite.repondre(coupleId, {
        jour,
        partenaireId: auteurId,
        texteScelle,
        reponduLe: new Date().toISOString(),
      });

      // On rend la vue à jour : répondre peut ouvrir celle de l'autre, et
      // l'écran doit pouvoir l'afficher sans second aller-retour.
      return { ok: true, vue: await vuePour(coupleId, auteurId, jour) };
    },
  };
}
