import type { ActiviteVisible } from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export interface VueActiviteServeur {
  moi: { partage: boolean };
  /** Absent tant que le partage n'est pas actif des deux côtés. */
  autre?: ActiviteVisible;
}

/**
 * Signale sa présence **et** relit celle de l'autre, en un aller-retour.
 *
 * Deux requêtes toutes les vingt secondes pour afficher une ligne de
 * sous-titre seraient un mauvais compte : le serveur répond avec l'état à
 * jour, celui de l'appelant inclus.
 */
export function battre(
  coupleId: string,
  ecrit: boolean,
): Promise<VueActiviteServeur> {
  return appeler<VueActiviteServeur>(`/couples/${coupleId}/activite`, {
    methode: 'POST',
    corps: { ecrit },
  });
}

/** Lecture seule, sans se signaler. */
export function lireActivite(coupleId: string): Promise<VueActiviteServeur> {
  return appeler<VueActiviteServeur>(`/couples/${coupleId}/activite`);
}
