/**
 * Moteur de réciprocité — garde-fou éthique n°1, 2 et 3 de CLAUDE.md.
 *
 * Toute fonctionnalité sensible (position, cycle, axes de croissance, score,
 * confidences) passe par ici. Trois invariants, testés dans `reciprocite.test.ts` :
 *
 *   1. Réciprocité stricte — l'accès accordé à l'un est exactement celui accordé
 *      à l'autre. Il n'existe aucun état où A voit B sans que B voie A.
 *   2. Opt-in symétrique — le partage n'est actif que si les deux ont consenti ;
 *      chacun peut se retirer seul, à tout moment.
 *   3. Aucun mode furtif — tout changement d'état produit une notification pour
 *      les DEUX partenaires, jamais pour un seul.
 *
 * Les libellés de notification sont volontairement neutres : on décrit un fait,
 * on ne reproche rien (garde-fou n°4).
 */

import type { PartenaireId } from '../types/couple';

/** Modules soumis au partage réciproque. */
export type ModuleSensible =
  | 'position'
  | 'cycle'
  | 'croissance'
  | 'score'
  | 'confidences'
  /**
   * « En ligne », « vu il y a… », « écrit… » dans la conversation.
   *
   * Ici plutôt qu'allumé par défaut : savoir quand l'autre s'est connecté
   * pour la dernière fois se retourne facilement en reproche. Le passer par
   * le consentement réciproque garantit qu'on ne le voit qu'en le montrant.
   */
  | 'activite';

export interface Consentement {
  partenaireId: PartenaireId;
  actif: boolean;
  /** ISO 8601. */
  majLe: string;
}

export interface PartageReciproque {
  module: ModuleSensible;
  consentements: readonly [Consentement, Consentement];
}

export type RaisonAcces =
  /** Les deux ont consenti : le partage est ouvert, des deux côtés. */
  | 'partage_actif'
  /** Le lecteur n'a pas (ou plus) activé le partage de son côté. */
  | 'en_pause_de_mon_cote'
  /** L'autre partenaire a mis le partage en pause. */
  | 'en_pause_cote_partenaire'
  /** Aucun des deux n'a activé le module. */
  | 'jamais_active';

export interface Acces {
  peutVoir: boolean;
  raison: RaisonAcces;
}

export interface Notification {
  destinataireId: PartenaireId;
  module: ModuleSensible;
  /** Micro-copy bienveillante, prête à l'affichage. */
  texte: string;
  emisLe: string;
}

export interface ResultatBascule {
  partage: PartageReciproque;
  /** Toujours une notification par partenaire — jamais une seule. */
  notifications: readonly [Notification, Notification];
}

function consentementDe(
  partage: PartageReciproque,
  partenaireId: PartenaireId,
): Consentement | undefined {
  return partage.consentements.find((c) => c.partenaireId === partenaireId);
}

/** Le partage n'existe que si les deux l'ont activé. */
export function estPartageActif(partage: PartageReciproque): boolean {
  return partage.consentements.every((c) => c.actif);
}

/**
 * Accès d'un partenaire au module.
 * `peutVoir` ne dépend PAS de qui demande : il vaut `estPartageActif` pour les deux.
 * Seule la `raison` est personnalisée, pour pouvoir expliquer la situation.
 */
export function accesDe(
  partage: PartageReciproque,
  lecteurId: PartenaireId,
): Acces {
  const moi = consentementDe(partage, lecteurId);
  if (!moi) {
    throw new Error(
      `Partenaire ${lecteurId} étranger au partage « ${partage.module} »`,
    );
  }
  const autre = partage.consentements.find((c) => c.partenaireId !== lecteurId)!;

  if (moi.actif && autre.actif) {
    return { peutVoir: true, raison: 'partage_actif' };
  }
  if (!moi.actif && !autre.actif) {
    return { peutVoir: false, raison: 'jamais_active' };
  }
  if (!moi.actif) {
    return { peutVoir: false, raison: 'en_pause_de_mon_cote' };
  }
  return { peutVoir: false, raison: 'en_pause_cote_partenaire' };
}

const LIBELLES_MODULE: Record<ModuleSensible, string> = {
  position: 'le partage de position',
  cycle: 'le partage du cycle',
  croissance: 'les axes de croissance',
  score: 'le score d’implication',
  confidences: 'l’espace de confidences',
  activite: 'la présence dans la conversation',
};

function texteNotification(
  module: ModuleSensible,
  prenomAuteur: string,
  actif: boolean,
  destinataireEstAuteur: boolean,
): string {
  const quoi = LIBELLES_MODULE[module];
  if (destinataireEstAuteur) {
    return actif
      ? `Vous avez activé ${quoi}. Votre partenaire en est informé.`
      : `Vous avez mis ${quoi} en pause. Votre partenaire en est informé.`;
  }
  return actif
    ? `${prenomAuteur} a activé ${quoi} de son côté.`
    : `${prenomAuteur} a mis ${quoi} en pause.`;
}

/**
 * Active ou met en pause le consentement d'un partenaire.
 * Retourne le nouvel état ET les deux notifications à émettre : c'est ce qui
 * rend le mode furtif structurellement impossible.
 */
export function basculerConsentement(
  partage: PartageReciproque,
  partenaireId: PartenaireId,
  actif: boolean,
  prenomAuteur: string,
  horodatage: string = new Date().toISOString(),
): ResultatBascule {
  if (!consentementDe(partage, partenaireId)) {
    throw new Error(
      `Partenaire ${partenaireId} étranger au partage « ${partage.module} »`,
    );
  }

  const consentements = partage.consentements.map((c) =>
    c.partenaireId === partenaireId ? { ...c, actif, majLe: horodatage } : c,
  ) as unknown as PartageReciproque['consentements'];

  const notifications = partage.consentements.map((c) => ({
    destinataireId: c.partenaireId,
    module: partage.module,
    texte: texteNotification(
      partage.module,
      prenomAuteur,
      actif,
      c.partenaireId === partenaireId,
    ),
    emisLe: horodatage,
  })) as unknown as ResultatBascule['notifications'];

  return { partage: { ...partage, consentements }, notifications };
}

/**
 * Assertion d'invariant, à appeler dans les tests de tout module sensible.
 * Lève si un état asymétrique a pu être construit.
 */
export function verifierReciprocite(partage: PartageReciproque): void {
  const [a, b] = partage.consentements;
  const accesA = accesDe(partage, a.partenaireId);
  const accesB = accesDe(partage, b.partenaireId);
  if (accesA.peutVoir !== accesB.peutVoir) {
    throw new Error(
      `Réciprocité rompue sur « ${partage.module} » : ` +
        `${a.partenaireId}=${accesA.peutVoir}, ${b.partenaireId}=${accesB.peutVoir}`,
    );
  }
}

export function creerPartage(
  module: ModuleSensible,
  a: PartenaireId,
  b: PartenaireId,
  actif = false,
  horodatage: string = new Date().toISOString(),
): PartageReciproque {
  return {
    module,
    consentements: [
      { partenaireId: a, actif, majLe: horodatage },
      { partenaireId: b, actif, majLe: horodatage },
    ],
  };
}
