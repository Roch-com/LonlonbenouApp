/**
 * Pôle ① — Carte & Présence, côté serveur.
 *
 * Le serveur **rejoue la réciprocité stricte** : le statut de l'autre n'est
 * servi que si le module `position` est consenti **des deux côtés**. Tant que
 * l'un des deux ne l'a pas activé, l'autre ne reçoit rien — pas même « il n'a
 * rien partagé », qui laisserait deviner. C'est `estPartageActif` du partagé
 * qui tranche, la même fonction que côté mobile.
 *
 * Point important : **on voit toujours son propre statut**, même partage
 * inactif. Se cacher à soi-même ce qu'on a écrit n'aurait aucun sens, et rendre
 * l'écran vide ferait croire à une panne.
 *
 * Le SOS échappe à cette règle, délibérément : une alerte de détresse passe
 * quel que soit l'état des consentements. Un partage de position en pause ne
 * doit jamais empêcher d'appeler à l'aide.
 */

import { randomUUID } from 'node:crypto';
import { estPartageActif, type PartenaireId } from '@lonlonbenu/shared';
import type {
  AlerteServeur,
  CheckInServeur,
  CoupleServeur,
  Depot,
  StatutServeur,
} from '../../domaine/depot.ts';

export type RefusPresence =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'donnees_invalides'
  | 'introuvable';

export interface VuePresence {
  /** Mon statut : toujours visible, partage actif ou non. */
  mien?: StatutServeur;
  /** Celui de l'autre : seulement si les deux ont consenti. */
  autre?: StatutServeur;
  /** Faux quand la réciprocité n'est pas remplie. Dit sans détour pourquoi. */
  partageActif: boolean;
  /** Check-ins des deux, soumis au même partage. */
  checkIns: CheckInServeur[];
  /** Les alertes, elles, ne dépendent d'aucun consentement. */
  alertes: AlerteServeur[];
}

export interface ServicePresence {
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusPresence; vue?: VuePresence }>;
  definirStatut(
    coupleId: string,
    moiId: PartenaireId,
    code: string,
    noteScellee?: string,
  ): Promise<{ ok: boolean; motif?: RefusPresence }>;
  definirHumeur(
    coupleId: string,
    moiId: PartenaireId,
    code: string,
    motScelle?: string,
  ): Promise<{ ok: boolean; motif?: RefusPresence }>;
  faireUnCheckIn(
    coupleId: string,
    moiId: PartenaireId,
    lieuScelle: string,
    motScelle?: string,
  ): Promise<{ ok: boolean; motif?: RefusPresence }>;
  declencherSos(
    coupleId: string,
    moiId: PartenaireId,
    lieuScelle?: string,
    messageScelle?: string,
  ): Promise<{ ok: boolean; motif?: RefusPresence; alerte?: AlerteServeur }>;
  changerEtatAlerte(
    coupleId: string,
    moiId: PartenaireId,
    id: string,
    action: 'vue' | 'resolue',
  ): Promise<{ ok: boolean; motif?: RefusPresence; alerte?: AlerteServeur }>;
}

const CODES_HUMEUR = [
  'rayonnant',
  'serein',
  'fatigue',
  'tendu',
  'triste',
  'amoureux',
];

const CODES_STATUT = [
  'disponible',
  'occupe',
  'en_route',
  'au_calme',
  'je_pense_a_toi',
];

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusPresence }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServicePresence(depot: Depot): ServicePresence {
  return {
    async lire(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const partage = acces.couple.partages['position'];
      const actif = !!partage && estPartageActif(partage);

      const [statuts, checkIns, alertes] = await Promise.all([
        depot.presence.statuts(coupleId),
        depot.presence.checkIns(coupleId),
        depot.presence.alertes(coupleId),
      ]);

      const mien = statuts.find((s) => s.partenaireId === lecteurId);

      return {
        ok: true,
        vue: {
          mien,
          // Le filtrage a lieu ici, avant sérialisation : sans réciprocité, le
          // statut de l'autre ne franchit pas la frontière du serveur.
          autre: actif
            ? statuts.find((s) => s.partenaireId !== lecteurId)
            : undefined,
          partageActif: actif,
          checkIns: actif
            ? checkIns
            : checkIns.filter((c) => c.partenaireId === lecteurId),
          // Un SOS passe toujours : la détresse ne se négocie pas.
          alertes,
        },
      };
    },

    async definirStatut(coupleId, moiId, code, noteScellee) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      if (!CODES_STATUT.includes(code)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      await depot.presence.definirStatut(coupleId, {
        partenaireId: moiId,
        code,
        noteScellee,
        majLe: new Date().toISOString(),
      });
      return { ok: true };
    },

    async definirHumeur(coupleId, moiId, code, motScelle) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      if (!CODES_HUMEUR.includes(code)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      await depot.presence.definirHumeur(
        coupleId,
        moiId,
        code,
        motScelle,
        new Date().toISOString(),
      );
      return { ok: true };
    },

    async faireUnCheckIn(coupleId, moiId, lieuScelle, motScelle) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      if (!lieuScelle.trim()) return { ok: false, motif: 'donnees_invalides' };

      await depot.presence.ajouterCheckIn(coupleId, {
        id: randomUUID(),
        partenaireId: moiId,
        lieuScelle,
        motScelle,
        faitLe: new Date().toISOString(),
      });
      return { ok: true };
    },

    async declencherSos(coupleId, moiId, lieuScelle, messageScelle) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const alerte: AlerteServeur = {
        id: randomUUID(),
        partenaireId: moiId,
        lieuScelle,
        messageScelle,
        etat: 'actif',
        emiseLe: new Date().toISOString(),
      };
      await depot.presence.enregistrerAlerte(coupleId, alerte);
      return { ok: true, alerte };
    },

    async changerEtatAlerte(coupleId, moiId, id, action) {
      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const alerte = await depot.presence.alerteParId(coupleId, id);
      if (!alerte) return { ok: false, motif: 'introuvable' };

      const maintenant = new Date().toISOString();
      // Les deux peuvent résoudre : celui qui a alerté parce qu'il va mieux,
      // l'autre parce qu'il est arrivé.
      const misAJour: AlerteServeur =
        action === 'vue'
          ? { ...alerte, vueLe: alerte.vueLe ?? maintenant }
          : { ...alerte, etat: 'resolu', resolueLe: maintenant };

      await depot.presence.enregistrerAlerte(coupleId, misAJour);
      return { ok: true, alerte: misAJour };
    },
  };
}
