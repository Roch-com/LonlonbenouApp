/**
 * Consentements réciproques — **le serveur fait autorité**.
 *
 * Il existait deux systèmes en parallèle : celui-ci, et une copie locale dans
 * `sessionStore`. Seule la croissance avait été migrée ; la position et le
 * score étaient restés sur la copie locale. Chaque téléphone y notait donc son
 * propre consentement et ignorait celui de l'autre : les deux partenaires
 * pouvaient activer un partage et lire chacun « en attente de l'autre ». Ce
 * n'était pas une désynchronisation, c'était l'absence de toute synchronisation.
 *
 * Un store partagé plutôt qu'un `useState` par composant : le même
 * consentement s'affiche dans « Notre espace » et dans la section du score, et
 * basculer à un endroit doit se voir à l'autre sans recharger l'écran.
 *
 * **Rien n'est persisté.** Un consentement lu sur disque pourrait affirmer
 * qu'un partage est actif alors que l'autre vient de le suspendre — c'est
 * précisément la situation que le garde-fou n°3 interdit. Hors ligne, on ne
 * sait pas : on montre l'attente, jamais un état supposé.
 */
import { create } from 'zustand';
import type { ModuleSensible } from '@lonlonbenu/shared';
import { messageLisible } from '@/lib/api/erreurs';
import {
  basculerPartageServeur,
  listerPartages,
  type EtatPartageServeur,
} from '../api/partages.api';

interface EtatStore {
  parModule: Record<string, EtatPartageServeur>;
  /** Couple pour lequel `parModule` a été rempli. */
  chargePour?: string;
  chargement: boolean;
  erreur?: string;

  charger: (coupleId: string) => Promise<void>;
  basculer: (
    coupleId: string,
    module: ModuleSensible,
    actif: boolean,
  ) => Promise<boolean>;
  vider: () => void;
}

export const usePartagesServeur = create<EtatStore>()((set, get) => ({
  parModule: {},
  chargement: false,

  async charger(coupleId) {
    // Le cache d'un autre couple n'a rien à faire ici : après une dissociation
    // puis un nouvel appairage, il affirmerait des consentements d'avant.
    if (get().chargePour && get().chargePour !== coupleId) {
      set({ parModule: {}, chargePour: coupleId });
    }

    set({ chargement: true, erreur: undefined });
    try {
      const partages = await listerPartages(coupleId);
      set({
        parModule: Object.fromEntries(partages.map((p) => [p.module, p])),
        chargePour: coupleId,
        erreur: undefined,
      });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  async basculer(coupleId, module, actif) {
    set({ erreur: undefined });
    try {
      const misAJour = await basculerPartageServeur(coupleId, module, actif);
      set((e) => ({
        parModule: { ...e.parModule, [module]: misAJour },
        chargePour: coupleId,
      }));
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    }
  },

  vider: () => set({ parModule: {}, chargePour: undefined, erreur: undefined }),
}));

/** État complet d'un module, ou `undefined` tant que le serveur n'a pas répondu. */
export function usePartageServeur(
  module: ModuleSensible,
): EtatPartageServeur | undefined {
  return usePartagesServeur((e) => e.parModule[module]);
}

/**
 * Vrai seulement si les deux ont consenti, d'après le serveur.
 *
 * Faux par défaut, y compris pendant le chargement : une porte de consentement
 * doit être fermée tant qu'on ne sait pas, jamais ouverte par optimisme.
 */
export function usePartageServeurActif(module: ModuleSensible): boolean {
  return usePartagesServeur((e) => e.parModule[module]?.actif ?? false);
}
