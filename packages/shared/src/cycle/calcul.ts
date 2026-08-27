/**
 * Pôle ④ — Calcul des phases du cycle (P0).
 *
 * Tout part de ce que la personne a saisi elle-même : des dates de règles. Rien
 * n'est déduit d'un capteur, d'un agenda ou d'une humeur — la synchronisation
 * santé est P1, et le module ne lit jamais les données des autres pôles.
 *
 * **Ce que ce calcul est** : une moyenne des cycles observés, projetée sur les
 * jours à venir, avec une phase lutéale supposée constante à 14 jours.
 * **Ce qu'il n'est pas** : une mesure. Il ne détecte pas l'ovulation, il
 * l'estime. Le champ `fiable` existe pour que l'interface puisse le dire au
 * lieu d'afficher une certitude qu'on n'a pas.
 */

import { ajouterJours, joursEntre } from '../temps/jours';
import type { CodePhase, Regles } from '../types/cycle';

export const DUREE_CYCLE_DEFAUT = 28;
export const DUREE_REGLES_DEFAUT = 5;

/** Bornes physiologiques usuelles, pour qu'une saisie aberrante ne fausse pas tout. */
export const DUREE_CYCLE_MIN = 21;
export const DUREE_CYCLE_MAX = 40;
const DUREE_REGLES_MIN = 2;
const DUREE_REGLES_MAX = 10;

/** Durée supposée de la phase lutéale, la plus stable d'un cycle à l'autre. */
const PHASE_LUTEALE_JOURS = 14;

/** En dessous, on annonce une estimation, pas une prévision. */
const CYCLES_POUR_FIABILITE = 2;

export interface Estimations {
  dureeCycle: number;
  dureeRegles: number;
  /** Nombre d'intervalles complets entre deux règles observées. */
  cyclesObserves: number;
  /** Faux tant qu'il n'y a pas assez d'historique pour parler de prévision. */
  fiable: boolean;
}

function borner(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}

function moyenne(valeurs: readonly number[]): number | undefined {
  if (valeurs.length === 0) return undefined;
  return valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length;
}

/** Les règles, de la plus récente à la plus ancienne. */
export function reglesTriees(regles: readonly Regles[]): Regles[] {
  return [...regles].sort((a, b) => b.debutLe.localeCompare(a.debutLe));
}

export function estimer(regles: readonly Regles[]): Estimations {
  const triees = reglesTriees(regles);

  // Intervalles entre deux débuts successifs, sur les six derniers cycles :
  // au-delà, un cycle d'il y a deux ans ne dit plus grand-chose d'aujourd'hui.
  const intervalles: number[] = [];
  for (let i = 0; i + 1 < triees.length && intervalles.length < 6; i++) {
    const ecart = joursEntre(triees[i + 1]!.debutLe, triees[i]!.debutLe);
    if (ecart >= DUREE_CYCLE_MIN && ecart <= DUREE_CYCLE_MAX) {
      intervalles.push(ecart);
    }
  }

  const durees = triees
    .filter((r) => r.finLe)
    .map((r) => joursEntre(r.debutLe, r.finLe!) + 1)
    .filter((d) => d >= DUREE_REGLES_MIN && d <= DUREE_REGLES_MAX);

  const dureeCycle = Math.round(moyenne(intervalles) ?? DUREE_CYCLE_DEFAUT);
  const dureeRegles = Math.round(moyenne(durees) ?? DUREE_REGLES_DEFAUT);

  return {
    dureeCycle: borner(dureeCycle, DUREE_CYCLE_MIN, DUREE_CYCLE_MAX),
    dureeRegles: borner(dureeRegles, DUREE_REGLES_MIN, DUREE_REGLES_MAX),
    cyclesObserves: intervalles.length,
    fiable: intervalles.length >= CYCLES_POUR_FIABILITE,
  };
}

/** Jour d'ovulation estimé, compté depuis le premier jour des règles. */
export function jourOvulation(estimations: Estimations): number {
  return Math.max(1, estimations.dureeCycle - PHASE_LUTEALE_JOURS);
}

/**
 * Phase d'un jour donné du cycle (1 = premier jour des règles).
 *
 * L'ordre des tests est une précédence, pas un découpage en intervalles : sur
 * un cycle court, des plages calculées séparément se chevaucheraient ou
 * laisseraient des trous. Ici, tout jour reçoit exactement une phase.
 */
export function phasePourJour(jour: number, estimations: Estimations): CodePhase {
  const { dureeCycle, dureeRegles } = estimations;
  const ovulation = jourOvulation(estimations);

  if (jour <= dureeRegles) return 'menstruelle';
  if (jour > dureeCycle - 4) return 'spm';
  if (Math.abs(jour - ovulation) <= 1) return 'ovulatoire';
  if (jour < ovulation) return 'folliculaire';
  return 'luteale';
}

export interface EtatCycle {
  /** 1 = premier jour des dernières règles saisies. */
  jourDuCycle: number;
  phase: CodePhase;
  estimations: Estimations;
  debutDernieresRegles: string;
  /** Prévision, `YYYY-MM-DD`. */
  prochainesReglesLe: string;
  joursAvantProchaines: number;
  /**
   * Vrai quand le cycle en cours dépasse nettement la durée estimée. On le
   * signale sans rien en conclure : un retard a mille causes.
   */
  cycleInhabituellementLong: boolean;
}

/**
 * État courant. `undefined` tant qu'aucune date de règles n'a été saisie :
 * sans donnée, on n'invente rien.
 */
export function etatDuCycle(
  regles: readonly Regles[],
  maintenant: string = new Date().toISOString(),
): EtatCycle | undefined {
  const dernieres = reglesTriees(regles)[0];
  if (!dernieres) return undefined;

  const estimations = estimer(regles);
  const ecoules = joursEntre(dernieres.debutLe, maintenant);
  if (ecoules < 0) return undefined;

  const jourDuCycle = ecoules + 1;
  const prochainesReglesLe = ajouterJours(
    dernieres.debutLe,
    estimations.dureeCycle,
  );
  const joursAvantProchaines = joursEntre(
    maintenant.slice(0, 10),
    prochainesReglesLe,
  );

  return {
    jourDuCycle,
    // Au-delà de la durée estimée, on reste sur la dernière phase connue
    // plutôt que de faire repartir un cycle qui n'a pas commencé.
    phase: phasePourJour(
      Math.min(jourDuCycle, estimations.dureeCycle),
      estimations,
    ),
    estimations,
    debutDernieresRegles: dernieres.debutLe,
    prochainesReglesLe,
    joursAvantProchaines,
    cycleInhabituellementLong: jourDuCycle > estimations.dureeCycle + 7,
  };
}

/** Les jours du cycle regroupés par phase, pour dessiner une frise. */
export function frisePhases(
  estimations: Estimations,
): { phase: CodePhase; debut: number; fin: number }[] {
  const frise: { phase: CodePhase; debut: number; fin: number }[] = [];

  for (let jour = 1; jour <= estimations.dureeCycle; jour++) {
    const phase = phasePourJour(jour, estimations);
    const dernier = frise[frise.length - 1];
    if (dernier && dernier.phase === phase) dernier.fin = jour;
    else frise.push({ phase, debut: jour, fin: jour });
  }

  return frise;
}
