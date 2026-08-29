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
  /**
   * **Ne rejette jamais.** Une lecture qui échoue rend `null`, comme une clé
   * absente. Ce n'est pas de la complaisance : zustand n'appelle pas ses
   * auditeurs de fin d'hydratation quand la lecture lève, si bien qu'un écran
   * qui attend l'hydratation attendait alors pour toujours — un fond vide et
   * un indicateur qui tourne, sans rien pour en sortir.
   *
   * Repartir de l'état initial est le même comportement qu'une première
   * installation, et rien n'est effacé : si la clé du trousseau redevient
   * lisible, la lecture suivante retrouve tout.
   */
  getItem: async (nom) => {
    try {
      const brut = await AsyncStorage.getItem(nom);
      if (brut === null) return null;

      // Migration : valeurs écrites en clair par une version antérieure.
      // On les rechiffre tout de suite, sans attendre la prochaine écriture.
      if (!estScelle(brut)) {
        await AsyncStorage.setItem(nom, await chiffrer(brut, nom));
        return brut;
      }

      return await dechiffrer(brut, nom);
    } catch {
      // Clé perdue, enveloppe altérée, trousseau indisponible : illisible
      // pour cette fois. On repart de l'état initial sans effacer.
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
