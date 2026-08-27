/**
 * Coffre — chiffrement au repos des données locales.
 *
 * Primitive : XChaCha20-Poly1305 (chiffrement authentifié, nonce de 192 bits
 * tiré au hasard à chaque écriture, donc pas de compteur à gérer ni de risque
 * de réutilisation en pratique). Implémentation `@noble/ciphers`, auditée et
 * 100 % JavaScript : aucun module natif à maintenir, aucun `prebuild` imposé.
 *
 * Ce fichier est volontairement pur : ni clé, ni aléa, ni stockage. Il reçoit
 * la clé et le nonce et rend une chaîne. C'est ce qui le rend testable en
 * Node, et c'est aussi ce qui garantit que la clé ne peut pas fuiter ici — elle
 * vit dans le trousseau de l'appareil (voir `apps/mobile/src/lib/chiffrement.ts`).
 *
 * Format d'enveloppe : `lb1.<nonce base64>.<scellé base64>`
 * Le scellé inclut le tag d'authentification Poly1305 : toute altération d'un
 * octet fait échouer l'ouverture, elle ne produit jamais de clair douteux.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

export const LONGUEUR_CLE = 32;
export const LONGUEUR_NONCE = 24;

const PREFIXE = 'lb1';
const SEPARATEUR = '.';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encoderBase64(octets: Uint8Array): string {
  let sortie = '';
  for (let i = 0; i < octets.length; i += 3) {
    const a = octets[i]!;
    const b = octets[i + 1];
    const c = octets[i + 2];
    const bloc = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    sortie += ALPHABET[(bloc >> 18) & 63];
    sortie += ALPHABET[(bloc >> 12) & 63];
    sortie += b === undefined ? '=' : ALPHABET[(bloc >> 6) & 63];
    sortie += c === undefined ? '=' : ALPHABET[bloc & 63];
  }
  return sortie;
}

export function decoderBase64(texte: string): Uint8Array {
  const propre = texte.replace(/=+$/, '');
  const octets = new Uint8Array(Math.floor((propre.length * 6) / 8));

  let accumulateur = 0;
  let bits = 0;
  let curseur = 0;

  for (const caractere of propre) {
    const valeur = ALPHABET.indexOf(caractere);
    if (valeur < 0) throw new Error('Base64 invalide');
    accumulateur = (accumulateur << 6) | valeur;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      octets[curseur++] = (accumulateur >> bits) & 0xff;
    }
  }
  return octets;
}

const encodeur = (texte: string): Uint8Array => {
  // TextEncoder est présent sous Hermes comme sous Node ; on garde un repli
  // manuel UTF-8 pour ne dépendre d'aucun polyfill.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texte);
  const octets: number[] = [];
  for (const point of texte) {
    const code = point.codePointAt(0)!;
    if (code < 0x80) octets.push(code);
    else if (code < 0x800) octets.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000)
      octets.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    else
      octets.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
  }
  return new Uint8Array(octets);
};

const decodeur = (octets: Uint8Array): string => {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(octets);
  let sortie = '';
  for (let i = 0; i < octets.length;) {
    const a = octets[i]!;
    if (a < 0x80) {
      sortie += String.fromCodePoint(a);
      i += 1;
    } else if (a < 0xe0) {
      sortie += String.fromCodePoint(((a & 0x1f) << 6) | (octets[i + 1]! & 0x3f));
      i += 2;
    } else if (a < 0xf0) {
      sortie += String.fromCodePoint(
        ((a & 0x0f) << 12) |
          ((octets[i + 1]! & 0x3f) << 6) |
          (octets[i + 2]! & 0x3f),
      );
      i += 3;
    } else {
      sortie += String.fromCodePoint(
        ((a & 0x07) << 18) |
          ((octets[i + 1]! & 0x3f) << 12) |
          ((octets[i + 2]! & 0x3f) << 6) |
          (octets[i + 3]! & 0x3f),
      );
      i += 4;
    }
  }
  return sortie;
};

/**
 * Chiffre `clair`. Le `contexte` (nom de l'espace de stockage) est authentifié
 * sans être chiffré : une valeur ne peut pas être déplacée d'un store à un
 * autre sans que l'ouverture échoue.
 */
export function sceller(
  cle: Uint8Array,
  nonce: Uint8Array,
  clair: string,
  contexte: string,
): string {
  verifierCle(cle);
  if (nonce.length !== LONGUEUR_NONCE) {
    throw new Error(`Nonce de ${LONGUEUR_NONCE} octets attendu`);
  }

  const scelle = xchacha20poly1305(cle, nonce, encodeur(contexte)).encrypt(
    encodeur(clair),
  );
  return [PREFIXE, encoderBase64(nonce), encoderBase64(scelle)].join(SEPARATEUR);
}

/** Déchiffre une enveloppe. Lève si la clé, le contexte ou le contenu ne collent pas. */
export function ouvrir(cle: Uint8Array, charge: string, contexte: string): string {
  verifierCle(cle);

  const morceaux = charge.split(SEPARATEUR);
  if (morceaux.length !== 3 || morceaux[0] !== PREFIXE) {
    throw new Error('Enveloppe illisible');
  }

  const nonce = decoderBase64(morceaux[1]!);
  const scelle = decoderBase64(morceaux[2]!);
  if (nonce.length !== LONGUEUR_NONCE) throw new Error('Nonce illisible');

  const clair = xchacha20poly1305(cle, nonce, encodeur(contexte)).decrypt(scelle);
  return decodeur(clair);
}

/** Distingue une enveloppe d'une valeur en clair héritée d'une version antérieure. */
export function estScelle(valeur: string): boolean {
  return valeur.startsWith(`${PREFIXE}${SEPARATEUR}`);
}

function verifierCle(cle: Uint8Array): void {
  if (cle.length !== LONGUEUR_CLE) {
    throw new Error(`Clé de ${LONGUEUR_CLE} octets attendue`);
  }
}
