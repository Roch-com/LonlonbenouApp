/**
 * Pôle ② — Espace de confidences, côté serveur.
 *
 * Troisième tranche verticale, sur le principe des deux précédentes : le
 * serveur **rejoue `confidencesVisiblesPar`** et ne rend que la forme déjà
 * filtrée.
 *
 * La particularité de ce pôle est ailleurs, dans ce qui **n'arrive jamais
 * jusqu'ici** : un brouillon. Une lettre s'écrit sur l'appareil de son auteur,
 * y reste tant qu'elle n'est pas envoyée, et ne traverse le réseau qu'au moment
 * de l'envoi. Trois barrières, du plus fort au plus faible :
 *
 *   1. le client ne transmet pas les brouillons — c'est déjà la règle mobile ;
 *   2. **il n'existe aucun endpoint capable d'en créer un** : `envoyer` pose
 *      lui-même `visibilite: 'couple'` et l'horodatage d'envoi, et le corps de
 *      la requête n'a pas voix au chapitre ;
 *   3. la colonne `visibilite` est contrainte à `couple` en base.
 *
 * L'envoi est **irréversible** : il n'existe ni suppression, ni modification
 * d'une confidence envoyée. Un texte offert appartient aussi à celui qui l'a
 * reçu ; le reprendre serait le lui retirer.
 */

import { randomUUID } from 'node:crypto';
import {
  confidencesVisiblesPar,
  envoyer,
  estScelleMessage,
  type Confidence,
  type PartenaireId,
  type TypeConfidence,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusConfidence =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'texte_vide'
  | 'texte_non_scelle'
  | 'type_inconnu'
  | 'introuvable'
  | 'pas_le_destinataire';

export interface ServiceConfidences {
  lister(
    coupleId: string,
    lecteurId: PartenaireId,
    type?: TypeConfidence,
  ): Promise<{ ok: boolean; motif?: RefusConfidence; confidences?: Confidence[] }>;
  /** Crée une confidence **déjà envoyée**. Il n'existe pas d'autre création. */
  envoyer(
    coupleId: string,
    auteurId: PartenaireId,
    type: TypeConfidence,
    texte: string,
    titre?: string,
  ): Promise<{ ok: boolean; motif?: RefusConfidence; confidence?: Confidence }>;
  marquerLue(
    coupleId: string,
    lecteurId: PartenaireId,
    id: string,
  ): Promise<{ ok: boolean; motif?: RefusConfidence; confidence?: Confidence }>;
}

const TYPES: readonly TypeConfidence[] = ['gratitude', 'lettre'];

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusConfidence }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceConfidences(depot: Depot): ServiceConfidences {
  return {
    async lister(coupleId, lecteurId, type) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const toutes = await depot.confidences.parCouple(coupleId);
      // Le filtrage a lieu ici, avant sérialisation. En pratique le dépôt ne
      // contient que des confidences envoyées, donc rien n'est retiré — mais la
      // règle est appliquée là où elle doit l'être, et non supposée acquise.
      return {
        ok: true,
        confidences: confidencesVisiblesPar(toutes, lecteurId, type),
      };
    },

    async envoyer(coupleId, auteurId, type, texte, titre) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      if (!TYPES.includes(type)) return { ok: false, motif: 'type_inconnu' };
      if (!texte.trim()) return { ok: false, motif: 'texte_vide' };

      // Le serveur ne peut pas vérifier qu'une enveloppe est correctement
      // chiffrée — il n'a aucune clé. Il peut en revanche refuser tout ce qui
      // n'en a pas la forme, et c'est ce qui garantit qu'aucun texte offert
      // n'entre plus en clair dans la base. Les confidences écrites avant ce
      // changement y restent, faute de pouvoir être rattrapées : ni le serveur
      // ni le client ne peuvent réécrire un texte déjà offert.
      if (!estScelleMessage(texte.trim())) {
        return { ok: false, motif: 'texte_non_scelle' };
      }
      if (titre?.trim() && !estScelleMessage(titre.trim())) {
        return { ok: false, motif: 'texte_non_scelle' };
      }

      const maintenant = new Date().toISOString();
      // `envoyer` du partagé pose la visibilité et l'horodatage : le client ne
      // décide ni de l'un ni de l'autre.
      const confidence = envoyer(
        {
          id: randomUUID(),
          auteurId,
          type,
          titre: titre?.trim() || undefined,
          texte: texte.trim(),
          creeLe: maintenant,
          visibilite: 'prive',
        },
        maintenant,
      );

      await depot.confidences.enregistrer(coupleId, confidence);
      return { ok: true, confidence };
    },

    async marquerLue(coupleId, lecteurId, id) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const confidence = await depot.confidences.parId(coupleId, id);
      if (!confidence) return { ok: false, motif: 'introuvable' };

      // On ne « lit » pas ce qu'on a écrit soi-même : l'accusé de lecture doit
      // rester le signe que l'autre a bien reçu.
      if (confidence.auteurId === lecteurId) {
        return { ok: false, motif: 'pas_le_destinataire' };
      }
      if (confidence.luLe) return { ok: true, confidence };

      const lue = { ...confidence, luLe: new Date().toISOString() };
      await depot.confidences.enregistrer(coupleId, lue);
      return { ok: true, confidence: lue };
    },
  };
}
