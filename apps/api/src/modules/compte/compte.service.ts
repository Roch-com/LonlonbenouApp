/**
 * Pôle ⑥ — portabilité et droit à l'effacement (RGPD, §9.5 du cahier).
 *
 * ## Ce que l'export contient, et pourquoi pas plus
 *
 * Il rend **ce que la personne a le droit de lire**, en rejouant les mêmes
 * règles que les écrans. Un export qui contournerait la réciprocité serait une
 * porte dérobée : il suffirait de l'exporter pour lire le cycle de l'autre.
 * Le cycle n'y figure donc que pour la personne concernée, et les statuts de
 * présence que si le partage est actif des deux côtés.
 *
 * Le chat sort **scellé**. Le serveur ne détient aucune clé privée : il ne
 * peut pas produire un export lisible, et prétendre le contraire serait mentir
 * sur la nature du chiffrement de bout en bout. C'est l'application qui ouvre
 * les enveloppes, avec ses clés, au moment de l'export.
 *
 * ## Ce que la suppression fait vraiment
 *
 * Elle dissocie d'abord si le couple est encore lié : cela détruit les données
 * communes et **prévient les deux**. Supprimer son compte en laissant l'autre
 * découvrir un espace vide sans explication serait la pire des ruptures.
 *
 * Puis elle efface les traces personnelles — appareils, préférences — et enfin
 * la ligne de compte elle-même. Un compte « désactivé » qui garde le courriel
 * et le vérificateur de mot de passe n'est pas un effacement.
 */

import { estPartageActif, type PartenaireId } from '@lonlonbenu/shared';
import type { Depot } from '../../domaine/depot.ts';
import type { DepotOAuth } from '../../securite/oauth/depotOAuth.ts';
import type { ServiceDissociation } from '../dissociation/dissociation.service.ts';

export type RefusCompte = 'compte_introuvable';

export interface ExportDonnees {
  genere_le: string;
  compte: { id: string; courriel: string };
  couple?: {
    id: string;
    depuis?: string;
    dissocie_le?: string;
    partenaires: readonly { id: string; prenom: string }[];
    consentements: readonly { module: string; actif: boolean }[];
  };
  /**
   * Enveloppes scellées. Illisibles ici par construction : voir l'en-tête.
   */
  chat_scelle: readonly { id: string; auteurId: string; enveloppe: string; envoyeLe: string }[];
  confidences: readonly unknown[];
  axes: readonly unknown[];
  vie_pratique: { evenements: readonly unknown[]; projets: readonly unknown[]; initiatives: readonly unknown[] };
  /** Présent seulement si le partage de position est actif des deux côtés. */
  presence?: readonly unknown[];
  /** Présent seulement pour la personne qui suit son cycle. */
  cycle?: { regles: readonly unknown[]; symptomes: readonly unknown[] };
  notifications: readonly unknown[];
}

/**
 * Un seul identifiant, volontairement.
 *
 * `POST /comptes` rend `partenaireId: compte.id` : le compte **est** le
 * partenaire. Faire circuler deux paramètres pour la même valeur inviterait
 * à les désynchroniser, et une route qui exporterait le compte de l'un avec
 * l'identité de l'autre serait exactement la fuite qu'on veut éviter.
 */
export interface ServiceCompte {
  exporter(
    partenaireId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusCompte; donnees?: ExportDonnees }>;
  supprimer(
    partenaireId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusCompte }>;
}

export function creerServiceCompte(
  depot: Depot,
  depotOAuth: DepotOAuth,
  dissociation: ServiceDissociation,
): ServiceCompte {
  return {
    async exporter(partenaireId) {
      // La ligne de compte est un confort, pas une condition : la requête est
      // déjà authentifiée, et exiger sa présence n'ajouterait qu'un mode
      // d'échec là où l'identité est établie.
      const compte = await depotOAuth.comptes.parId(partenaireId);
      const enregistrement = await depot.couples.parPartenaire(partenaireId);

      const donnees: ExportDonnees = {
        genere_le: new Date().toISOString(),
        compte: { id: partenaireId, courriel: compte?.courriel ?? '' },
        chat_scelle: [],
        confidences: [],
        axes: [],
        vie_pratique: { evenements: [], projets: [], initiatives: [] },
        notifications: await depot.notifications.journal(partenaireId),
      };

      if (!enregistrement) return { ok: true, donnees };

      const coupleId = enregistrement.id;
      donnees.couple = {
        id: coupleId,
        depuis: enregistrement.couple.depuis,
        dissocie_le: enregistrement.dissocieLe,
        partenaires: enregistrement.couple.partenaires.map((p) => ({
          id: p.id,
          prenom: p.prenom,
        })),
        consentements: Object.entries(enregistrement.partages).map(
          ([module, partage]) => ({ module, actif: estPartageActif(partage) }),
        ),
      };

      // Un couple dissocié ne rend plus rien : c'est la même coupure que
      // partout ailleurs, et l'export ne doit pas la contourner.
      if (enregistrement.dissocieLe) return { ok: true, donnees };

      donnees.chat_scelle = await depot.chat.messages(coupleId);
      donnees.confidences = await depot.confidences.parCouple(coupleId);
      donnees.axes = await depot.axes.parCouple(coupleId);
      donnees.vie_pratique = {
        evenements: await depot.viePratique.evenements(coupleId),
        projets: await depot.viePratique.projets(coupleId),
        initiatives: await depot.viePratique.initiatives(coupleId),
      };

      const partagePosition = enregistrement.partages['position'];
      if (partagePosition && estPartageActif(partagePosition)) {
        donnees.presence = await depot.presence.statuts(coupleId);
      }

      // Le cycle n'appartient qu'à la personne concernée : l'exporter à
      // l'autre ferait de cette route une porte dérobée sur le pôle ④.
      const partageCycle = await depot.cycle.partage(coupleId);
      if (partageCycle?.porteuseId === partenaireId) {
        donnees.cycle = {
          regles: await depot.cycle.regles(coupleId),
          symptomes: await depot.cycle.symptomes(coupleId),
        };
      }

      return { ok: true, donnees };
    },

    async supprimer(partenaireId) {
      const enregistrement = await depot.couples.parPartenaire(partenaireId);
      // Dissocier d'abord : les deux sont prévenus et les données communes
      // détruites. Sans cela, l'autre trouverait un espace vide sans un mot.
      if (enregistrement && !enregistrement.dissocieLe) {
        await dissociation.dissocier(enregistrement.id, partenaireId);
      }

      await depot.appareils.effacerPourPartenaire(partenaireId);
      await depotOAuth.comptes.supprimer(partenaireId);

      return { ok: true };
    },
  };
}
