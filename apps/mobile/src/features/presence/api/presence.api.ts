/**
 * Accès serveur à la présence.
 *
 * Les codes de statut et d'humeur circulent en clair — ce sont des valeurs d'un
 * ensemble fermé, les chiffrer ne cacherait rien à un serveur qui connaît la
 * liste. **Tout texte libre écrit par la personne est scellé** avant de partir :
 * note de statut, mot d'humeur, lieu de check-in, message de SOS.
 */
import { appeler } from '@/lib/api/client';

export interface StatutServeur {
  partenaireId: string;
  code: string;
  noteScellee?: string;
  majLe: string;
  humeurCode?: string;
  motHumeurScelle?: string;
  humeurMajLe?: string;
}

export interface CheckInServeur {
  id: string;
  partenaireId: string;
  lieuScelle: string;
  motScelle?: string;
  faitLe: string;
}

export interface AlerteServeur {
  id: string;
  partenaireId: string;
  lieuScelle?: string;
  messageScelle?: string;
  etat: 'actif' | 'resolu';
  emiseLe: string;
  vueLe?: string;
  resolueLe?: string;
}

export interface VuePresenceServeur {
  mien?: StatutServeur;
  autre?: StatutServeur;
  partageActif: boolean;
  checkIns: CheckInServeur[];
  alertes: AlerteServeur[];
}

export function lirePresence(coupleId: string): Promise<VuePresenceServeur> {
  return appeler<VuePresenceServeur>(`/couples/${coupleId}/presence`);
}

export function definirStatutServeur(
  coupleId: string,
  code: string,
  noteScellee?: string,
): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/presence/statut`, {
    methode: 'PUT',
    corps: { code, noteScellee },
  });
}

export function definirHumeurServeur(
  coupleId: string,
  code: string,
  motScelle?: string,
): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/presence/humeur`, {
    methode: 'PUT',
    corps: { code, motScelle },
  });
}

export function faireUnCheckInServeur(
  coupleId: string,
  lieuScelle: string,
  motScelle?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/presence/check-ins`, {
    methode: 'POST',
    corps: { lieuScelle, motScelle },
  });
}

export function declencherSosServeur(
  coupleId: string,
  lieuScelle?: string,
  messageScelle?: string,
): Promise<{ alerte: AlerteServeur }> {
  return appeler<{ alerte: AlerteServeur }>(`/couples/${coupleId}/presence/sos`, {
    methode: 'POST',
    corps: { lieuScelle, messageScelle },
  });
}

export function changerEtatAlerteServeur(
  coupleId: string,
  id: string,
  action: 'vue' | 'resolue',
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/presence/sos/${id}`, {
    methode: 'PUT',
    corps: { action },
  });
}
