/**
 * Pôle ④ — Cycle & fertilité. **Le serveur fait autorité.**
 *
 * Le store ne calcule plus rien et ne filtre plus rien : il range la réponse
 * du serveur telle quelle. `vuePartenaire` est exécuté côté serveur, si bien
 * que la vue du partenaire ne contient ni date, ni symptôme, ni jour de cycle —
 * pas même en mémoire sur son téléphone.
 *
 * Le cache persisté suit la même règle que celui des axes : **cache
 * d'affichage, jamais source de vérité**, marqué au nom de la personne pour
 * laquelle il a été mis en forme, et jeté à la moindre différence. Aucune
 * écriture hors ligne : une saisie de règles partie on ne sait quand fausserait
 * les prévisions sans qu'on sache pourquoi.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Intensite, NiveauCycle, TypeSymptome } from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  declarerPorteuse,
  definirNiveauServeur,
  enregistrerReglesServeur,
  lireCycle,
  noterSymptomeServeur,
  retirerSymptomeServeur,
  supprimerReglesServeur,
  type VueCycleServeur,
} from '../api/cycle.api';

interface EtatCycleStore {
  vue?: VueCycleServeur;
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  declarer: (
    coupleId: string,
    moiId: string,
    porteuseId: string,
  ) => Promise<boolean>;
  definirNiveau: (
    coupleId: string,
    moiId: string,
    niveau: NiveauCycle,
  ) => Promise<boolean>;
  enregistrerRegles: (
    coupleId: string,
    moiId: string,
    debutLe: string,
    finLe?: string,
  ) => Promise<boolean>;
  supprimerRegles: (
    coupleId: string,
    moiId: string,
    id: string,
  ) => Promise<boolean>;
  noterSymptome: (
    coupleId: string,
    moiId: string,
    date: string,
    type: TypeSymptome,
    intensite: Intensite,
    note?: string,
  ) => Promise<boolean>;
  retirerSymptome: (
    coupleId: string,
    moiId: string,
    id: string,
  ) => Promise<boolean>;
  vider: () => void;
}

export const useCycle = create<EtatCycleStore>()(
  persist(
    (set, get) => {
      /** Toute lecture passe par le serveur ; le cache ne sert qu'au repli. */
      const relire = async (coupleId: string, moiId: string) => {
        const vue = await lireCycle(coupleId);
        set({
          vue,
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      /** Écriture puis relecture : l'état affiché vient toujours du serveur. */
      const ecrire = async (
        coupleId: string,
        moiId: string,
        operation: () => Promise<unknown>,
      ) => {
        set({ erreur: undefined });
        try {
          await operation();
          await relire(coupleId, moiId);
          return true;
        } catch (erreur) {
          set({
            erreur:
              erreur instanceof ErreurApi && erreur.genre === 'hors_ligne'
                ? 'Sans connexion, rien ne peut être enregistré. Votre saisie est restée dans le champ.'
                : messageLisible(erreur),
          });
          return false;
        }
      };

      return {
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          // Un cache mis en forme pour quelqu'un d'autre n'a rien à faire ici :
          // celui du partenaire et celui de la personne concernée n'ont pas du
          // tout le même contenu.
          if (get().cachePour && get().cachePour !== moiId) {
            set({ vue: undefined, cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), vue: undefined });
            }
          } finally {
            set({ chargement: false });
          }
        },

        declarer: (coupleId, moiId, porteuseId) =>
          ecrire(coupleId, moiId, () => declarerPorteuse(coupleId, porteuseId)),

        definirNiveau: (coupleId, moiId, niveau) =>
          ecrire(coupleId, moiId, () => definirNiveauServeur(coupleId, niveau)),

        enregistrerRegles: (coupleId, moiId, debutLe, finLe) =>
          ecrire(coupleId, moiId, () =>
            enregistrerReglesServeur(coupleId, debutLe, finLe),
          ),

        supprimerRegles: (coupleId, moiId, id) =>
          ecrire(coupleId, moiId, () => supprimerReglesServeur(coupleId, id)),

        noterSymptome: (coupleId, moiId, date, type, intensite, note) =>
          ecrire(coupleId, moiId, () =>
            noterSymptomeServeur(coupleId, date, type, intensite, note),
          ),

        retirerSymptome: (coupleId, moiId, id) =>
          ecrire(coupleId, moiId, () => retirerSymptomeServeur(coupleId, id)),

        vider: () =>
          set({
            vue: undefined,
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.cycle',
      storage: stockage,
      partialize: (e) => ({
        vue: e.vue,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);
