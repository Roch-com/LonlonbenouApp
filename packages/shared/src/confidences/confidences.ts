/**
 * Espace de confidences — règles de visibilité.
 *
 * La réciprocité prend ici une autre forme que dans `reciprocite.ts` : une
 * confidence n'est pas une observation, c'est un geste. Personne ne peut aller
 * chercher ce que l'autre n'a pas donné, et il n'existe aucun état où l'un
 * accède au contenu de l'autre sans que celui-ci l'ait envoyé sciemment.
 *
 * D'où deux règles seulement :
 *   - un brouillon (`prive`) n'appartient qu'à son auteur, pour toujours ;
 *   - une confidence envoyée (`couple`) est lisible par les deux, à l'identique.
 *
 * Un brouillon ne s'envoie jamais tout seul. Aucun compte à rebours, aucune
 * publication automatique : le brouillon différé de 24 h est une fonctionnalité
 * P1, et elle devra rester déclenchée par l'auteur.
 */

import { estVisiblePar } from '../privacy/visibilite';
import type { PartenaireId } from '../types/couple';
import type { Confidence, TypeConfidence } from '../types/confidences';

export function estBrouillon(confidence: Confidence): boolean {
  return confidence.visibilite === 'prive';
}

export function estEnvoyee(confidence: Confidence): boolean {
  return confidence.visibilite === 'couple' && !!confidence.envoyeeLe;
}

/** Marque une confidence comme envoyée. Opération à sens unique et volontaire. */
export function envoyer(
  confidence: Confidence,
  horodatage: string = new Date().toISOString(),
): Confidence {
  if (!confidence.texte.trim()) {
    throw new Error('Une confidence vide ne s’envoie pas');
  }
  if (estEnvoyee(confidence)) return confidence;
  return { ...confidence, visibilite: 'couple', envoyeeLe: horodatage };
}

/**
 * Ce qu'un lecteur a le droit de voir.
 * Unique porte d'entrée en lecture : aucun écran ne parcourt la liste brute.
 */
export function confidencesVisiblesPar(
  confidences: readonly Confidence[],
  lecteurId: PartenaireId,
  type?: TypeConfidence,
): Confidence[] {
  return confidences.filter(
    (c) =>
      estVisiblePar({ auteurId: c.auteurId, visibilite: c.visibilite }, lecteurId) &&
      (type === undefined || c.type === type),
  );
}

/** Confidences reçues et pas encore ouvertes. */
export function nonLues(
  confidences: readonly Confidence[],
  lecteurId: PartenaireId,
): Confidence[] {
  return confidencesVisiblesPar(confidences, lecteurId).filter(
    (c) => c.auteurId !== lecteurId && !c.luLe,
  );
}
