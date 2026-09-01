/**
 * Chiffrement de bout en bout des messages du couple.
 *
 * ## Ce qui est implémenté
 *
 * Échange de clés **X25519** : chaque appareil tire une paire, publie sa clé
 * publique, et dérive le secret partagé par ECDH avec la clé publique de
 * l'autre. Le secret passe par **HKDF-SHA256** pour donner une clé de messages,
 * puis chaque message est scellé en **XChaCha20-Poly1305** — la même primitive
 * que le coffre local.
 *
 * Le serveur ne voit que des clés publiques et des enveloppes scellées. Il ne
 * peut pas déchiffrer : la clé privée ne quitte jamais l'appareil.
 *
 * ## Ce qui n'est pas implémenté, et qu'il faut savoir
 *
 * - **Pas de confidentialité persistante.** La clé de messages est stable :
 *   qui obtiendrait une clé privée pourrait déchiffrer tout l'historique
 *   capturé. Un double ratchet à la Signal est la suite logique ; l'écrire à la
 *   main serait irresponsable, il faudra une bibliothèque auditée.
 * - **Pas de sécurité post-compromission** : aucun renouvellement de clé.
 * - **Le serveur pourrait substituer une clé publique.** C'est l'attaque de
 *   l'homme du milieu classique, et la parade est la même que chez Signal :
 *   `empreinteDeVerification` produit un nombre que les deux comparent de vive
 *   voix. Tant qu'il n'est pas comparé, la confidentialité repose sur
 *   l'honnêteté du serveur.
 *
 * Ces limites sont réelles ; les taire serait pire que les avoir.
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { decoderBase64, encoderBase64, LONGUEUR_NONCE } from '../privacy/coffre';

export const LONGUEUR_CLE_PRIVEE = 32;

const INFO_HKDF = 'lonlonbenu/messages/v1';
const PREFIXE = 'm1';
const SEPARATEUR = '.';

export interface PaireDeClesE2E {
  /** Ne quitte jamais l'appareil. */
  cleePrivee: string;
  clePublique: string;
}

/** Dérive une paire X25519 depuis 32 octets d'aléa fournis par l'appelant. */
export function paireDepuisAlea(octets: Uint8Array): PaireDeClesE2E {
  if (octets.length < LONGUEUR_CLE_PRIVEE) {
    throw new Error(`${LONGUEUR_CLE_PRIVEE} octets d’aléa attendus`);
  }
  const privee = octets.slice(0, LONGUEUR_CLE_PRIVEE);
  return {
    cleePrivee: encoderBase64(privee),
    clePublique: encoderBase64(x25519.getPublicKey(privee)),
  };
}

/**
 * Clé de messages du couple, dérivée du secret ECDH.
 *
 * Les deux clés publiques entrent dans le sel, **triées**, pour que les deux
 * appareils dérivent exactement la même clé sans avoir à s'accorder sur qui est
 * « le premier ».
 */
export function deriverCleDeMessages(
  cleePriveeMienne: string,
  clePubliqueAutre: string,
): Uint8Array {
  const privee = decoderBase64(cleePriveeMienne);
  const publiqueAutre = decoderBase64(clePubliqueAutre);
  const partage = x25519.getSharedSecret(privee, publiqueAutre);

  const mienne = encoderBase64(x25519.getPublicKey(privee));
  const sel = new TextEncoder().encode([mienne, clePubliqueAutre].sort().join('|'));

  return hkdf(sha256, partage, sel, new TextEncoder().encode(INFO_HKDF), 32);
}

/** Enveloppe : `m1.<nonce base64>.<scellé base64>`. */
export function scellerMessage(
  cle: Uint8Array,
  nonce: Uint8Array,
  clair: string,
): string {
  if (nonce.length !== LONGUEUR_NONCE) {
    throw new Error(`Nonce de ${LONGUEUR_NONCE} octets attendu`);
  }
  const scelle = xchacha20poly1305(cle, nonce).encrypt(
    new TextEncoder().encode(clair),
  );
  return [PREFIXE, encoderBase64(nonce), encoderBase64(scelle)].join(SEPARATEUR);
}

export function ouvrirMessage(cle: Uint8Array, charge: string): string {
  const morceaux = charge.split(SEPARATEUR);
  if (morceaux.length !== 3 || morceaux[0] !== PREFIXE) {
    throw new Error('Enveloppe de message illisible');
  }
  const nonce = decoderBase64(morceaux[1]!);
  const scelle = decoderBase64(morceaux[2]!);
  if (nonce.length !== LONGUEUR_NONCE) throw new Error('Nonce illisible');

  return new TextDecoder().decode(xchacha20poly1305(cle, nonce).decrypt(scelle));
}

/** Reconnaît une enveloppe de message, pour ne jamais afficher du chiffré brut. */
/**
 * Enveloppe d'un message retiré par son auteur.
 *
 * Ce n'est pas un scellé : il n'y a plus rien à ouvrir. C'est une sentinelle,
 * qui respecte la forme `m1.…` attendue par la base et que les deux côtés
 * reconnaissent. Le texte, lui, a été effacé du serveur.
 *
 * On garde la ligne plutôt que de la supprimer : un message qui disparaîtrait
 * du milieu d'une conversation sans laisser de trace ferait douter l'autre de
 * ce qu'il a lu.
 */
export const ENVELOPPE_RETIREE = 'm1.retire.retire';

export function estEnveloppeRetiree(valeur: string): boolean {
  return valeur === ENVELOPPE_RETIREE;
}

export function estScelleMessage(valeur: string): boolean {
  return valeur.startsWith(`${PREFIXE}${SEPARATEUR}`);
}

/**
 * Nombre de vérification, à comparer de vive voix.
 *
 * C'est la seule parade contre un serveur qui substituerait une clé publique.
 * Symétrique par construction : les clés sont triées avant d'être condensées,
 * donc les deux appareils affichent le même nombre.
 */
export function empreinteDeVerification(
  clePubliqueA: string,
  clePubliqueB: string,
): string {
  const condensat = sha256(
    new TextEncoder().encode([clePubliqueA, clePubliqueB].sort().join('|')),
  );

  // Cinq groupes de cinq chiffres : lisible à voix haute sans se perdre.
  let sortie = '';
  for (let groupe = 0; groupe < 5; groupe++) {
    let valeur = 0;
    for (let i = 0; i < 4; i++) {
      valeur = (valeur * 256 + condensat[groupe * 4 + i]!) % 100_000;
    }
    sortie += (groupe > 0 ? ' ' : '') + String(valeur).padStart(5, '0');
  }
  return sortie;
}
