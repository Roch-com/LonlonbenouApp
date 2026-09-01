/**
 * Pôle ④ — Complicité & connexion, côté serveur (§8.14).
 *
 * Le serveur **rejoue `vueLangages`** plutôt que de réécrire le miroir, comme
 * partout ailleurs. Ici il ne se contente pas de l’appliquer : il vérifie
 * lui-même qu’un questionnaire est complet, au lieu de croire un indicateur
 * fourni par le client. C’est la raison pour laquelle les choix ne sont pas
 * scellés — la migration 014 détaille l’arbitrage.
 *
 * ## Le rappel de distance
 *
 * Il est calculé ici, à partir de dates de dernière activité, et **jamais** à
 * partir d’un contenu. Il est identique pour les deux : c’est une propriété du
 * couple, pas une observation de l’un sur l’autre.
 */

import {
  inviterReconnexion,
  questionnaireComplet,
  QUESTIONS_LANGAGES,
  rituelDuJour,
  rituelsSuggeres,
  vueLangages,
  type Choix,
  type InvitationReconnexion,
  type PartenaireId,
  type Rituel,
  type SignauxDistance,
  type VueLangages,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusConnexion =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'choix_invalides';

export interface VueConnexion {
  langages: VueLangages;
  /** Le rituel du jour, le même des deux côtés. */
  rituelDuJour: Rituel;
  /** Le catalogue, trié selon ce qui touche l’autre quand on le sait. */
  rituels: readonly Rituel[];
  /** Absente la plupart du temps, et c’est voulu. */
  invitation?: InvitationReconnexion;
}

export interface ServiceConnexion {
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
    jour: string,
  ): Promise<{ ok: boolean; motif?: RefusConnexion; vue?: VueConnexion }>;
  repondre(
    coupleId: string,
    auteurId: PartenaireId,
    choix: Choix,
    jour: string,
  ): Promise<{ ok: boolean; motif?: RefusConnexion; vue?: VueConnexion }>;
}

const IDS = new Set(QUESTIONS_LANGAGES.map((q) => q.id));
const JOUR_MS = 86_400_000;

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusConnexion }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

/**
 * N’accepte que des clés du questionnaire et des valeurs `a`/`b`.
 *
 * Un objet arbitraire stocké en JSONB ressortirait tel quel au dépouillement.
 * Le filtre est ici plutôt qu’en base : PostgreSQL ne peut pas connaître un
 * catalogue qui vit dans le code.
 */
function nettoyer(brut: unknown): Choix | undefined {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return undefined;

  const propre: Record<string, 'a' | 'b'> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (!IDS.has(cle)) continue;
    if (valeur !== 'a' && valeur !== 'b') return undefined;
    propre[cle] = valeur;
  }
  return propre;
}

/** Jours écoulés depuis une date, ou `undefined` si elle est absente. */
function joursDepuis(quand: string | undefined, jour: string): number | undefined {
  if (!quand) return undefined;
  const debut = Date.parse(quand);
  const maintenant = Date.parse(`${jour}T12:00:00.000Z`);
  if (Number.isNaN(debut) || Number.isNaN(maintenant)) return undefined;
  return Math.max(0, Math.floor((maintenant - debut) / JOUR_MS));
}

/** La plus récente de plusieurs dates, en ignorant celles qui sont illisibles. */
function laPlusRecente(dates: readonly (string | undefined)[]): string | undefined {
  let meilleure: string | undefined;
  let meilleurMs = -Infinity;
  for (const date of dates) {
    if (!date) continue;
    const ms = Date.parse(date);
    if (Number.isNaN(ms) || ms <= meilleurMs) continue;
    meilleure = date;
    meilleurMs = ms;
  }
  return meilleure;
}

export function creerServiceConnexion(depot: Depot): ServiceConnexion {
  /**
   * Signaux de distance, tirés des autres modules.
   *
   * Uniquement des dates de dernière activité. Aucun contenu n’est lu : celui
   * du chat est scellé, et le resterait même si ce calcul en avait l’usage.
   */
  async function signaux(
    coupleId: string,
    jour: string,
  ): Promise<SignauxDistance> {
    const [initiatives, messages, evenements] = await Promise.all([
      depot.viePratique.initiatives(coupleId),
      depot.chat.messages(coupleId),
      depot.viePratique.evenements(coupleId),
    ]);

    const derniereInitiative = laPlusRecente(
      initiatives.filter((i) => i.vecueLe).map((i) => i.vecueLe),
    );
    const dernierMessage = laPlusRecente(
      // Un message programmé n'est pas encore un échange : le compter ferait
      // taire le rappel pour une conversation qui, elle, est silencieuse.
      messages.filter((m) => !m.remettreLe).map((m) => m.envoyeLe),
    );
    const dernierMoment = laPlusRecente(evenements.map((e) => e.debut));

    const jours = {
      joursSansInitiative: joursDepuis(derniereInitiative, jour),
      joursSansMessage: joursDepuis(dernierMessage, jour),
      joursSansMomentPartage: joursDepuis(dernierMoment, jour),
    };

    // Un module jamais utilisé n'est pas un signe de distance : sans repère,
    // on ne compte rien plutôt que de compter l'infini.
    return Object.fromEntries(
      Object.entries(jours).filter(([, v]) => v !== undefined),
    );
  }

  async function vuePour(
    coupleId: string,
    lecteurId: PartenaireId,
    jour: string,
  ): Promise<VueConnexion> {
    const reponses = await depot.connexion.langages(coupleId);
    const langages = vueLangages(reponses, lecteurId);

    // L'ordre de l'autre n'est connu qu'une fois les deux questionnaires
    // faits — donc de façon symétrique, chacun voyant l'ordre de l'autre.
    const ordreDeLautre = langages.sien?.ordre;
    const invitation = inviterReconnexion(
      await signaux(coupleId, jour),
      jour,
      ordreDeLautre,
    );

    return {
      langages,
      rituelDuJour: rituelDuJour(jour),
      rituels: rituelsSuggeres(ordreDeLautre),
      ...(invitation ? { invitation } : {}),
    };
  }

  return {
    async lire(coupleId, lecteurId, jour) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };
      return { ok: true, vue: await vuePour(coupleId, lecteurId, jour) };
    },

    /**
     * Enregistre les choix, complets ou non.
     *
     * Un questionnaire de quinze questions se remplit en plusieurs fois ; le
     * refuser tant qu’il n’est pas fini ferait tout recommencer à chaque
     * interruption. C’est `vueLangages` qui décide de ne rien ouvrir avant que
     * les deux soient complets, et cette décision-là n’est pas dans le client.
     */
    async repondre(coupleId, auteurId, choix, jour) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const propre = nettoyer(choix);
      if (!propre) return { ok: false, motif: 'choix_invalides' };

      await depot.connexion.definirLangages(coupleId, {
        partenaireId: auteurId,
        choix: propre,
        majLe: new Date().toISOString(),
      });

      // On rend la vue à jour : finir son questionnaire peut ouvrir celui de
      // l'autre, et l'écran doit pouvoir l'afficher sans second aller-retour.
      return { ok: true, vue: await vuePour(coupleId, auteurId, jour) };
    },
  };
}

export { questionnaireComplet };
