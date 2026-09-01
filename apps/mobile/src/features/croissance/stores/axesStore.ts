/**
 * Pôle ② — Axes de croissance. **Le serveur fait autorité.**
 *
 * Ce store ne contient plus de logique de miroir : il reçoit des `AxeVisible`
 * déjà filtrés par le serveur. `axeVisiblePar` n'est plus appelé ici, et c'est
 * le progrès — un filtrage client supposait que la contribution de l'autre
 * avait transité, donc qu'elle était lisible dans la réponse HTTP.
 *
 * Le contenu persisté est un **cache d'affichage hors ligne**, pas une source
 * de vérité : aucune écriture ne s'y fait sans passer par le serveur. Il n'y a
 * volontairement pas de file d'écritures différées — une contribution déposée
 * hors ligne partirait sans qu'on sache quand, et le partenaire découvrirait
 * une réponse à une conversation qu'il croyait close. Mieux vaut refuser
 * franchement l'écriture que la promettre.
 *
 * Le cache est marqué au nom du partenaire pour lequel il a été filtré : à la
 * moindre différence, il est jeté plutôt que montré à quelqu'un d'autre.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AxeVisible,
  NiveauImportance,
  ThemeAxe,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  cloturerServeur,
  contribuerServeur,
  listerAxes,
  ouvrirAxeServeur,
  reconnaitreProgresServeur,
} from '../api/axes.api';

interface EtatAxes {
  axes: AxeVisible[];
  /** Partenaire pour lequel le cache a été filtré. */
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  /** Vrai quand l'affichage vient du cache faute de réseau. */
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  ouvrirAxe: (
    coupleId: string,
    theme: ThemeAxe,
    titre: string,
    importance?: NiveauImportance,
  ) => Promise<boolean>;
  reconnaitreProgres: (coupleId: string, axeId: string) => Promise<boolean>;
  contribuer: (
    coupleId: string,
    axeId: string,
    ressenti: string,
    besoin: string,
  ) => Promise<boolean>;
  cloturer: (coupleId: string, axeId: string, cloture: boolean) => Promise<boolean>;
  vider: () => void;
}

export const useAxes = create<EtatAxes>()(
  persist(
    (set, get) => {
      /** Remplace un axe par la version que le serveur vient de rendre. */
      const fusionner = (axe: AxeVisible) =>
        set((e) => ({
          axes: e.axes.some((a) => a.id === axe.id)
            ? e.axes.map((a) => (a.id === axe.id ? axe : a))
            : [axe, ...e.axes],
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        }));

      /** Toute écriture suit le même chemin : serveur d'abord, état ensuite. */
      const ecrire = async (operation: () => Promise<AxeVisible>) => {
        set({ erreur: undefined });
        try {
          fusionner(await operation());
          return true;
        } catch (erreur) {
          set({
            erreur:
              erreur instanceof ErreurApi && erreur.genre === 'hors_ligne'
                ? 'Sans connexion, rien ne peut être déposé. Ce que vous avez écrit est resté dans le champ.'
                : messageLisible(erreur),
          });
          return false;
        }
      };

      return {
        axes: [],
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          // Un cache filtré pour quelqu'un d'autre n'a rien à faire ici.
          if (get().cachePour && get().cachePour !== moiId) {
            set({ axes: [], cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            const axes = await listerAxes(coupleId);
            set({
              axes,
              cachePour: moiId,
              synchroniseeLe: new Date().toISOString(),
              horsLigne: false,
            });
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              // On garde le cache et on le dit, plutôt que d'afficher un vide
              // qui laisserait croire qu'il n'y a rien.
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), axes: [] });
            }
          } finally {
            set({ chargement: false });
          }
        },

        ouvrirAxe: (coupleId, theme, titre, importance) =>
          ecrire(() => ouvrirAxeServeur(coupleId, theme, titre, importance)),

        reconnaitreProgres: (coupleId, axeId) =>
          ecrire(() => reconnaitreProgresServeur(coupleId, axeId)),

        contribuer: (coupleId, axeId, ressenti, besoin) =>
          ecrire(() => contribuerServeur(coupleId, axeId, ressenti, besoin)),

        cloturer: (coupleId, axeId, cloture) =>
          ecrire(() => cloturerServeur(coupleId, axeId, cloture)),

        vider: () =>
          set({
            axes: [],
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.axes',
      storage: stockage,
      // Ni `chargement`, ni `erreur`, ni `horsLigne` : ce sont des états
      // d'instant, pas des données.
      partialize: (e) => ({
        axes: e.axes,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);
