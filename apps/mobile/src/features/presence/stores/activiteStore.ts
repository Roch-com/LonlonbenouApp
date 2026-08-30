/**
 * Pôle ① — « en ligne », « vu il y a… », « écrit… ».
 *
 * **Rien n'est persisté.** Une présence relue sur disque affirmerait « en
 * ligne » à propos de quelqu'un parti depuis des heures : le seul état juste
 * est celui que le serveur vient de donner. Hors ligne, on ne sait pas, et on
 * ne dit rien.
 *
 * Le battement est émis par l'écran de conversation, pas par le store : c'est
 * lui qui sait s'il est visible, et signaler sa présence depuis un écran que
 * personne ne regarde serait faux.
 */
import { create } from 'zustand';
import type { ActiviteVisible } from '@lonlonbenu/shared';
import { battre, lireActivite } from '../api/activite.api';

interface EtatActivite {
  /** Ce que l'autre montre, quand la réciprocité le permet. */
  autre?: ActiviteVisible;
  /** Vrai quand le partage est actif des deux côtés. */
  partage: boolean;
  /** Vrai une fois la première réponse reçue : avant, on n'affiche rien. */
  connu: boolean;

  battre: (coupleId: string, ecrit: boolean) => Promise<void>;
  relire: (coupleId: string) => Promise<void>;
  vider: () => void;
}

export const useActivite = create<EtatActivite>()((set) => {
  const ranger = (vue: { moi: { partage: boolean }; autre?: ActiviteVisible }) =>
    set({ autre: vue.autre, partage: vue.moi.partage, connu: true });

  return {
    partage: false,
    connu: false,

    async battre(coupleId, ecrit) {
      try {
        ranger(await battre(coupleId, ecrit));
      } catch {
        // Un battement manqué n'est pas une erreur à montrer : le seuil « en
        // ligne » tolère deux battements perdus, et afficher un bandeau
        // d'échec pour un sous-titre serait hors de proportion.
      }
    },

    async relire(coupleId) {
      try {
        ranger(await lireActivite(coupleId));
      } catch {
        // Idem.
      }
    },

    vider: () => set({ autre: undefined, partage: false, connu: false }),
  };
});
