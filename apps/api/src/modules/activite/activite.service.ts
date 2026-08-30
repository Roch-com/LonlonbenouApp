/**
 * Pôle ① — Signal d'activité, côté serveur.
 *
 * Comme partout, le serveur **rejoue** la règle partagée plutôt que de la
 * réécrire : c'est `activiteVisible` qui décide de ce que l'autre reçoit, et
 * elle ne rend rien tant que le consentement réciproque n'est pas actif des
 * deux côtés.
 *
 * La conséquence à retenir : **on ne voit l'activité de l'autre qu'en
 * montrant la sienne**. Il n'existe aucune combinaison de réglages permettant
 * d'observer sans être observé — ce serait le mode furtif que le garde-fou
 * n°3 interdit.
 *
 * On voit en revanche toujours sa propre ligne, partage actif ou non : savoir
 * ce que l'autre peut voir de soi est le minimum pour décider en connaissance
 * de cause.
 */

import {
  activiteVisible,
  estPartageActif,
  finDeSaisie,
  type ActiviteVisible,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusActivite =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie';

export interface VueActivite {
  /** Ce que l'autre voit de moi — donc soumis au même partage. */
  moi: { partage: boolean };
  /** Absent tant que le partage n'est pas actif des deux côtés. */
  autre?: ActiviteVisible;
}

export interface ServiceActivite {
  signaler(
    coupleId: string,
    moiId: PartenaireId,
    ecrit: boolean,
  ): Promise<{ ok: boolean; motif?: RefusActivite }>;
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusActivite; vue?: VueActivite }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusActivite }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceActivite(depot: Depot): ServiceActivite {
  return {
    async signaler(coupleId, moiId, ecrit) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const maintenant = new Date().toISOString();
      // On enregistre même partage inactif : la ligne ne sort de nulle part
      // tant que la réciprocité manque, et l'écrire tout de suite évite un
      // trou de plusieurs minutes le jour où le partage s'active.
      await depot.activite.signaler(coupleId, {
        partenaireId: moiId,
        vuLe: maintenant,
        saisitJusqua: ecrit ? finDeSaisie(maintenant) : undefined,
      });
      return { ok: true };
    },

    async lire(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const partage = acces.couple.partages['activite'];
      const actif = !!partage && estPartageActif(partage);

      const lignes = await depot.activite.parCouple(coupleId);
      const autre = lignes.find((a) => a.partenaireId !== lecteurId);

      return {
        ok: true,
        vue: {
          moi: { partage: actif },
          // `activiteVisible` rend `undefined` sans réciprocité : le champ est
          // alors absent, et non « hors ligne » — qui serait déjà une réponse.
          autre: activiteVisible(autre, actif),
        },
      };
    },
  };
}
