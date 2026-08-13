/**
 * Pôle ⑥ — Invitation du partenaire.
 *
 * Sans serveur, un code d'invitation reste un secret transmis de la main à la
 * main. Ce qu'on peut garantir dès maintenant, et qui est testé ici :
 *
 *   - **entropie suffisante** : 8 caractères tirés d'un alphabet de 32, soit
 *     40 bits — hors de portée d'une devinette, y compris répétée ;
 *   - **durée de vie courte** : un code expiré ne vaut plus rien ;
 *   - **usage unique** : une invitation consommée ne se rejoue pas ;
 *   - **essais comptés** : cinq erreurs et le code est brûlé, ce qui rend le
 *     balayage inutile même si la durée de vie était longue ;
 *   - **comparaison à temps constant**, et code jamais conservé en clair du
 *     côté qui vérifie — seul un vérificateur dérivé l'est.
 *
 * Ce qui reste à faire côté serveur en Sprint 1 : c'est le serveur qui devra
 * détenir le vérificateur et arbitrer l'appairage. Tant que les deux moitiés
 * vivent sur le même appareil, l'appairage est une simulation — la logique,
 * elle, est écrite pour être rejouée telle quelle.
 */

import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { decoderBase64, encoderBase64 } from '../privacy/coffre';
import type { PartenaireId } from '../types/couple';

/**
 * Alphabet sans caractères ambigus : ni 0/O, ni 1/I/L, ni 8/B, ni 2/Z.
 * Un code se lit à voix haute au téléphone — une confusion de lettre coûte plus
 * cher que les quelques bits d'entropie économisés.
 */
export const ALPHABET_CODE = '34679ACDEFGHJKMNPQRSTUVWXY';

export const LONGUEUR_CODE = 8;
export const DUREE_VIE_MINUTES = 15;
export const ESSAIS_MAX = 5;
const ITERATIONS = 20_000;

export interface Invitation {
  /** Vérificateur dérivé. Le code lui-même n'est pas ici. */
  verificateur: string;
  sel: string;
  emisePar: PartenaireId;
  emiseLe: string;
  expireLe: string;
  essais: number;
  consommeeLe?: string;
}

export type MotifRefus =
  | 'expiree'
  | 'deja_utilisee'
  | 'trop_d_essais'
  | 'code_incorrect';

export interface ResultatInvitation {
  ok: boolean;
  motif?: MotifRefus;
  message?: string;
  /** Invitation mise à jour : essais incrémentés ou consommation notée. */
  invitation: Invitation;
}

const MESSAGES: Record<MotifRefus, string> = {
  expiree: 'Ce code a expiré. Demandez-en un nouveau, c’est immédiat.',
  deja_utilisee: 'Ce code a déjà servi. Un nouveau code sera nécessaire.',
  trop_d_essais: 'Trop d’essais sur ce code. Repartez d’un code neuf.',
  code_incorrect: 'Ce code ne correspond pas. Vérifiez les caractères.',
};

/** Met un code sous la forme « ABCD-EFGH », plus facile à lire et à dicter. */
export function formaterCode(code: string): string {
  const propre = normaliserCode(code);
  return propre.length === LONGUEUR_CODE
    ? `${propre.slice(0, 4)}-${propre.slice(4)}`
    : propre;
}

/** Tolère minuscules, espaces et tirets : la saisie manuelle est faillible. */
export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Tire un code depuis des octets aléatoires fournis par l'appelant. */
export function codeDepuisAlea(octets: Uint8Array): string {
  if (octets.length < LONGUEUR_CODE) {
    throw new Error(`Au moins ${LONGUEUR_CODE} octets d’aléa attendus`);
  }
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    code += ALPHABET_CODE[octets[i]! % ALPHABET_CODE.length];
  }
  return code;
}

function deriver(code: string, sel: Uint8Array): Uint8Array {
  return pbkdf2(sha256, normaliserCode(code), sel, { c: ITERATIONS, dkLen: 32 });
}

export function creerInvitation(
  code: string,
  sel: Uint8Array,
  emisePar: PartenaireId,
  maintenant: string = new Date().toISOString(),
  dureeMinutes: number = DUREE_VIE_MINUTES,
): Invitation {
  return {
    verificateur: encoderBase64(deriver(code, sel)),
    sel: encoderBase64(sel),
    emisePar,
    emiseLe: maintenant,
    expireLe: new Date(Date.parse(maintenant) + dureeMinutes * 60_000).toISOString(),
    essais: 0,
  };
}

function memeEmpreinte(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export function verifierInvitation(
  invitation: Invitation,
  codeSaisi: string,
  maintenant: string = new Date().toISOString(),
): ResultatInvitation {
  const refus = (motif: MotifRefus, mise: Invitation = invitation) => ({
    ok: false,
    motif,
    message: MESSAGES[motif],
    invitation: mise,
  });

  if (invitation.consommeeLe) return refus('deja_utilisee');
  if (Date.parse(maintenant) > Date.parse(invitation.expireLe)) {
    return refus('expiree');
  }
  if (invitation.essais >= ESSAIS_MAX) return refus('trop_d_essais');

  const candidate = deriver(codeSaisi, decoderBase64(invitation.sel));
  if (!memeEmpreinte(candidate, decoderBase64(invitation.verificateur))) {
    return refus('code_incorrect', {
      ...invitation,
      essais: invitation.essais + 1,
    });
  }

  return {
    ok: true,
    invitation: { ...invitation, consommeeLe: maintenant },
  };
}

/** Secondes restantes avant expiration, pour l'affichage du compte à rebours. */
export function secondesAvantExpiration(
  invitation: Invitation,
  maintenant: string = new Date().toISOString(),
): number {
  return Math.max(
    0,
    Math.ceil((Date.parse(invitation.expireLe) - Date.parse(maintenant)) / 1000),
  );
}
