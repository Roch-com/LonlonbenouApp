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
  peutOuvrirUnAxe,
  type AxeCroissance,
  type AxeVisible,
  type NiveauImportance,
  type PartenaireId,
  type ThemeAxe,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusAcces =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'partage_inactif'
  | 'axe_introuvable'
  /** La limite d'axes ouverts simultanément est atteinte (§8.5). */
  | 'trop_daxes_ouverts'
  /** On ne reconnaît pas son propre progrès. */
  | 'progres_a_soi_meme';

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
    importance?: NiveauImportance,
  ): Promise<{ ok: boolean; motif?: RefusAcces; axe?: AxeVisible }>;
  reconnaitreProgres(
    coupleId: string,
    auteurId: PartenaireId,
    axeId: string,
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

    async ouvrir(coupleId, auteurId, theme, titre, importance) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const propre = titre.trim();
      if (!propre) return { ok: false, motif: 'axe_introuvable' };

      // §8.5 : « limite du nombre de cartes actives simultanément pour éviter
      // l'effet liste de griefs ». La règle est vérifiée ici et pas seulement
      // à l'écran : c'est un garde-fou, pas un confort d'affichage.
      if (!peutOuvrirUnAxe(await depot.axes.parCouple(coupleId))) {
        return { ok: false, motif: 'trop_daxes_ouverts' };
      }

      const axe: AxeCroissance = {
        id: randomUUID(),
        theme,
        titre: propre,
        ouvertPar: auteurId,
        ouvertLe: new Date().toISOString(),
        contributions: [],
        ...(importance ? { importance } : {}),
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

    /**
     * Reconnaître un progrès (§8.5).
     *
     * « L'autre ne peut que reconnaître un progrès » : on reconnaît donc celui
     * de l'autre, jamais le sien. Se décerner soi-même un progrès viderait le
     * geste de tout son sens — sa valeur tient entièrement à ce qu'il vient
     * d'en face.
     *
     * Le geste ne se reprend pas : il n'y a pas de « retirer ma
     * reconnaissance ». Un progrès reconnu puis retiré blesserait plus que
     * l'absence de reconnaissance.
     */
    async reconnaitreProgres(coupleId, auteurId, axeId) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const axe = await depot.axes.parId(coupleId, axeId);
      if (!axe) return { ok: false, motif: 'axe_introuvable' };
      if (axe.ouvertPar === auteurId) {
        return { ok: false, motif: 'progres_a_soi_meme' };
      }

      const deja = (axe.reconnaissances ?? []).some(
        (r) => r.partenaireId === auteurId,
      );
      if (deja) return { ok: true, axe: axeVisiblePar(axe, auteurId) };

      const misAJour: AxeCroissance = {
        ...axe,
        reconnaissances: [
          ...(axe.reconnaissances ?? []),
          { partenaireId: auteurId, le: new Date().toISOString() },
        ],
      };
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
