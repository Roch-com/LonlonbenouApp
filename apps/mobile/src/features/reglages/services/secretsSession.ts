/**
 * Le jeton de rafraîchissement vit dans le trousseau système, à côté de la clé
 * du coffre et du code de verrouillage.
 *
 * **Le jeton d'accès, lui, n'est jamais écrit nulle part** : il dure dix
 * minutes et se retrouve en une requête. L'écrire sur le disque l'exposerait
 * pendant dix minutes pour ne rien gagner.
 */
import * as SecureStore from 'expo-secure-store';

const ENTREE_RAFRAICHISSEMENT = 'lonlonbenu.session.rafraichissement';
const ENTREE_PARTENAIRE = 'lonlonbenu.session.partenaire';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Le rafraîchissement doit fonctionner au retour d'arrière-plan, donc après
  // le premier déverrouillage plutôt qu'à écran allumé seulement.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function enregistrerRafraichissement(jeton: string): Promise<void> {
  await SecureStore.setItemAsync(ENTREE_RAFRAICHISSEMENT, jeton, OPTIONS);
}

export async function lireRafraichissement(): Promise<string | undefined> {
  return (await SecureStore.getItemAsync(ENTREE_RAFRAICHISSEMENT, OPTIONS)) ?? undefined;
}

export async function enregistrerPartenaireId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ENTREE_PARTENAIRE, id, OPTIONS);
}

export async function lirePartenaireId(): Promise<string | undefined> {
  return (await SecureStore.getItemAsync(ENTREE_PARTENAIRE, OPTIONS)) ?? undefined;
}

export async function effacerSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTREE_RAFRAICHISSEMENT, OPTIONS);
  await SecureStore.deleteItemAsync(ENTREE_PARTENAIRE, OPTIONS);
}
