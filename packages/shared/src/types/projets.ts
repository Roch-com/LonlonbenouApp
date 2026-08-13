/** Pôle ③ — Projets de couple (P0 : création, jalons, avancement). */

import type { PartenaireId } from './couple';

export interface Jalon {
  id: string;
  titre: string;
  /** `YYYY-MM-DD`. */
  echeance?: string;
  faitLe?: string;
  /**
   * Qui a coché. Conservé pour l'affichage d'un jalon précis — **jamais
   * agrégé** : voir la note de `avancement.ts` sur l'absence de décompte par
   * personne.
   */
  faitPar?: PartenaireId;
}

export interface Projet {
  id: string;
  titre: string;
  /** Le « pourquoi » du projet, qui aide à s'y remettre des mois plus tard. */
  intention?: string;
  jalons: readonly Jalon[];
  echeance?: string;
  creePar: PartenaireId;
  creeLe: string;
  archiveLe?: string;
}

export const PROJETS_SUGGERES: readonly { titre: string; intention: string }[] = [
  {
    titre: 'Partir quelque part tous les deux',
    intention: 'Se retrouver ailleurs que dans le quotidien.',
  },
  {
    titre: 'Réaménager un coin de la maison',
    intention: 'Se sentir mieux là où on vit.',
  },
  {
    titre: 'Mettre de l’argent de côté',
    intention: 'Avancer plus sereinement.',
  },
  {
    titre: 'Recevoir nos proches',
    intention: 'Ouvrir notre porte plus souvent.',
  },
] as const;
