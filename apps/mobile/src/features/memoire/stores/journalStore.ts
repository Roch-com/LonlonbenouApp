/**
 * Pôle ⑤ — Journal du couple (§8.17).
 *
 * Le serveur compose la moitié qu’il peut lire — projets, progrès, sorties,
 * parcours, anniversaires. Les souvenirs sont scellés : il n’en connaît que la
 * date, et c’est ici qu’ils rejoignent la frise, une fois ouverts.
 *
 * Les deux moitiés se rangent avec `trierJournal`, la même fonction des deux
 * côtés — sinon l’ordre dépendrait de qui a composé quoi.
 *
 * Rien n’est persisté : la frise se recompose à chaque ouverture, à partir de
 * ce qui existe encore.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import {
  construireJournal,
  grouperParAnnee,
  trierJournal,
  type AnneeJournal,
  type EntreeJournal,
  type Souvenir,
} from '@lonlonbenu/shared';
import { messageLisible } from '@/lib/api/erreurs';
import { appeler } from '@/lib/api/client';

interface EtatJournal {
  /** Ce que le serveur a pu composer. */
  duServeur: EntreeJournal[];
  chargement: boolean;
  erreur?: string;

  charger: (coupleId: string) => Promise<void>;
  vider: () => void;
}

export const useJournal = create<EtatJournal>()((set) => ({
  duServeur: [],
  chargement: false,

  async charger(coupleId) {
    set({ chargement: true, erreur: undefined });
    try {
      const reponse = await appeler<{ entrees: EntreeJournal[] }>(
        `/couples/${coupleId}/journal`,
      );
      set({ duServeur: reponse.entrees });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  vider: () => set({ duServeur: [], erreur: undefined }),
}));

/**
 * La frise complète, groupée par année.
 *
 * `souvenirs` arrive déjà déchiffré de `useSouvenirsLisibles` : le clair ne
 * traverse jamais le réseau, il n’existe que le temps du rendu.
 */
export function useFriseComplete(
  souvenirs: readonly Souvenir[],
  jusquA: string,
): AnneeJournal[] {
  const duServeur = useJournal((e) => e.duServeur);

  return useMemo(
    () =>
      grouperParAnnee(
        trierJournal([
          ...duServeur,
          ...construireJournal({ souvenirs }, jusquA),
        ]),
      ),
    [duServeur, souvenirs, jusquA],
  );
}
