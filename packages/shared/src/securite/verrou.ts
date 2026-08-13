/**
 * Pôle ⑥ — Verrou d'application : la partie calculable, donc testable.
 *
 * Le code PIN n'est jamais conservé. On garde un vérificateur dérivé
 * (PBKDF2-SHA256, sel aléatoire), rangé dans le trousseau système à côté de la
 * clé du coffre.
 *
 * Il faut être lucide sur ce que la dérivation apporte : un code à quatre
 * chiffres, c'est dix mille possibilités. Aucune fonction de dérivation ne rend
 * cet espace incassable pour qui détient le vérificateur. La vraie protection
 * tient à trois choses, dans cet ordre :
 *
 *   1. le vérificateur vit dans le Keychain / Keystore, hors de portée sans
 *      compromission de l'appareil ;
 *   2. les tentatives sont comptées et le verrou se durcit à chaque échec ;
 *   3. la dérivation ralentit malgré tout une attaque hors ligne.
 *
 * Le PIN n'est donc pas la ligne de défense principale — c'est le repli quand
 * la biométrie n'est pas disponible. Le chiffrement des données, lui, ne dépend
 * pas du PIN : il repose sur la clé du coffre (voir `privacy/coffre.ts`).
 */

import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { decoderBase64, encoderBase64 } from '../privacy/coffre';

export const LONGUEUR_PIN_MIN = 4;
export const LONGUEUR_PIN_MAX = 6;
/**
 * Calibré pour rester sous la seconde sous Hermes. Monter plus haut rendrait le
 * déverrouillage pénible, et pousserait surtout les gens à désactiver le verrou
 * — ce qui protégerait beaucoup moins bien qu'un palier un peu plus bas.
 */
export const ITERATIONS_PBKDF2 = 120_000;
export const LONGUEUR_SEL = 16;

export interface VerificateurPin {
  version: 1;
  sel: string;
  iterations: number;
  empreinte: string;
}

export type MotifPinRefuse =
  | 'longueur'
  | 'chiffres_seulement'
  | 'trop_previsible';

export interface ControlePin {
  valide: boolean;
  motif?: MotifPinRefuse;
  /** Message prêt à l'affichage, jamais moralisateur. */
  message?: string;
}

const MESSAGES: Record<MotifPinRefuse, string> = {
  longueur: `Choisissez ${LONGUEUR_PIN_MIN} à ${LONGUEUR_PIN_MAX} chiffres.`,
  chiffres_seulement: 'Le code ne contient que des chiffres.',
  trop_previsible:
    'Ce code se devine trop vite. Prenez-en un autre, il vous protégera mieux.',
};

function estSuite(pin: string): boolean {
  const chiffres = [...pin].map(Number);
  const croissante = chiffres.every(
    (c, i) => i === 0 || c === (chiffres[i - 1]! + 1) % 10,
  );
  const decroissante = chiffres.every(
    (c, i) => i === 0 || c === (chiffres[i - 1]! + 9) % 10,
  );
  return croissante || decroissante;
}

export function controlerPin(pin: string): ControlePin {
  if (pin.length < LONGUEUR_PIN_MIN || pin.length > LONGUEUR_PIN_MAX) {
    return { valide: false, motif: 'longueur', message: MESSAGES.longueur };
  }
  if (!/^\d+$/.test(pin)) {
    return {
      valide: false,
      motif: 'chiffres_seulement',
      message: MESSAGES.chiffres_seulement,
    };
  }
  const tousPareils = new Set(pin).size === 1;
  if (tousPareils || estSuite(pin)) {
    return {
      valide: false,
      motif: 'trop_previsible',
      message: MESSAGES.trop_previsible,
    };
  }
  return { valide: true };
}

function deriver(pin: string, sel: Uint8Array, iterations: number): Uint8Array {
  return pbkdf2(sha256, pin, sel, { c: iterations, dkLen: 32 });
}

/** Construit le vérificateur à ranger dans le trousseau. `sel` doit être aléatoire. */
export function creerVerificateur(
  pin: string,
  sel: Uint8Array,
  iterations: number = ITERATIONS_PBKDF2,
): VerificateurPin {
  const controle = controlerPin(pin);
  if (!controle.valide) throw new Error(controle.message);
  if (sel.length !== LONGUEUR_SEL) {
    throw new Error(`Sel de ${LONGUEUR_SEL} octets attendu`);
  }

  return {
    version: 1,
    sel: encoderBase64(sel),
    iterations,
    empreinte: encoderBase64(deriver(pin, sel, iterations)),
  };
}

/** Comparaison à temps constant : pas de fuite par la durée de la boucle. */
function memeEmpreinte(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export function verifierPin(pin: string, verificateur: VerificateurPin): boolean {
  if (!/^\d+$/.test(pin)) return false;
  const sel = decoderBase64(verificateur.sel);
  const candidate = deriver(pin, sel, verificateur.iterations);
  return memeEmpreinte(candidate, decoderBase64(verificateur.empreinte));
}

/**
 * Variantes asynchrones, à utiliser dans l'app : `pbkdf2Async` rend la main
 * régulièrement, ce qui évite de figer l'interface pendant la dérivation.
 */
export async function creerVerificateurAsync(
  pin: string,
  sel: Uint8Array,
  iterations: number = ITERATIONS_PBKDF2,
): Promise<VerificateurPin> {
  const controle = controlerPin(pin);
  if (!controle.valide) throw new Error(controle.message);
  if (sel.length !== LONGUEUR_SEL) {
    throw new Error(`Sel de ${LONGUEUR_SEL} octets attendu`);
  }

  const empreinte = await pbkdf2Async(sha256, pin, sel, {
    c: iterations,
    dkLen: 32,
  });
  return {
    version: 1,
    sel: encoderBase64(sel),
    iterations,
    empreinte: encoderBase64(empreinte),
  };
}

export async function verifierPinAsync(
  pin: string,
  verificateur: VerificateurPin,
): Promise<boolean> {
  if (!/^\d+$/.test(pin)) return false;
  const candidate = await pbkdf2Async(
    sha256,
    pin,
    decoderBase64(verificateur.sel),
    { c: verificateur.iterations, dkLen: 32 },
  );
  return memeEmpreinte(candidate, decoderBase64(verificateur.empreinte));
}

// -------------------------------------------------------------- durcissement

/**
 * Palier d'attente après `echecs` tentatives ratées consécutives, en secondes.
 * Progressif plutôt que brutal : une faute de frappe ne doit pas enfermer
 * quelqu'un dehors, une attaque par balayage doit devenir inutilisable.
 */
export function attenteApresEchecs(echecs: number): number {
  if (echecs < 3) return 0;
  if (echecs === 3) return 30;
  if (echecs === 4) return 60;
  if (echecs === 5) return 300;
  return 900;
}

export interface EtatDurcissement {
  bloque: boolean;
  secondesRestantes: number;
}

export function etatDurcissement(
  echecs: number,
  dernierEchecLe: string | undefined,
  maintenant: string = new Date().toISOString(),
): EtatDurcissement {
  const attente = attenteApresEchecs(echecs);
  if (attente === 0 || !dernierEchecLe) {
    return { bloque: false, secondesRestantes: 0 };
  }

  const ecoule = (Date.parse(maintenant) - Date.parse(dernierEchecLe)) / 1000;
  const restant = Math.ceil(attente - ecoule);
  return restant > 0
    ? { bloque: true, secondesRestantes: restant }
    : { bloque: false, secondesRestantes: 0 };
}

/**
 * Il n'existe volontairement **aucun effacement automatique des données après
 * N échecs**. Un partenaire pourrait saisir de faux codes exprès pour détruire
 * ce que l'autre a écrit ; le durcissement fait attendre, il ne punit pas.
 */
export const EFFACEMENT_APRES_ECHECS = false;
