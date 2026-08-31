import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import {
  distanceEnMetres,
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
  type Position,
} from '@lonlonbenu/shared';
import { cleDeMessages } from './clesMessages';
import { useChat } from '../stores/chatStore';

/**
 * Pôle ① — relevé de position sur l'appareil (§8.2, §9.5, §9.6).
 *
 * ## Le chiffrement décide de l'architecture
 *
 * La position part scellée : le serveur ne voit qu'une enveloppe. Il ne peut
 * donc ni mesurer une distance, ni déclencher quoi que ce soit à l'entrée dans
 * un lieu. Tout se calcule ici, après ouverture — c'est la contrepartie
 * directe du §9.5, et elle vaut d'être payée.
 *
 * ## Fréquence adaptative (§9.6)
 *
 * Le cahier signale explicitement la batterie comme point de vigilance connu
 * sur ce type de fonctionnalité. Deux leviers, tous deux nécessaires :
 *
 *   - **la précision demandée** : `Balanced` plutôt que `BestForNavigation`.
 *     On situe quelqu'un dans un quartier, on ne le guide pas au carrefour.
 *   - **l'espacement des relevés** : long à l'arrêt, court en déplacement.
 *     Un téléphone posé sur une table n'a rien de neuf à dire toutes les
 *     trente secondes, et le redemander vide la batterie sans rien apprendre.
 *
 * Rien ne tourne en arrière-plan. Un suivi continu hors de l'app serait à la
 * fois un gouffre à batterie et exactement le genre de veille que ce projet
 * s'interdit : la position se relève pendant qu'on regarde l'écran de présence.
 */

/** Au-delà, on considère que la personne s'est déplacée. */
const SEUIL_DEPLACEMENT_M = 120;

/** Espacement des relevés, selon qu'on bouge ou non. */
export const INTERVALLE_ARRET_MS = 120_000;
export const INTERVALLE_MOUVEMENT_MS = 25_000;

export type EtatPermissionPosition =
  | 'jamais_demandee'
  | 'accordee'
  | 'refusee'
  | 'indisponible';

export async function permissionActuelle(): Promise<EtatPermissionPosition> {
  const services = await Location.hasServicesEnabledAsync().catch(() => false);
  if (!services) return 'indisponible';

  const etat = await Location.getForegroundPermissionsAsync();
  if (etat.granted) return 'accordee';
  return etat.canAskAgain ? 'jamais_demandee' : 'refusee';
}

/**
 * Demande la permission. **Premier plan uniquement** : l'app ne relève jamais
 * de position quand personne ne la regarde, et réclamer l'autorisation
 * d'arrière-plan pour ne pas s'en servir serait demander plus que nécessaire.
 */
export async function demanderLaPermission(): Promise<EtatPermissionPosition> {
  const etat = await Location.requestForegroundPermissionsAsync();
  if (etat.granted) return 'accordee';
  return etat.canAskAgain ? 'jamais_demandee' : 'refusee';
}

/** Un relevé, ou `undefined` si le téléphone n'a rien à donner. */
export async function releverLaPosition(): Promise<Position | undefined> {
  try {
    const brute = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: brute.coords.latitude,
      longitude: brute.coords.longitude,
      precisionM: brute.coords.accuracy ?? undefined,
      releveeLe: new Date(brute.timestamp).toISOString(),
    };
  } catch {
    // Service coupé, permission retirée entre-temps, capteur muet : on ne
    // publie rien plutôt que d'envoyer une position inventée.
    return undefined;
  }
}

/** Espacement du prochain relevé, d'après le déplacement constaté. */
export function prochainIntervalle(
  precedente: Position | undefined,
  courante: Position,
): number {
  if (!precedente) return INTERVALLE_MOUVEMENT_MS;
  return distanceEnMetres(precedente, courante) > SEUIL_DEPLACEMENT_M
    ? INTERVALLE_MOUVEMENT_MS
    : INTERVALLE_ARRET_MS;
}

/** Clé du couple, ou `undefined` si l'échange de clés n'a pas eu lieu. */
export async function cleDuCouple(): Promise<Uint8Array | undefined> {
  const clePubliqueAutre = useChat.getState().cles?.autre;
  if (!clePubliqueAutre) return undefined;
  return cleDeMessages(clePubliqueAutre);
}

export function scellerPosition(cle: Uint8Array, position: Position): string {
  const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
  return scellerMessage(cle, nonce, JSON.stringify(position));
}

/** Ouvre une enveloppe de position. `undefined` si elle est illisible. */
export function ouvrirPosition(
  cle: Uint8Array | undefined,
  scellee: string,
): Position | undefined {
  if (!cle) return undefined;
  try {
    const clair = JSON.parse(ouvrirMessage(cle, scellee)) as Position;
    // Une enveloppe qui s'ouvre sur autre chose qu'une position ne doit pas
    // se propager en `NaN` dans tous les calculs de distance.
    if (
      typeof clair?.latitude !== 'number' ||
      typeof clair?.longitude !== 'number'
    ) {
      return undefined;
    }
    return clair;
  } catch {
    return undefined;
  }
}
