/**
 * Clé de chiffrement locale : générée sur l'appareil, gardée par le trousseau
 * système (Keychain iOS / Keystore Android via `expo-secure-store`), jamais
 * écrite dans AsyncStorage ni envoyée nulle part.
 *
 * La clé est générée au premier lancement à partir du CSPRNG du système
 * (`expo-crypto`), puis réutilisée. La désinstaller revient à rendre les
 * données illisibles — c'est voulu : c'est aussi le levier de la dissociation
 * de compte (`oublierLaCle`).
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  decoderBase64,
  encoderBase64,
  LONGUEUR_CLE,
  LONGUEUR_NONCE,
  ouvrir,
  sceller,
} from '@lonlonbenu/shared';

const ENTREE_TROUSSEAU = 'lonlonbenu.coffre.cle';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Lisible dès le premier déverrouillage : les stores écrivent aussi quand
  // l'app est en arrière-plan. Le verrou biométrique (pôle ⑥) viendra en
  // complément, au niveau de l'app, pas de la clé.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let cleEnCours: Promise<Uint8Array> | null = null;

async function chargerOuCreerLaCle(): Promise<Uint8Array> {
  const existante = await SecureStore.getItemAsync(ENTREE_TROUSSEAU, OPTIONS);
  if (existante) {
    const octets = decoderBase64(existante);
    if (octets.length === LONGUEUR_CLE) return octets;
    // Entrée corrompue : on repart d'une clé neuve plutôt que de planter.
    console.warn('[coffre] clé du trousseau illisible, régénération');
  }

  const nouvelle = Crypto.getRandomBytes(LONGUEUR_CLE);
  await SecureStore.setItemAsync(
    ENTREE_TROUSSEAU,
    encoderBase64(nouvelle),
    OPTIONS,
  );
  return nouvelle;
}

/** Mémoïsée : un seul aller-retour vers le trousseau par session. */
export function cleDuCoffre(): Promise<Uint8Array> {
  cleEnCours ??= chargerOuCreerLaCle();
  return cleEnCours;
}

export async function chiffrer(clair: string, contexte: string): Promise<string> {
  const cle = await cleDuCoffre();
  const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
  return sceller(cle, nonce, clair, contexte);
}

export async function dechiffrer(
  charge: string,
  contexte: string,
): Promise<string> {
  const cle = await cleDuCoffre();
  return ouvrir(cle, charge, contexte);
}

/**
 * Rend définitivement illisibles toutes les données chiffrées de l'appareil.
 * Brique de la dissociation de compte (pôle ⑥) : effacer la clé suffit, il n'y
 * a pas besoin de parcourir chaque enregistrement.
 */
export async function oublierLaCle(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTREE_TROUSSEAU, OPTIONS);
  cleEnCours = null;
}
