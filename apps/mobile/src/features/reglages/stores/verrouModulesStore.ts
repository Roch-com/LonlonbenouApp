/**
 * Pôle ⑥ — verrou renforcé, indépendant, sur les modules les plus intimes
 * (§8.20 du cahier : espace de confidences et Carte & Présence).
 *
 * ## Indépendant de quoi, exactement
 *
 * Du verrou d'application, pas du secret. On peut protéger les confidences
 * sans verrouiller toute l'app, et l'inverse ; les deux se règlent séparément.
 * En revanche le code est le même : inventer un second secret obligerait à en
 * retenir deux, et un code qu'on oublie sur un module qu'on ouvre une fois par
 * mois est un piège, pas une protection.
 *
 * ## Ce qui le distingue du verrou d'application
 *
 * Il se referme **dès que l'app passe en arrière-plan**, sans délai de grâce.
 * Le verrou général en accorde trente secondes, parce qu'on jongle entre les
 * apps toute la journée ; ici on protège précisément ce qu'on ne veut pas voir
 * rester ouvert quand on tend son téléphone à quelqu'un.
 *
 * `ouverts` n'est donc jamais persisté : au lancement, tout est refermé.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as LocalAuthentication from 'expo-local-authentication';
import { etatDurcissement, verifierPinAsync } from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { lireVerificateur } from '../services/secretVerrou';
import type { ResultatTentative } from './verrouStore';

export type ModuleVerrouillable = 'confidences' | 'presence';

export const LIBELLES_VERROU: Record<
  ModuleVerrouillable,
  { titre: string; detail: string }
> = {
  confidences: {
    titre: 'Espace de confidences',
    detail: 'Gratitudes et lettres : redemander le code avant de les ouvrir.',
  },
  presence: {
    titre: 'Carte & Présence',
    detail: 'Statuts, check-ins et position : redemander le code avant d’y entrer.',
  },
};

interface EtatVerrouModules {
  proteges: ModuleVerrouillable[];
  echecs: number;
  dernierEchecLe?: string;

  /** Non persisté : tout se referme au lancement et en arrière-plan. */
  ouverts: ModuleVerrouillable[];

  estProtege: (module: ModuleVerrouillable) => boolean;
  basculerProtection: (module: ModuleVerrouillable, actif: boolean) => void;
  ouvrirParBiometrie: (module: ModuleVerrouillable) => Promise<boolean>;
  ouvrirParPin: (
    module: ModuleVerrouillable,
    pin: string,
  ) => Promise<ResultatTentative>;
  toutRefermer: () => void;
}

export const useVerrouModules = create<EtatVerrouModules>()(
  persist(
    (set, get) => {
      const ouvrir = (module: ModuleVerrouillable) =>
        set((e) => ({
          ouverts: e.ouverts.includes(module) ? e.ouverts : [...e.ouverts, module],
          echecs: 0,
          dernierEchecLe: undefined,
        }));

      return {
        proteges: [],
        echecs: 0,
        ouverts: [],

        estProtege: (module) => get().proteges.includes(module),

        basculerProtection: (module, actif) =>
          set((e) => ({
            proteges: actif
              ? e.proteges.includes(module)
                ? e.proteges
                : [...e.proteges, module]
              : e.proteges.filter((m) => m !== module),
            // Retirer la protection ouvre l'accès tout de suite : redemander
            // un code juste après avoir dit qu'on n'en veut plus serait absurde.
            ouverts: actif
              ? e.ouverts.filter((m) => m !== module)
              : [...new Set([...e.ouverts, module])],
          })),

        ouvrirParBiometrie: async (module) => {
          const disponible =
            (await LocalAuthentication.hasHardwareAsync()) &&
            (await LocalAuthentication.isEnrolledAsync());
          if (!disponible) return false;

          const resultat = await LocalAuthentication.authenticateAsync({
            promptMessage: LIBELLES_VERROU[module].titre,
            fallbackLabel: 'Utiliser mon code',
            cancelLabel: 'Annuler',
          });
          if (resultat.success) ouvrir(module);
          return resultat.success;
        },

        ouvrirParPin: async (module, pin) => {
          const { echecs, dernierEchecLe } = get();
          const durcissement = etatDurcissement(echecs, dernierEchecLe);
          if (durcissement.bloque) {
            return {
              ok: false,
              secondesRestantes: durcissement.secondesRestantes,
              message: `Encore ${durcissement.secondesRestantes} s avant un nouvel essai.`,
            };
          }

          const verificateur = await lireVerificateur();
          if (!verificateur) {
            // Aucun code n'existe sur cet appareil : le verrou n'a plus de
            // secret pour se tenir. On ouvre plutôt que d'enfermer dehors.
            ouvrir(module);
            return { ok: true };
          }

          if (await verifierPinAsync(pin, verificateur)) {
            ouvrir(module);
            return { ok: true };
          }

          const nouveaux = echecs + 1;
          set({ echecs: nouveaux, dernierEchecLe: new Date().toISOString() });
          const suivant = etatDurcissement(nouveaux, new Date().toISOString());
          return {
            ok: false,
            secondesRestantes: suivant.secondesRestantes,
            message: suivant.bloque
              ? `Ce code ne correspond pas. Nouvel essai dans ${suivant.secondesRestantes} s.`
              : 'Ce code ne correspond pas.',
          };
        },

        toutRefermer: () => set({ ouverts: [] }),
      };
    },
    {
      name: 'lonlonbenu.verrouModules',
      storage: stockage,
      // `ouverts` reste dehors : un module ouvert ne doit jamais survivre à
      // la fermeture de l'application.
      partialize: ({ proteges, echecs, dernierEchecLe }) => ({
        proteges,
        echecs,
        dernierEchecLe,
      }),
    },
  ),
);

/** Vrai quand le module peut s'afficher : non protégé, ou déjà ouvert. */
export function useModuleAccessible(module: ModuleVerrouillable): boolean {
  return useVerrouModules(
    (e) => !e.proteges.includes(module) || e.ouverts.includes(module),
  );
}
