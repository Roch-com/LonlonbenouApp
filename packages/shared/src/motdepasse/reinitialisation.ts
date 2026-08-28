/**
 * Réinitialisation de mot de passe — les invariants, sans dépendance.
 *
 * Le mécanisme du code à usage unique est **repris de l'appairage**
 * (`onboarding/invitation.ts`) : même alphabet sans caractères ambigus, même
 * mise en forme, même plafond d'essais. Ce sont les mêmes contraintes — un code
 * recopié à la main depuis un écran, une fenêtre courte, une recherche
 * exhaustive à décourager — et les dupliquer aurait créé deux vérités sur la
 * même question, qui auraient fini par diverger.
 *
 * Ce qui est propre à la réinitialisation vit ici : la durée de validité, plus
 * longue que pour un appairage, et le sort d'une demande.
 */
import {
  ESSAIS_MAX,
  codeDepuisAlea,
  formaterCode,
  normaliserCode,
} from '../onboarding/invitation';

export { codeDepuisAlea, formaterCode, normaliserCode };

/**
 * Trente minutes, contre quinze pour un appairage.
 *
 * L'appairage se fait à deux, dans la même pièce, en se lisant le code à voix
 * haute. Une réinitialisation se fait seule : il faut ouvrir sa boîte de
 * réception, parfois sur un autre appareil, parfois attendre que le courriel
 * arrive. Quinze minutes mettraient sous pression quelqu'un qui est déjà
 * contrarié d'avoir oublié son mot de passe.
 */
export const VALIDITE_MINUTES = 30;

export const ESSAIS_MAX_REINITIALISATION = ESSAIS_MAX;

export interface DemandeReinitialisation {
  /** Empreinte du code. Le code lui-même n'est jamais conservé. */
  empreinte: string;
  compteId: string;
  demandeeLe: string;
  expireLe: string;
  utiliseeLe?: string;
  /** Tentatives infructueuses déjà faites sur cette demande. */
  essais: number;
}

export type MotifRefusReinitialisation =
  'introuvable' | 'expiree' | 'deja_utilisee' | 'trop_d_essais' | 'code_incorrect';

export function expirationReinitialisation(demandeeLe: string): string {
  return new Date(Date.parse(demandeeLe) + VALIDITE_MINUTES * 60_000).toISOString();
}

/**
 * Décide du sort d'une tentative. Ne compare aucun code : la comparaison
 * appartient à l'appelant, qui doit la faire à temps constant sur l'empreinte.
 */
export function verifierLaDemande(
  demande: DemandeReinitialisation | undefined,
  codeCorrespond: boolean,
  maintenant: Date = new Date(),
): { ok: true } | { ok: false; motif: MotifRefusReinitialisation } {
  if (!demande) return { ok: false, motif: 'introuvable' };
  if (demande.utiliseeLe) return { ok: false, motif: 'deja_utilisee' };
  if (demande.essais >= ESSAIS_MAX) return { ok: false, motif: 'trop_d_essais' };
  if (Date.parse(demande.expireLe) <= maintenant.getTime()) {
    return { ok: false, motif: 'expiree' };
  }
  if (!codeCorrespond) return { ok: false, motif: 'code_incorrect' };
  return { ok: true };
}

/** Longueur minimale d'un mot de passe, alignée sur la création de compte. */
export const LONGUEUR_MOT_DE_PASSE_MIN = 10;

export function motDePasseAcceptable(motDePasse: string): boolean {
  return motDePasse.length >= LONGUEUR_MOT_DE_PASSE_MIN;
}
