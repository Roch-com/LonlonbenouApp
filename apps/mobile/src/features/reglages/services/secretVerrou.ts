/**
 * Le vérificateur du code PIN vit dans le trousseau système, à côté de la clé
 * du coffre — jamais dans AsyncStorage, même chiffré : c'est précisément le
 * genre de secret qui ne doit pas dépendre d'une autre clé pour être protégé.
 */
import * as SecureStore from 'expo-secure-store';
import type { VerificateurPin } from '@lonlonbenu/shared';

const ENTREE_TROUSSEAU = 'lonlonbenu.verrou.pin';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export async function enregistrerVerificateur(
  verificateur: VerificateurPin,
): Promise<void> {
  await SecureStore.setItemAsync(
    ENTREE_TROUSSEAU,
    JSON.stringify(verificateur),
    OPTIONS,
  );
}

export async function lireVerificateur(): Promise<VerificateurPin | null> {
  const brut = await SecureStore.getItemAsync(ENTREE_TROUSSEAU, OPTIONS);
  if (!brut) return null;
  try {
    return JSON.parse(brut) as VerificateurPin;
  } catch {
    console.warn('[verrou] vérificateur illisible, code à redéfinir');
    return null;
  }
}

export async function effacerVerificateur(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTREE_TROUSSEAU, OPTIONS);
}
