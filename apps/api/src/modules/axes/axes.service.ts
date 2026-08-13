/**
 * Exigence 1 — rejeu serveur du filtrage `axeVisiblePar`.
 *
 * Le mobile filtrait déjà, mais un filtrage client ne protège de rien : il
 * suppose que le serveur a envoyé la contribution de l'autre, donc qu'elle a
 * transité. Ici, **elle ne quitte jamais la base** tant que le miroir n'est pas
 * complet.
 *
 * Trois contrôles s'enchaînent, dans cet ordre :
 *   1. le lecteur appartient au couple, et le couple n'est pas dissocié ;
 *   2. le module `croissance` est consenti par les deux ;
 *   3. `axeVisiblePar` — la même fonction que celle du mobile, pas une copie.
 */

import { randomUUID } from 'node:crypto';
import {
  axeVisiblePar,
  deposerContribution,
  estPartageActif,
  type AxeCroissance,
  type AxeVisible,
  type PartenaireId,
  type ThemeAxe,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusAcces =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'partage_inactif'
  | 'axe_introuvable';

export interface ResultatLecture {
  ok: boolean;
  motif?: RefusAcces;
  axes?: AxeVisible[];
}

export interface ServiceAxes {
  lister(coupleId: string, lecteurId: PartenaireId): Promise<ResultatLecture>;
  ouvrir(
    coupleId: string,
    auteurId: PartenaireId,
    theme: ThemeAxe,
    titre: string,
  ): Promise<{ ok: boolean; motif?: RefusAcces; axe?: AxeVisible }>;
  contribuer(
    coupleId: string,
    auteurId: PartenaireId,
    axeId: string,
    ressenti: string,
    besoin: string,
  ): Promise<{ ok: boolean; motif?: RefusAcces; axe?: AxeVisible }>;
  cloturer(
    coupleId: string,
    auteurId: PartenaireId,
    axeId: string,
    cloture: boolean,
  ): Promise<{ ok: boolean; motif?: RefusAcces; axe?: AxeVisible }>;
}

/** Contrôle d'accès commun à toutes les opérations sur les axes. */
async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusAcces }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };

  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }

  const partage = enregistrement.partages['croissance'];
  if (!partage || !estPartageActif(partage)) return { motif: 'partage_inactif' };

  return { couple: enregistrement };
}

export function creerServiceAxes(depot: Depot): ServiceAxes {
  return {
    async lister(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const axes = await depot.axes.parCouple(coupleId);
      // Le filtrage a lieu ici, avant sérialisation : la contribution de
      // l'autre ne franchit pas la frontière du serveur.
      return { ok: true, axes: axes.map((axe) => axeVisiblePar(axe, lecteurId)) };
    },

    async ouvrir(coupleId, auteurId, theme, titre) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const propre = titre.trim();
      if (!propre) return { ok: false, motif: 'axe_introuvable' };

      const axe: AxeCroissance = {
        id: randomUUID(),
        theme,
        titre: propre,
        ouvertPar: auteurId,
        ouvertLe: new Date().toISOString(),
        contributions: [],
      };
      await depot.axes.enregistrer(coupleId, axe);

      return { ok: true, axe: axeVisiblePar(axe, auteurId) };
    },

    async contribuer(coupleId, auteurId, axeId, ressenti, besoin) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const axe = await depot.axes.parId(coupleId, axeId);
      if (!axe) return { ok: false, motif: 'axe_introuvable' };

      // `deposerContribution` refuse un troisième contributeur et remplace la
      // contribution existante au lieu de l'empiler.
      const misAJour = deposerContribution(axe, auteurId, ressenti, besoin);
      await depot.axes.enregistrer(coupleId, misAJour);

      return { ok: true, axe: axeVisiblePar(misAJour, auteurId) };
    },

    async cloturer(coupleId, auteurId, axeId, cloture) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const axe = await depot.axes.parId(coupleId, axeId);
      if (!axe) return { ok: false, motif: 'axe_introuvable' };

      // Clôturer et rouvrir sont ouverts aux deux : un axe appartient au
      // couple, pas à celui qui l'a posé.
      const { clotureLe: _, ...sansCloture } = axe;
      const misAJour: AxeCroissance = cloture
        ? { ...axe, clotureLe: new Date().toISOString() }
        : sansCloture;

      await depot.axes.enregistrer(coupleId, misAJour);
      return { ok: true, axe: axeVisiblePar(misAJour, auteurId) };
    },
  };
}
