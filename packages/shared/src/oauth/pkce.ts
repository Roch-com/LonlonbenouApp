/**
 * PKCE (RFC 7636), méthode S256.
 *
 * Partagé entre le client mobile et le serveur d'autorisation à dessein : le
 * défi doit être calculé exactement de la même façon des deux côtés, sinon
 * l'échange échoue sans que rien n'indique lequel des deux a tort. Une seule
 * implémentation, un seul vecteur de test.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { encoderBase64 } from '../privacy/coffre';

/** Base64 sans remplissage, avec l'alphabet URL — ce qu'exige le RFC. */
export function encoderBase64Url(octets: Uint8Array): string {
  return encoderBase64(octets)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Longueur d'aléa recommandée : 32 octets, soit 43 caractères. */
export const OCTETS_VERIFICATEUR = 32;

/**
 * Vérificateur PKCE à partir d'octets aléatoires fournis par l'appelant.
 * L'aléa reste à la charge de l'environnement : `expo-crypto` côté mobile,
 * `node:crypto` côté serveur.
 */
export function verificateurDepuisAlea(octets: Uint8Array): string {
  if (octets.length < OCTETS_VERIFICATEUR) {
    throw new Error(`Au moins ${OCTETS_VERIFICATEUR} octets d’aléa attendus`);
  }
  return encoderBase64Url(octets.slice(0, OCTETS_VERIFICATEUR));
}

/** Défi S256 : base64url(sha256(vérificateur)). */
export function defiDepuisVerificateur(verificateur: string): string {
  return encoderBase64Url(sha256(new TextEncoder().encode(verificateur)));
}
