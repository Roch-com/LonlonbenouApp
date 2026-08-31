import * as Crypto from 'expo-crypto';
import {
  estScelleMessage,
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
} from '@lonlonbenu/shared';
import { cleDeMessages } from '@/features/presence/services/clesMessages';
import { useChat } from '@/features/presence/stores/chatStore';

/**
 * Pôle ② — chiffrement de bout en bout des confidences (§9.5 du cahier).
 *
 * ## Pourquoi la même clé que le chat
 *
 * Le cahier exige le bout en bout « pour le chat, l'espace de confidences et
 * les données de position ». Les confidences partaient pourtant en clair : la
 * colonne `texte` était lisible par le serveur, pour le module que le tableau
 * §8.21 classe pourtant en sensibilité « très élevée ».
 *
 * Elles réutilisent la clé de messages du couple plutôt que d'ouvrir un second
 * canal. Deux paires de clés pour les deux mêmes personnes doubleraient la
 * surface à protéger, les occasions de les perdre et le travail du futur
 * double ratchet — sans rien apporter : c'est le même couple, la même
 * confiance, le même appareil.
 *
 * ## Ce qui arrive aux confidences déjà écrites
 *
 * Elles restent en clair, et rien ne peut les rattraper : le serveur n'a pas
 * les clés pour les chiffrer, et l'application ne peut pas réécrire un texte
 * offert — le module s'interdit de modifier une confidence envoyée. Elles
 * s'affichent donc telles quelles. `ouvrirOuLaisser` traite les deux formes,
 * et c'est volontairement silencieux : signaler « ancienne confidence non
 * chiffrée » à chaque carte transformerait un souvenir en avertissement.
 */

/** Clé du couple, ou `undefined` si l'échange n'a pas encore eu lieu. */
export async function cleDuCouple(): Promise<Uint8Array | undefined> {
  const clePubliqueAutre = useChat.getState().cles?.autre;
  if (!clePubliqueAutre) return undefined;
  return cleDeMessages(clePubliqueAutre);
}

/** Scelle un texte. Lève si la clé manque : rien ne part en clair par défaut. */
export function sceller(cle: Uint8Array, clair: string): string {
  const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
  return scellerMessage(cle, nonce, clair);
}

/**
 * Ouvre si c'est scellé, rend tel quel sinon.
 *
 * Le repli n'est pas une tolérance à du clair nouveau — le serveur le refuse
 * désormais — mais la seule façon de continuer à lire ce qui a été offert
 * avant ce changement.
 */
export function ouvrirOuLaisser(
  cle: Uint8Array | undefined,
  valeur: string,
): string {
  if (!estScelleMessage(valeur)) return valeur;
  if (!cle) return '';
  try {
    return ouvrirMessage(cle, valeur);
  } catch {
    // Chiffré avec des clés disparues : illisible pour de bon, comme au chat.
    return '';
  }
}
