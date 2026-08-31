/**
 * Pôle ⑤ — Souvenirs et Love Map, côté serveur (§8.15, §8.16).
 *
 * ## Aucun consentement à donner
 *
 * L'album n'est pas un module sensible au sens du §0 : il n'y a rien à
 * observer d'une personne, seulement une mémoire construite à deux. Comme le
 * calendrier partagé, il est symétrique par construction — ce que l'un ajoute,
 * l'autre le voit, dans les mêmes conditions et sans interrupteur.
 *
 * ## Ce que le serveur détient
 *
 * Une enveloppe et une date. Il ne sait ni ce qui s'est passé, ni où. La date
 * reste en clair parce que « il y a un an » suppose de retrouver les souvenirs
 * d'un jour donné sans les ouvrir — voir la note du modèle partagé.
 *
 * ## Effacer
 *
 * Chacun peut retirer n'importe quel souvenir, y compris celui que l'autre a
 * posé. C'est une mémoire commune : demander l'autorisation de son partenaire
 * pour retirer une photo de leur album ferait de l'un le propriétaire de leur
 * histoire.
 */

import { randomUUID } from 'node:crypto';
import {
  estJourValide,
  estScelleMessage,
  trierSouvenirs,
  type PartenaireId,
  type SorteSouvenir,
  type SouvenirScelle,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusMemoire =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'donnees_invalides'
  | 'contenu_non_scelle'
  | 'introuvable';

export interface ServiceMemoire {
  lister(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusMemoire; souvenirs?: SouvenirScelle[] }>;
  ajouter(
    coupleId: string,
    auteurId: PartenaireId,
    sorte: SorteSouvenir,
    jour: string,
    contenuScelle: string,
  ): Promise<{ ok: boolean; motif?: RefusMemoire; souvenir?: SouvenirScelle }>;
  supprimer(
    coupleId: string,
    auteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusMemoire }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusMemoire }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

const SORTES: readonly SorteSouvenir[] = ['moment', 'lieu'];

export function creerServiceMemoire(depot: Depot): ServiceMemoire {
  return {
    async lister(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      return {
        ok: true,
        souvenirs: trierSouvenirs(await depot.souvenirs.parCouple(coupleId)),
      };
    },

    async ajouter(coupleId, auteurId, sorte, jour, contenuScelle) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!SORTES.includes(sorte) || !estJourValide(jour)) {
        return { ok: false, motif: 'donnees_invalides' };
      }

      // Le serveur ne peut pas vérifier qu'une enveloppe est bien chiffrée —
      // il n'a aucune clé — mais il peut refuser ce qui n'en a pas la forme.
      if (!estScelleMessage(contenuScelle)) {
        return { ok: false, motif: 'contenu_non_scelle' };
      }

      const souvenir: SouvenirScelle = {
        id: randomUUID(),
        sorte,
        jour,
        contenuScelle,
        creePar: auteurId,
        creeLe: new Date().toISOString(),
      };

      await depot.souvenirs.enregistrer(coupleId, souvenir);
      return { ok: true, souvenir };
    },

    async supprimer(coupleId, auteurId, id) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const existant = await depot.souvenirs.parId(coupleId, id);
      if (!existant) return { ok: false, motif: 'introuvable' };

      // Aucune vérification d'auteur : la mémoire est commune. Exiger d'être
      // celui qui a posé le souvenir ferait de l'un le propriétaire de leur
      // histoire, et de l'autre un invité.
      await depot.souvenirs.supprimer(coupleId, id);
      return { ok: true };
    },
  };
}
