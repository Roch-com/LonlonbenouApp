import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { estScelle } from '@lonlonbenu/shared';
import { chiffrer, dechiffrer } from './chiffrement';

/**
 * Persistance locale des stores, chiffrée au repos.
 *
 * AsyncStorage reste le support (SQLite côté Android, fichier côté iOS), mais
 * il ne voit plus que des enveloppes XChaCha20-Poly1305. La clé vit dans le
 * trousseau système — voir `chiffrement.ts` et le README du pôle ⑥.
 *
 * Le nom de l'espace de stockage sert de donnée authentifiée : une enveloppe
 * copiée de `lonlonbenu.chat` vers `lonlonbenu.presence` ne s'ouvre pas.
 */
const stockageChiffre: StateStorage = {
  getItem: async (nom) => {
    const brut = await AsyncStorage.getItem(nom);
    if (brut === null) return null;

    // Migration : valeurs écrites en clair par une version antérieure.
    // On les rechiffre tout de suite, sans attendre la prochaine écriture.
    if (!estScelle(brut)) {
      await AsyncStorage.setItem(nom, await chiffrer(brut, nom));
      return brut;
    }

    try {
      return await dechiffrer(brut, nom);
    } catch {
      // Clé perdue ou enveloppe altérée : illisible pour de bon. On repart de
      // l'état initial sans effacer, au cas où la clé reviendrait.
      console.warn(`[coffre] « ${nom} » illisible, état initial rechargé`);
      return null;
    }
  },

  setItem: async (nom, valeur) => {
    await AsyncStorage.setItem(nom, await chiffrer(valeur, nom));
  },

  removeItem: (nom) => AsyncStorage.removeItem(nom),
};

export const stockage = createJSONStorage(() => stockageChiffre);

export function identifiant(): string {
  return Crypto.randomUUID();
}
