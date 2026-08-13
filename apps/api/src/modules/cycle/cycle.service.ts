/**
 * Pôle ④ — Cycle & fertilité, côté serveur.
 *
 * Même principe que les axes : **le serveur rejoue `vuePartenaire`** et ne rend
 * que l'objet déjà mis en forme selon le niveau choisi. Les dates de règles,
 * les symptômes et le jour du cycle ne franchissent jamais la frontière quand
 * c'est le partenaire qui demande — il n'y a donc rien à filtrer côté client,
 * et rien qu'un client puisse oublier de masquer.
 *
 * Deuxième règle, propre à ce pôle et plus stricte que partout ailleurs :
 * **une seule personne écrit**. `estLaPorteuse` garde chaque écriture, le
 * niveau de partage inclus. Ce n'est pas un consentement réciproque et cela ne
 * passe surtout pas par `basculerConsentement` — un partage mutuel se négocie à
 * deux, celui-ci ne se négocie pas du tout.
 */

import { randomUUID } from 'node:crypto';
import {
  definirNiveauCycle,
  estLaPorteuse,
  etatDuCycle,
  niveauxDisponibles,
  vuePartenaire,
  type Intensite,
  type NiveauCycle,
  type PartageCycle,
  type PartenaireId,
  type Regles,
  type Symptome,
  type TypeSymptome,
  type VuePartenaire,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusCycle =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'cycle_non_declare'
  | 'pas_la_porteuse'
  | 'niveau_indisponible'
  | 'donnees_invalides'
  | 'introuvable';

/** Ce que la personne concernée voit : son cycle, entier. */
export interface VuePorteuse {
  role: 'porteuse';
  niveau: NiveauCycle;
  regles: Regles[];
  symptomes: Symptome[];
  etat?: ReturnType<typeof etatDuCycle>;
}

/** Ce que l'autre voit : uniquement la projection autorisée. */
export interface VueAutre {
  role: 'partenaire';
  vue: VuePartenaire;
}

export type VueCycle = VuePorteuse | VueAutre;

export interface ServiceCycle {
  declarer(
    coupleId: string,
    auteurId: PartenaireId,
    porteuseId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusCycle; partage?: PartageCycle }>;
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusCycle; vue?: VueCycle }>;
  definirNiveau(
    coupleId: string,
    auteurId: PartenaireId,
    niveau: NiveauCycle,
  ): Promise<{ ok: boolean; motif?: RefusCycle; partage?: PartageCycle }>;
  enregistrerRegles(
    coupleId: string,
    auteurId: PartenaireId,
    debutLe: string,
    finLe?: string,
  ): Promise<{ ok: boolean; motif?: RefusCycle }>;
  supprimerRegles(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusCycle }>;
  noterSymptome(
    coupleId: string,
    auteurId: PartenaireId,
    date: string,
    type: TypeSymptome,
    intensite: Intensite,
    note?: string,
  ): Promise<{ ok: boolean; motif?: RefusCycle }>;
  retirerSymptome(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusCycle }>;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusCycle }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

/** Toute écriture repasse par ici : membre du couple **et** personne concernée. */
async function autoriserEcriture(
  depot: Depot,
  coupleId: string,
  auteurId: PartenaireId,
): Promise<{ partage: PartageCycle } | { motif: RefusCycle }> {
  const acces = await autoriser(depot, coupleId, auteurId);
  if ('motif' in acces) return { motif: acces.motif };

  const partage = await depot.cycle.partage(coupleId);
  if (!partage) return { motif: 'cycle_non_declare' };
  if (!estLaPorteuse(partage, auteurId)) return { motif: 'pas_la_porteuse' };

  return { partage };
}

export function creerServiceCycle(depot: Depot): ServiceCycle {
  return {
    async declarer(coupleId, auteurId, porteuseId) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!acces.couple.couple.partenaires.some((p) => p.id === porteuseId)) {
        return { ok: false, motif: 'non_membre' };
      }

      const existant = await depot.cycle.partage(coupleId);
      // Une fois déclarée, seule la personne concernée peut changer ce réglage :
      // sinon l'autre pourrait se désigner à sa place et lire son cycle.
      if (existant && !estLaPorteuse(existant, auteurId)) {
        return { ok: false, motif: 'pas_la_porteuse' };
      }

      const partage: PartageCycle = {
        porteuseId,
        niveau: existant?.niveau ?? 'aucun',
        majLe: new Date().toISOString(),
      };
      await depot.cycle.definirPartage(coupleId, partage);
      return { ok: true, partage };
    },

    async lire(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const partage = await depot.cycle.partage(coupleId);
      if (!partage) {
        // Rien n'est déclaré : les deux voient la même absence.
        return {
          ok: true,
          vue: { role: 'partenaire', vue: { niveau: 'aucun', partage: false } },
        };
      }

      const regles = await depot.cycle.regles(coupleId);

      if (estLaPorteuse(partage, lecteurId)) {
        return {
          ok: true,
          vue: {
            role: 'porteuse',
            niveau: partage.niveau,
            regles,
            symptomes: await depot.cycle.symptomes(coupleId),
            etat: etatDuCycle(regles),
          },
        };
      }

      // Le partenaire ne reçoit que la projection : `vuePartenaire` décide de
      // la forme même de l'objet, dates et symptômes restent ici.
      return {
        ok: true,
        vue: {
          role: 'partenaire',
          vue: vuePartenaire(etatDuCycle(regles), partage.niveau),
        },
      };
    },

    async definirNiveau(coupleId, auteurId, niveau) {
      const acces = await autoriserEcriture(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!niveauxDisponibles().some((n) => n.code === niveau)) {
        return { ok: false, motif: 'niveau_indisponible' };
      }

      // `definirNiveauCycle` lève si l'auteur n'est pas la personne concernée :
      // la règle vit dans le modèle partagé, le serveur ne la réécrit pas.
      const partage = definirNiveauCycle(acces.partage, auteurId, niveau);
      await depot.cycle.definirPartage(coupleId, partage);
      return { ok: true, partage };
    },

    async enregistrerRegles(coupleId, auteurId, debutLe, finLe) {
      const acces = await autoriserEcriture(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!FORMAT_JOUR.test(debutLe)) return { ok: false, motif: 'donnees_invalides' };
      if (finLe !== undefined && (!FORMAT_JOUR.test(finLe) || finLe < debutLe)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      await depot.cycle.ajouterRegles(coupleId, {
        id: randomUUID(),
        debutLe,
        finLe,
        saisiLe: new Date().toISOString(),
      });
      return { ok: true };
    },

    async supprimerRegles(coupleId, auteurId, id) {
      const acces = await autoriserEcriture(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      await depot.cycle.supprimerRegles(coupleId, id);
      return { ok: true };
    },

    async noterSymptome(coupleId, auteurId, date, type, intensite, note) {
      const acces = await autoriserEcriture(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!FORMAT_JOUR.test(date) || ![1, 2, 3].includes(intensite)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      await depot.cycle.noterSymptome(coupleId, {
        id: randomUUID(),
        date,
        type,
        intensite,
        note: note?.trim() || undefined,
      });
      return { ok: true };
    },

    async retirerSymptome(coupleId, auteurId, id) {
      const acces = await autoriserEcriture(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      await depot.cycle.retirerSymptome(coupleId, id);
      return { ok: true };
    },
  };
}
