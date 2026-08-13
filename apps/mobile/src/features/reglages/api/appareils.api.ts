import { appeler } from '@/lib/api/client';
import type { PlateformePush } from '../services/jetonAppareil';

/**
 * Inscrit cet appareil pour les notifications poussées.
 *
 * Le serveur rattache le jeton au partenaire du jeton d'accès — jamais à un
 * identifiant fourni dans le corps. On ne peut donc pas inscrire un appareil au
 * nom de quelqu'un d'autre, ce qui serait exactement le mode furtif que le
 * projet s'interdit.
 */
export async function inscrireAppareil(
  jetonPush: string,
  plateforme: PlateformePush,
): Promise<void> {
  await appeler('/appareils', {
    methode: 'POST',
    corps: { jetonPush, plateforme },
  });
}
