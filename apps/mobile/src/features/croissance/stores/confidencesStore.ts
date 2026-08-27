/**
 * Pôle ② — Espace de confidences. **Modèle hybride, et c'est délibéré.**
 *
 * Contrairement aux axes et au cycle, le serveur n'est pas la seule source de
 * vérité ici : il l'est pour ce qui a été **envoyé**, mais les brouillons
 * restent entièrement locaux.
 *
 * Une lettre en cours d'écriture n'est pas une donnée du couple, c'est une
 * pensée en train de se former. La faire transiter « pour la sauvegarder » la
 * déposerait sur un serveur, dans des sauvegardes, dans des journaux — alors
 * qu'elle pourrait ne jamais être envoyée. Elle reste donc sur l'appareil,
 * chiffrée au repos par le coffre, jusqu'au geste d'envoi.
 *
 * L'envoi suit un ordre qui ne perd rien : **serveur d'abord, brouillon effacé
 * ensuite**. Si le réseau tombe au mauvais moment, le brouillon est toujours
 * là ; l'inverse aurait pu faire disparaître un texte sans l'avoir transmis.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nonLues, type Confidence, type TypeConfidence } from '@lonlonbenu/shared';
import { identifiant, stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  envoyerConfidence,
  listerConfidences,
  marquerLueServeur,
} from '../api/confidences.api';

/** Brouillon local. Il n'a volontairement aucun équivalent côté serveur. */
export interface Brouillon {
  id: string;
  titre?: string;
  texte: string;
  creeLe: string;
  majLe: string;
}

interface EtatConfidences {
  /** Envoyées, filtrées par le serveur. */
  confidences: Confidence[];
  /** Brouillons — locaux, jamais transmis. */
  brouillons: Brouillon[];

  cachePour?: string;
  synchroniseeLe?: string;
  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  offrirGratitude: (
    coupleId: string,
    moiId: string,
    texte: string,
  ) => Promise<boolean>;

  commencerLettre: (titre: string, texte: string) => string;
  modifierLettre: (id: string, titre: string, texte: string) => void;
  supprimerBrouillon: (id: string) => void;
  /** Le seul chemin par lequel une lettre quitte l'appareil. */
  envoyerLettre: (coupleId: string, moiId: string, id: string) => Promise<boolean>;

  marquerLue: (coupleId: string, moiId: string, id: string) => Promise<void>;
  vider: () => void;
}

export const useConfidences = create<EtatConfidences>()(
  persist(
    (set, get) => {
      const relire = async (coupleId: string, moiId: string) => {
        const confidences = await listerConfidences(coupleId);
        set({
          confidences,
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      const signaler = (erreur: unknown, messageHorsLigne: string) => {
        set({
          erreur:
            erreur instanceof ErreurApi && erreur.genre === 'hors_ligne'
              ? messageHorsLigne
              : messageLisible(erreur),
        });
      };

      return {
        confidences: [],
        brouillons: [],
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          if (get().cachePour && get().cachePour !== moiId) {
            // Les brouillons ne changent pas de main : ils appartiennent à
            // l'appareil, pas au compte affiché.
            set({ confidences: [], cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), confidences: [] });
            }
          } finally {
            set({ chargement: false });
          }
        },

        async offrirGratitude(coupleId, moiId, texte) {
          const propre = texte.trim();
          if (!propre) return false;

          set({ erreur: undefined });
          try {
            await envoyerConfidence(coupleId, 'gratitude', propre);
            await relire(coupleId, moiId);
            return true;
          } catch (erreur) {
            signaler(
              erreur,
              'Sans connexion, ce merci ne peut pas partir. Il est resté dans le champ.',
            );
            return false;
          }
        },

        commencerLettre(titre, texte) {
          const id = identifiant();
          const maintenant = new Date().toISOString();
          set((e) => ({
            brouillons: [
              {
                id,
                titre: titre.trim() || undefined,
                texte: texte.trim(),
                creeLe: maintenant,
                majLe: maintenant,
              },
              ...e.brouillons,
            ],
          }));
          return id;
        },

        modifierLettre(id, titre, texte) {
          set((e) => ({
            brouillons: e.brouillons.map((b) =>
              b.id === id
                ? {
                    ...b,
                    titre: titre.trim() || undefined,
                    texte: texte.trim(),
                    majLe: new Date().toISOString(),
                  }
                : b,
            ),
          }));
        },

        supprimerBrouillon(id) {
          set((e) => ({ brouillons: e.brouillons.filter((b) => b.id !== id) }));
        },

        async envoyerLettre(coupleId, moiId, id) {
          const brouillon = get().brouillons.find((b) => b.id === id);
          if (!brouillon || !brouillon.texte.trim()) return false;

          set({ erreur: undefined });
          try {
            await envoyerConfidence(
              coupleId,
              'lettre',
              brouillon.texte,
              brouillon.titre,
            );
            // Le brouillon ne disparaît qu'une fois l'envoi confirmé.
            set((e) => ({ brouillons: e.brouillons.filter((b) => b.id !== id) }));
            await relire(coupleId, moiId);
            return true;
          } catch (erreur) {
            signaler(
              erreur,
              'Sans connexion, la lettre ne peut pas partir. Elle reste dans vos brouillons.',
            );
            return false;
          }
        },

        async marquerLue(coupleId, moiId, id) {
          try {
            await marquerLueServeur(coupleId, id);
            await relire(coupleId, moiId);
          } catch {
            // Un accusé de lecture qui n'arrive pas n'est pas une erreur à
            // afficher : il repartira à la prochaine ouverture.
          }
        },

        vider: () =>
          set({
            confidences: [],
            // Les brouillons partent aussi : après une dissociation, il ne doit
            // rien rester, pas même ce qui n'a jamais été envoyé.
            brouillons: [],
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.confidences',
      storage: stockage,
      partialize: (e) => ({
        confidences: e.confidences,
        brouillons: e.brouillons,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);

export function useConfidencesParType(type: TypeConfidence): Confidence[] {
  return useConfidences((e) => e.confidences.filter((c) => c.type === type));
}

export function useConfidencesNonLues(lecteurId: string): number {
  return useConfidences((e) => nonLues(e.confidences, lecteurId).length);
}
