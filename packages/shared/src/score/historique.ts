/**
 * Pôle ② — historique du score (§8.8, « P1 pour l'historique avancé »).
 *
 * ## Ce que l'historique doit éviter d'être
 *
 * Une courbe descendante est une accusation muette. Le §8.8 interdit déjà de
 * noter les personnes ; un graphique qui montre « ça baisse depuis trois
 * semaines » remet exactement ce jugement, avec l'autorité en plus que donne
 * un dessin.
 *
 * D'où trois règles inscrites ici :
 *
 *   1. **Un seul score, celui du couple.** Aucune série individuelle, donc
 *      aucune comparaison possible entre deux courbes.
 *   2. **Pas de tendance affichée sans nuance.** `lectureTendance` refuse de
 *      commenter les variations faibles, qui ne veulent rien dire, et
 *      rappelle ce que le score mesure vraiment quand il baisse.
 *   3. **Une fenêtre courte.** Douze semaines, pas deux ans. Un historique
 *      long invite à relire l'année écoulée comme un bulletin.
 */

import { ajouterJours } from '../temps/jours';
import type { Geste } from './gestes';
import { scoreDuCouple } from './score';
import type { PartenaireId } from '../types/couple';

/** Au-delà, on relit son couple comme un bulletin scolaire. */
export const SEMAINES_HISTORIQUE = 12;

export interface PointHistorique {
  /** Premier jour de la semaine, `YYYY-MM-DD`. */
  jour: string;
  /** Score du couple sur la fenêtre glissante finissant ce jour-là. */
  valeur: number;
}

/**
 * Série hebdomadaire du score de couple.
 *
 * Chaque point rejoue `scoreDuCouple` à la date voulue, plutôt que de stocker
 * des scores figés : le calcul peut évoluer, et un historique enregistré
 * mélangerait alors deux définitions sans qu'on puisse le savoir.
 */
export function historiqueHebdomadaire(
  gestes: readonly Geste[],
  partenaires: readonly [PartenaireId, PartenaireId],
  maintenant: string = new Date().toISOString(),
  semaines: number = SEMAINES_HISTORIQUE,
): PointHistorique[] {
  const jour = maintenant.slice(0, 10);
  const points: PointHistorique[] = [];

  for (let i = semaines - 1; i >= 0; i--) {
    const fin = ajouterJours(jour, -i * 7);
    // Les gestes postérieurs au point n'existent pas encore de son point de
    // vue : les inclure ferait remonter tout l'historique à chaque nouveau
    // geste, et la courbe changerait de forme en permanence.
    const connus = gestes.filter((g) => g.faitLe.slice(0, 10) <= fin);
    points.push({
      jour: fin,
      valeur: scoreDuCouple(connus, partenaires, `${fin}T23:59:59.000Z`).valeur,
    });
  }

  return points;
}

/**
 * Sens de l’historique. Nommé séparément de la `Tendance` de `score.ts`, qui
 * décrit l’élan d’une personne sur quinze jours : ce sont deux mesures
 * différentes, et les confondre sous un même nom ferait lire l’une pour
 * l’autre.
 */
export type TendanceHistorique = 'stable' | 'monte' | 'descend';

export interface LectureTendance {
  tendance: TendanceHistorique;
  /** Écart entre le premier et le dernier point. */
  ecart: number;
  /** Phrase prête à afficher. Jamais un reproche. */
  lecture: string;
}

/**
 * En deçà, on ne commente pas.
 *
 * Le score bouge de quelques points d'une semaine à l'autre sans que rien
 * n'ait changé dans le couple. Commenter ce bruit donnerait du sens à du vide,
 * et ce sens serait toujours interprété comme un jugement.
 */
const SEUIL_SIGNIFICATIF = 8;

export function lectureTendance(
  points: readonly PointHistorique[],
): LectureTendance {
  const premier = points[0]?.valeur ?? 0;
  const dernier = points.at(-1)?.valeur ?? 0;
  const ecart = dernier - premier;

  if (points.length < 3 || Math.abs(ecart) < SEUIL_SIGNIFICATIF) {
    return {
      tendance: 'stable',
      ecart,
      lecture:
        'Rien de net d’une semaine à l’autre. C’est le cas le plus fréquent, et ce n’est pas une mauvaise nouvelle.',
    };
  }

  if (ecart > 0) {
    return {
      tendance: 'monte',
      ecart,
      lecture: 'Il y a eu plus de gestes ces dernières semaines qu’au début.',
    };
  }

  return {
    tendance: 'descend',
    ecart,
    // Le seul endroit où le ton compte vraiment : une baisse ne dit rien de
    // ce que valent les gens, seulement de ce qu'une période a permis.
    lecture:
      'Il y a eu moins de gestes notés ces dernières semaines. Une période chargée, un déplacement, une fatigue — le score mesure ce qui a été possible, pas ce que vous valez.',
  };
}
