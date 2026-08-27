/**
 * Pôle ③ — Lecture du calendrier partagé.
 *
 * Le calendrier est symétrique par construction : ces fonctions ne prennent
 * aucun lecteur en paramètre, il n'existe donc pas de version de l'agenda
 * propre à l'un des deux. C'est le même principe que pour le score de couple.
 */

import { joursEntre, jourUtc } from '../temps/jours';
import type { Evenement } from '../types/calendrier';

/** Instant de début, que l'événement soit horodaté ou sur la journée. */
export function debutEnMs(evenement: Evenement): number {
  return evenement.journeeEntiere
    ? jourUtc(evenement.debut)
    : Date.parse(evenement.debut);
}

export function estPasse(evenement: Evenement, maintenant: string): boolean {
  // Une journée entière court jusqu'au bout du jour civil : la comparer à
  // l'instant courant la ferait basculer dans le passé dès minuit passé.
  if (evenement.journeeEntiere) {
    const dernierJour = (evenement.fin ?? evenement.debut).slice(0, 10);
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
    const jour = evenement.journeeEntiere
      ? evenement.debut.slice(0, 10)
      : new Date(evenement.debut).toISOString().slice(0, 10);
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
