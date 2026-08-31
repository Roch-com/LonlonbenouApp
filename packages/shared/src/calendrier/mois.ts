/**
 * Pôle ③ — vue mensuelle du calendrier partagé (§8.9 du cahier).
 *
 * ## Ce que le module demandait, et ce qui manquait
 *
 * « Vue calendrier commune **agrégeant** cycle, projets, initiatives
 * planifiées, rendez-vous, anniversaires. » L'app ne montrait qu'une liste
 * d'événements : les échéances de jalons, les sorties prévues et les phases du
 * cycle vivaient chacune dans leur écran, et rien ne permettait de voir qu'un
 * week-end portait déjà trois engagements.
 *
 * ## Une grille, pas une liste
 *
 * `grilleDuMois` rend toujours des semaines complètes, débordant sur les mois
 * voisins. Une grille qui commencerait au 1er laisserait un trou en haut à
 * gauche et casserait l'alignement des colonnes de jours — le repère visuel
 * qui rend un calendrier lisible d'un coup d'œil.
 *
 * ## Le cycle n'entre ici qu'une fois projeté
 *
 * Cette fonction ne reçoit jamais de dates de règles ni de symptômes : elle
 * prend des marques déjà décidées ailleurs. C'est ce qui garantit qu'aucune
 * vue calendrier ne puisse devenir un contournement du pôle ④.
 */

import { ajouterJours, joursEntre, jourUtc } from '../temps/jours';
import type { Evenement } from '../types/calendrier';
import type { Initiative } from '../types/initiatives';
import type { Projet } from '../types/projets';
import { jourDeLEvenement, JOUR_ILLISIBLE } from './agenda';

export type SorteMarque =
  | 'evenement'
  | 'jalon'
  | 'initiative'
  | 'cycle'
  | 'anniversaire';

export interface MarqueJour {
  sorte: SorteMarque;
  /** `YYYY-MM-DD`. */
  jour: string;
  titre: string;
  /** Identifiant de la source, pour ouvrir le bon écran au toucher. */
  reference?: string;
}

export interface CaseJour {
  /** `YYYY-MM-DD`. */
  jour: string;
  /** Faux pour les jours des mois voisins qui complètent la grille. */
  duMois: boolean;
  marques: MarqueJour[];
}

export interface SemaineCalendrier {
  /** Toujours sept cases, du lundi au dimanche. */
  jours: CaseJour[];
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Lundi = 0. `getUTCDay` rend dimanche = 0, ce qui décalerait toute la grille. */
function indiceLundi(jour: string): number {
  return (new Date(jourUtc(jour)).getUTCDay() + 6) % 7;
}

function premierDuMois(annee: number, mois: number): string {
  return `${annee}-${String(mois).padStart(2, '0')}-01`;
}

/** Nombre de jours du mois, sans table ni cas particulier pour février. */
export function joursDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/**
 * Marques du couple pour la période demandée.
 *
 * @param phasesCycle Jours déjà projetés par le pôle ④, s'il y a lieu. Cette
 * fonction ne calcule aucune phase : elle ne reçoit que ce que quelqu'un a
 * décidé de partager.
 */
export function marquesDuCouple(sources: {
  evenements?: readonly Evenement[];
  projets?: readonly Projet[];
  initiatives?: readonly Initiative[];
  phasesCycle?: readonly { jour: string; libelle: string }[];
  depuis?: string;
  annee?: number;
}): MarqueJour[] {
  const marques: MarqueJour[] = [];

  for (const evenement of sources.evenements ?? []) {
    const jour = jourDeLEvenement(evenement);
    if (jour === JOUR_ILLISIBLE) continue;
    marques.push({
      sorte: 'evenement',
      jour,
      titre: evenement.titre,
      reference: evenement.id,
    });
  }

  for (const projet of sources.projets ?? []) {
    for (const jalon of projet.jalons) {
      // Un jalon déjà fait n'est plus une échéance : le laisser encombrerait
      // la grille de ce qui n'attend plus rien.
      if (!jalon.echeance || jalon.faitLe) continue;
      if (!FORMAT_JOUR.test(jalon.echeance)) continue;
      marques.push({
        sorte: 'jalon',
        jour: jalon.echeance,
        titre: `${projet.titre} · ${jalon.titre}`,
        reference: projet.id,
      });
    }
  }

  for (const initiative of sources.initiatives ?? []) {
    if (!initiative.prevuePour || !FORMAT_JOUR.test(initiative.prevuePour)) continue;
    if (initiative.etat === 'vecue') continue;
    marques.push({
      sorte: 'initiative',
      jour: initiative.prevuePour,
      titre: initiative.titre,
      reference: initiative.id,
    });
  }

  for (const phase of sources.phasesCycle ?? []) {
    if (!FORMAT_JOUR.test(phase.jour)) continue;
    marques.push({ sorte: 'cycle', jour: phase.jour, titre: phase.libelle });
  }

  // L'anniversaire du couple, reporté sur l'année demandée.
  if (sources.depuis && FORMAT_JOUR.test(sources.depuis) && sources.annee) {
    const jour = `${sources.annee}${sources.depuis.slice(4)}`;
    if (FORMAT_JOUR.test(jour)) {
      const ans = sources.annee - Number(sources.depuis.slice(0, 4));
      if (ans > 0) {
        marques.push({
          sorte: 'anniversaire',
          jour,
          titre: `${ans} an${ans > 1 ? 's' : ''} tous les deux`,
        });
      }
    }
  }

  return marques;
}

/** Grille du mois, en semaines complètes du lundi au dimanche. */
export function grilleDuMois(
  annee: number,
  mois: number,
  marques: readonly MarqueJour[] = [],
): SemaineCalendrier[] {
  const premier = premierDuMois(annee, mois);
  const debut = ajouterJours(premier, -indiceLundi(premier));
  const nombreDeJours = joursDuMois(annee, mois);
  const dernier = `${annee}-${String(mois).padStart(2, '0')}-${String(nombreDeJours).padStart(2, '0')}`;
  const fin = ajouterJours(dernier, 6 - indiceLundi(dernier));

  const parJour = new Map<string, MarqueJour[]>();
  for (const marque of marques) {
    const liste = parJour.get(marque.jour);
    if (liste) liste.push(marque);
    else parJour.set(marque.jour, [marque]);
  }

  const semaines: SemaineCalendrier[] = [];
  const total = joursEntre(debut, fin) + 1;

  for (let i = 0; i < total; i += 7) {
    const jours: CaseJour[] = [];
    for (let j = 0; j < 7; j++) {
      const jour = ajouterJours(debut, i + j);
      jours.push({
        jour,
        duMois: jour.slice(0, 7) === premier.slice(0, 7),
        marques: parJour.get(jour) ?? [],
      });
    }
    semaines.push({ jours });
  }

  return semaines;
}

export const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

export const INITIALES_JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
