/**
 * Pôle ① — Signal d'activité : « en ligne », « vu il y a… », « écrit… ».
 *
 * ## Pourquoi ce module passe par un consentement
 *
 * Savoir quand l'autre était connecté pour la dernière fois est exactement le
 * genre d'information qui se retourne en reproche — « tu étais en ligne à 23 h
 * et tu ne m'as pas répondu ». Le cahier des charges range ce type de signal
 * du côté des modules sensibles, et la règle qui s'y applique est stricte :
 * réciprocité, ou rien.
 *
 * D'où la propriété centrale de ce fichier, et la seule qui compte vraiment :
 * on ne voit l'activité de l'autre **que si l'on montre la sienne**. Il
 * n'existe aucune combinaison de réglages permettant d'observer sans être
 * observé — `estPartageActif` exige les deux consentements, et cette fonction
 * ne rend rien de l'autre quand il manque.
 *
 * ## Ce qui n'en sort jamais
 *
 * Pas d'historique : seulement le dernier instant connu. Une liste des
 * connexions de la journée dirait qui dort mal, qui travaille tard, qui ouvre
 * l'app trente fois — ce n'est plus de la présence, c'est de la surveillance.
 */

import type { PartenaireId } from '../types/couple';

/** Ce qu'un appareil déclare de lui-même, tel qu'il est rangé côté serveur. */
export interface ActiviteBrute {
  partenaireId: PartenaireId;
  /** Dernier signe de vie, ISO 8601. */
  vuLe: string;
  /**
   * Instant jusqu'auquel la saisie en cours est tenue pour valable.
   *
   * Une échéance plutôt qu'un booléen : un « il écrit » posé à vrai le reste
   * pour toujours si l'appareil se tait — coupure réseau, batterie vide, app
   * fermée d'un coup. Une échéance s'éteint toute seule.
   */
  saisitJusqua?: string;
}

/** Ce que l'autre voit de moi, une fois la réciprocité vérifiée. */
export interface ActiviteVisible {
  enLigne: boolean;
  /** Absent quand la personne est en ligne : « en ligne » se suffit. */
  vuLe?: string;
  /** Vrai seulement pendant la fenêtre déclarée, jamais après. */
  ecrit: boolean;
}

/**
 * En deçà, on est « en ligne ». L'app signale sa présence toutes les 20 s ;
 * une minute laisse donc passer deux battements manqués avant de basculer, ce
 * qui évite le clignotement sur une connexion hésitante.
 */
export const SEUIL_EN_LIGNE_MS = 60_000;

/**
 * Durée d'une déclaration de saisie. Assez longue pour couvrir une pause
 * entre deux mots, assez courte pour que « écrit… » s'efface vite quand la
 * personne a renoncé.
 */
export const FENETRE_SAISIE_MS = 8_000;

/**
 * Ce qu'un partenaire a le droit de voir de l'autre.
 *
 * @param partageActif Consentement réciproque du module, déjà résolu — donc
 * vrai seulement si **les deux** l'ont activé.
 */
export function activiteVisible(
  brute: ActiviteBrute | undefined,
  partageActif: boolean,
  maintenant: string = new Date().toISOString(),
): ActiviteVisible | undefined {
  // Sans réciprocité il n'y a rien à montrer — et surtout rien à déduire : on
  // ne rend pas « hors ligne », qui serait déjà une information.
  if (!partageActif || !brute) return undefined;

  const instant = Date.parse(maintenant);
  const vu = Date.parse(brute.vuLe);
  if (Number.isNaN(instant) || Number.isNaN(vu)) return undefined;

  const enLigne = instant - vu <= SEUIL_EN_LIGNE_MS;
  const finSaisie = brute.saisitJusqua ? Date.parse(brute.saisitJusqua) : NaN;

  return {
    enLigne,
    // Hors ligne seulement : afficher les deux inviterait à comparer l'heure
    // de la dernière visite à celle du dernier message envoyé.
    vuLe: enLigne ? undefined : brute.vuLe,
    ecrit: enLigne && !Number.isNaN(finSaisie) && instant < finSaisie,
  };
}

/** Fenêtre de saisie à déclarer, comptée depuis maintenant. */
export function finDeSaisie(maintenant: string = new Date().toISOString()): string {
  return new Date(Date.parse(maintenant) + FENETRE_SAISIE_MS).toISOString();
}
