/**
 * Accès serveur au cycle.
 *
 * La réponse a **deux formes**, décidées par le serveur selon qui demande : la
 * personne concernée reçoit son cycle, l'autre reçoit la projection de
 * `vuePartenaire`. Le client ne filtre rien — il ne reçoit rien à filtrer.
 */
import type {
  EtatCycle,
  Intensite,
  NiveauCycle,
  Regles,
  Symptome,
  TypeSymptome,
  VuePartenaire,
} from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export interface VuePorteuse {
  role: 'porteuse';
  niveau: NiveauCycle;
  /** Durée annoncée par la personne concernée, si elle en a fixé une. */
  dureeDeclaree?: number;
  regles: Regles[];
  symptomes: Symptome[];
  etat?: EtatCycle;
}

export interface VueAutre {
  role: 'partenaire';
  vue: VuePartenaire;
}

export type VueCycleServeur = VuePorteuse | VueAutre;

export function lireCycle(coupleId: string): Promise<VueCycleServeur> {
  return appeler<VueCycleServeur>(`/couples/${coupleId}/cycle`);
}

export function declarerPorteuse(
  coupleId: string,
  porteuseId: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/porteuse`, {
    methode: 'PUT',
    corps: { porteuseId },
  });
}

export function definirNiveauServeur(
  coupleId: string,
  niveau: NiveauCycle,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/niveau`, {
    methode: 'PUT',
    corps: { niveau },
  });
}

/** `undefined` remet le calcul sur les cycles observés. */
export function definirDureeServeur(
  coupleId: string,
  duree: number | undefined,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/duree`, {
    methode: 'PUT',
    // `null` explicite : un champ absent serait une requête mal formée.
    corps: { duree: duree ?? null },
  });
}

export function enregistrerReglesServeur(
  coupleId: string,
  debutLe: string,
  finLe?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/regles`, {
    methode: 'POST',
    corps: { debutLe, finLe },
  });
}

export function supprimerReglesServeur(
  coupleId: string,
  id: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/regles/${id}`, { methode: 'DELETE' });
}

export function noterSymptomeServeur(
  coupleId: string,
  date: string,
  type: TypeSymptome,
  intensite: Intensite,
  note?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/symptomes`, {
    methode: 'POST',
    corps: { date, type, intensite, note },
  });
}

export function retirerSymptomeServeur(
  coupleId: string,
  id: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/cycle/symptomes/${id}`, {
    methode: 'DELETE',
  });
}
