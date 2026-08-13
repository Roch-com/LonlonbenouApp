/**
 * Accès serveur aux confidences.
 *
 * Il n'y a **aucune fonction de brouillon ici, et c'est le point du module** :
 * un brouillon n'a pas de représentation réseau. La seule écriture possible est
 * `envoyerConfidence`, qui correspond au geste d'offrir — irréversible.
 */
import type { Confidence, TypeConfidence } from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export async function listerConfidences(
  coupleId: string,
  type?: TypeConfidence,
): Promise<Confidence[]> {
  const { confidences } = await appeler<{ confidences: Confidence[] }>(
    `/couples/${coupleId}/confidences${type ? `?type=${type}` : ''}`,
  );
  return confidences;
}

export async function envoyerConfidence(
  coupleId: string,
  type: TypeConfidence,
  texte: string,
  titre?: string,
): Promise<Confidence> {
  const { confidence } = await appeler<{ confidence: Confidence }>(
    `/couples/${coupleId}/confidences`,
    { methode: 'POST', corps: { type, texte, titre } },
  );
  return confidence;
}

export async function marquerLueServeur(
  coupleId: string,
  id: string,
): Promise<Confidence> {
  const { confidence } = await appeler<{ confidence: Confidence }>(
    `/couples/${coupleId}/confidences/${id}/lecture`,
    { methode: 'PUT' },
  );
  return confidence;
}
