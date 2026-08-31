/**
 * Pôle ③ — Finances partagées, côté serveur (§8.11).
 *
 * ## Ce que le serveur ne sait pas
 *
 * Ni combien le couple dépense, ni en quoi, ni qui paie. Le §8.11 exige un
 * chiffrement renforcé de ces données ; les enveloppes ne s'ouvrent donc que
 * sur les téléphones, et aucun total ne se calcule ici. Le serveur range et
 * achemine, comme pour le chat.
 *
 * ## Le module s'éteint
 *
 * Le cahier le veut « entièrement optionnelle et désactivable ». `actif` porte
 * cela, et éteindre n'efface rien : on retrouve son historique en rallumant.
 * Effacer sur simple bascule ferait d'un interrupteur une destruction, ce
 * qu'aucune interface ne prépare vraiment.
 *
 * ## Pourquoi aucun consentement réciproque
 *
 * Il n'y a rien à observer d'une personne : un budget commun appartient aux
 * deux, comme le calendrier ou l'album. Le brancher sur le mécanisme de
 * consentement laisserait croire qu'un partenaire peut se soustraire au regard
 * de l'autre sur des dépenses communes — ce qui n'aurait aucun sens.
 */

import { randomUUID } from 'node:crypto';
import {
  DEVISES,
  estScelleMessage,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type {
  CoupleServeur,
  DepenseScellee,
  Depot,
  ReglagesFinancesServeur,
} from '../../domaine/depot.ts';

export type RefusFinances =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'donnees_invalides'
  | 'contenu_non_scelle'
  | 'module_inactif'
  | 'introuvable';

export interface VueFinances {
  reglages: ReglagesFinancesServeur;
  /** Vide tant que le module n'est pas activé. */
  depenses: DepenseScellee[];
}

export interface ServiceFinances {
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusFinances; vue?: VueFinances }>;
  definirReglages(
    coupleId: string,
    auteurId: PartenaireId,
    reglages: { actif?: boolean; devise?: string; reglesScellees?: string | null },
  ): Promise<{ ok: boolean; motif?: RefusFinances; reglages?: ReglagesFinancesServeur }>;
  ajouterDepense(
    coupleId: string,
    auteurId: PartenaireId,
    jour: string,
    contenuScelle: string,
  ): Promise<{ ok: boolean; motif?: RefusFinances; depense?: DepenseScellee }>;
  supprimerDepense(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusFinances }>;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

const REGLAGES_INITIAUX: ReglagesFinancesServeur = {
  actif: false,
  devise: 'XOF',
  majLe: new Date(0).toISOString(),
};

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusFinances }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceFinances(depot: Depot): ServiceFinances {
  /** Écriture refusée tant que le module est éteint. */
  async function exigerActif(
    coupleId: string,
  ): Promise<ReglagesFinancesServeur | undefined> {
    const reglages = await depot.finances.reglages(coupleId);
    return reglages?.actif ? reglages : undefined;
  }

  return {
    async lire(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const reglages = (await depot.finances.reglages(coupleId)) ?? REGLAGES_INITIAUX;

      return {
        ok: true,
        vue: {
          reglages,
          // Éteint, le module ne rend rien — sans effacer pour autant.
          depenses: reglages.actif ? await depot.finances.depenses(coupleId) : [],
        },
      };
    },

    async definirReglages(coupleId, auteurId, modifications) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const actuels = (await depot.finances.reglages(coupleId)) ?? REGLAGES_INITIAUX;

      if (
        modifications.devise !== undefined &&
        !DEVISES.some((d) => d.code === modifications.devise)
      ) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      // Les parts se déduisent des revenus de chacun : au moins aussi sensible
      // que les dépenses, donc soumis à la même exigence de scellement.
      if (
        modifications.reglesScellees != null &&
        !estScelleMessage(modifications.reglesScellees)
      ) {
        return { ok: false, motif: 'contenu_non_scelle' };
      }

      const reglages: ReglagesFinancesServeur = {
        actif: modifications.actif ?? actuels.actif,
        devise: modifications.devise ?? actuels.devise,
        reglesScellees:
          modifications.reglesScellees === null
            ? undefined
            : (modifications.reglesScellees ?? actuels.reglesScellees),
        majLe: new Date().toISOString(),
      };

      await depot.finances.definirReglages(coupleId, reglages);
      return { ok: true, reglages };
    },

    async ajouterDepense(coupleId, auteurId, jour, contenuScelle) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      if (!(await exigerActif(coupleId))) {
        return { ok: false, motif: 'module_inactif' };
      }

      if (!FORMAT_JOUR.test(jour)) {
        return { ok: false, motif: 'donnees_invalides' };
      }
      if (!estScelleMessage(contenuScelle)) {
        return { ok: false, motif: 'contenu_non_scelle' };
      }

      const depense: DepenseScellee = {
        id: randomUUID(),
        jour,
        contenuScelle,
        creePar: auteurId,
        creeLe: new Date().toISOString(),
      };

      await depot.finances.enregistrerDepense(coupleId, depense);
      return { ok: true, depense };
    },

    async supprimerDepense(coupleId, auteurId, id) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const existante = await depot.finances.depenseParId(coupleId, id);
      if (!existante) return { ok: false, motif: 'introuvable' };

      // Aucune vérification d'auteur : une dépense commune se corrige à deux.
      // Exiger d'être celui qui l'a saisie obligerait à réclamer une
      // rectification à son partenaire, ce qui est exactement la conversation
      // pénible que ce module doit éviter.
      await depot.finances.supprimerDepense(coupleId, id);
      return { ok: true };
    },
  };
}
