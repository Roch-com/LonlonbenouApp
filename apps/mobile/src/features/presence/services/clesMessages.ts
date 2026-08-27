/**
 * Gestion de la paire de clés de messages.
 *
 * **La clé privée ne quitte jamais l'appareil.** Elle vit dans le trousseau
 * système, à côté de la clé du coffre et du code de verrouillage ; seule la clé
 * publique est publiée au serveur.
 *
 * Elle n'est pas dérivée du mot de passe ni du code d'appairage : elle est
 * tirée au hasard une fois, à la première ouverture du chat. Conséquence à
 * assumer et à afficher clairement : **perdre l'appareil, c'est perdre
 * l'historique** — sans double ratchet ni sauvegarde de clé, il n'y a pas de
 * récupération possible. C'est le prix du bout en bout tel qu'il est écrit ici.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  deriverCleDeMessages,
  LONGUEUR_CLE_PRIVEE,
  paireDepuisAlea,
  type PaireDeClesE2E,
} from '@lonlonbenu/shared';

const ENTREE_PAIRE = 'lonlonbenu.chat.paire';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** Rend la paire de l'appareil, en la créant à la première demande. */
export async function paireDeLAppareil(): Promise<PaireDeClesE2E> {
  const brut = await SecureStore.getItemAsync(ENTREE_PAIRE, OPTIONS);
  if (brut) {
    try {
      return JSON.parse(brut) as PaireDeClesE2E;
    } catch {
      console.warn('[chat] paire de clés illisible, régénération');
    }
  }

  const paire = paireDepuisAlea(Crypto.getRandomBytes(LONGUEUR_CLE_PRIVEE));
  await SecureStore.setItemAsync(ENTREE_PAIRE, JSON.stringify(paire), OPTIONS);
  return paire;
}

/** Clé de messages du couple. Recalculée à la demande, jamais stockée. */
export async function cleDeMessages(clePubliqueAutre: string): Promise<Uint8Array> {
  const { cleePrivee } = await paireDeLAppareil();
  return deriverCleDeMessages(cleePrivee, clePubliqueAutre);
}

export async function effacerLaPaire(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTREE_PAIRE, OPTIONS);
}
