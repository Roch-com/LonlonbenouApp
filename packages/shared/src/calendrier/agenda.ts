/**
 * Pôle ③ — Lecture du calendrier partagé.
 *
 * Le calendrier est symétrique par construction : ces fonctions ne prennent
 * aucun lecteur en paramètre, il n'existe donc pas de version de l'agenda
 * propre à l'un des deux. C'est le même principe que pour le score de couple.
 */

import { joursEntre, jourUtc } from '../temps/jours';
import type { Evenement } from '../types/calendrier';

/** `YYYY-MM-DD` — la seule forme de jour civil acceptée ici. */
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Clé de regroupement des événements dont la date est illisible.
 *
 * Un horodatage que personne ne sait relire ne doit pas faire disparaître
 * l'événement de l'écran : c'est là, et seulement là, qu'on peut le corriger
 * ou le supprimer. Le cacher rendrait la donnée fautive indélogeable.
 */
export const JOUR_ILLISIBLE = 'date-illisible';

/**
 * Instant de début. **Ne lève jamais** : rend `NaN` sur un horodatage
 * illisible, ce qui range l'événement du côté des à venir plutôt que de
 * l'escamoter.
 */
export function debutEnMs(evenement: Evenement): number {
  if (evenement.journeeEntiere) {
    const jour = evenement.debut.slice(0, 10);
    return FORMAT_JOUR.test(jour) ? jourUtc(jour) : Number.NaN;
  }
  return Date.parse(evenement.debut);
}

/**
 * Jour civil d'un événement, `YYYY-MM-DD`, ou {@link JOUR_ILLISIBLE}.
 *
 * `new Date(x).toISOString()` lève un `RangeError` sur un horodatage
 * illisible. Ce jet-là traversait tout l'écran de la vie pratique et fermait
 * l'application à chaque ouverture — indéfiniment, puisque la donnée fautive
 * était déjà enregistrée sur le serveur. La validation à la saisie évite d'en
 * créer de nouvelles ; elle ne répare pas celles déjà écrites.
 *
 * On retombe sur les dix premiers caractères avant d'abandonner : un
 * `2026-08-30T0009:00` garde ainsi son bon jour.
 */
export function jourDeLEvenement(evenement: Evenement): string {
  const brut = evenement.debut ?? '';

  if (!evenement.journeeEntiere) {
    const ms = Date.parse(brut);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  }

  const jour = brut.slice(0, 10);
  return FORMAT_JOUR.test(jour) ? jour : JOUR_ILLISIBLE;
}

export function estPasse(evenement: Evenement, maintenant: string): boolean {
  // Une journée entière court jusqu'au bout du jour civil : la comparer à
  // l'instant courant la ferait basculer dans le passé dès minuit passé.
  if (evenement.journeeEntiere) {
    const dernierJour = (evenement.fin ?? evenement.debut).slice(0, 10);
    // Illisible : on le laisse à venir. Le classer dans le passé le
    // reléguerait aux « derniers passés », où rien ne permet de l'effacer.
    if (!FORMAT_JOUR.test(dernierJour)) return false;
    return joursEntre(dernierJour, maintenant) > 0;
  }

  const reference = evenement.fin
    ? Date.parse(evenement.fin)
    : debutEnMs(evenement);
  return reference < Date.parse(maintenant);
}

export function trierParDebut(evenements: readonly Evenement[]): Evenement[] {
  return [...evenements].sort((a, b) => debutEnMs(a) - debutEnMs(b));
}

/** Événements à venir, du plus proche au plus lointain. */
export function evenementsAVenir(
  evenements: readonly Evenement[],
  maintenant: string = new Date().toISOString(),
  limite?: number,
): Evenement[] {
  const aVenir = trierParDebut(evenements.filter((e) => !estPasse(e, maintenant)));
  return limite === undefined ? aVenir : aVenir.slice(0, limite);
}

export function evenementsPasses(
  evenements: readonly Evenement[],
  maintenant: string = new Date().toISOString(),
): Evenement[] {
  return trierParDebut(evenements.filter((e) => estPasse(e, maintenant))).reverse();
}

export interface JourneeAgenda {
  /** `YYYY-MM-DD`. */
  jour: string;
  evenements: Evenement[];
}

/** Regroupe par jour civil, jours vides exclus, dans l'ordre chronologique. */
export function grouperParJour(evenements: readonly Evenement[]): JourneeAgenda[] {
  const parJour = new Map<string, Evenement[]>();

  for (const evenement of trierParDebut(evenements)) {
    const jour = jourDeLEvenement(evenement);
    const existants = parJour.get(jour);
    if (existants) existants.push(evenement);
    else parJour.set(jour, [evenement]);
  }

  return [...parJour.entries()]
    .map(([jour, liste]) => ({ jour, evenements: liste }))
    .sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Libellé relatif doux : « aujourd'hui », « demain », « dans 4 jours ». */
export function quand(jour: string, maintenant: string): string {
  // Total : `quand` reçoit aussi des échéances et des dates de sortie venues
  // du serveur. Une seule d'entre elles illisible fermait l'application.
  if (!FORMAT_JOUR.test(jour.slice(0, 10))) return 'date à préciser';

  const ecart = joursEntre(maintenant.slice(0, 10), jour);

  if (ecart === 0) return 'aujourd’hui';
  if (ecart === 1) return 'demain';
  if (ecart === -1) return 'hier';
  if (ecart > 1 && ecart < 7) return `dans ${ecart} jours`;
  if (ecart < -1 && ecart > -7) return `il y a ${-ecart} jours`;

  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}
