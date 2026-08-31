/**
 * Pôle ⑤ — Souvenirs et Love Map. **Le serveur fait autorité.**
 *
 * Le contenu est scellé avec la clé du couple, comme le chat et les
 * confidences. Un seul canal chiffré pour les deux mêmes personnes : ouvrir
 * une seconde paire de clés doublerait la surface à protéger sans rien
 * apporter.
 *
 * Le cache persisté ne détient que du scellé — c'est la réponse du serveur,
 * rangée telle quelle. Le clair n'existe qu'à l'ouverture, le temps du rendu.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import {
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
  trierSouvenirs,
  type ContenuSouvenir,
  type SorteSouvenir,
  type Souvenir,
  type SouvenirScelle,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '@/features/presence/services/clesMessages';
import { useChat } from '@/features/presence/stores/chatStore';
import {
  ajouterSouvenirServeur,
  listerSouvenirs,
  supprimerSouvenirServeur,
} from '../api/souvenirs.api';

const MESSAGE_SANS_CLE =
  'Ouvrez la conversation une fois sur chacun de vos téléphones : vos clés de chiffrement s’y échangent, et elles protègent aussi vos souvenirs.';

async function cleDuCouple(): Promise<Uint8Array | undefined> {
  const clePubliqueAutre = useChat.getState().cles?.autre;
  if (!clePubliqueAutre) return undefined;
  return cleDeMessages(clePubliqueAutre);
}

interface EtatSouvenirs {
  /** Cache : enveloppes scellées, jamais de clair. */
  scelles: SouvenirScelle[];
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  ajouter: (
    coupleId: string,
    moiId: string,
    sorte: SorteSouvenir,
    jour: string,
    contenu: ContenuSouvenir,
  ) => Promise<boolean>;
  supprimer: (coupleId: string, moiId: string, id: string) => Promise<boolean>;
  vider: () => void;
}

export const useSouvenirs = create<EtatSouvenirs>()(
  persist(
    (set, get) => {
      const relire = async (coupleId: string, moiId: string) => {
        set({
          scelles: await listerSouvenirs(coupleId),
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      return {
        scelles: [],
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          if (get().cachePour && get().cachePour !== moiId) {
            set({ scelles: [], cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), scelles: [] });
            }
          } finally {
            set({ chargement: false });
          }
        },

        async ajouter(coupleId, moiId, sorte, jour, contenu) {
          set({ erreur: undefined });
          const cle = await cleDuCouple();
          if (!cle) {
            set({ erreur: MESSAGE_SANS_CLE });
            return false;
          }

          try {
            const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
            await ajouterSouvenirServeur(
              coupleId,
              sorte,
              jour,
              scellerMessage(cle, nonce, JSON.stringify(contenu)),
            );
            await relire(coupleId, moiId);
            return true;
          } catch (erreur) {
            set({
              erreur:
                erreur instanceof ErreurApi && erreur.genre === 'hors_ligne'
                  ? 'Sans connexion, ce souvenir ne peut pas être enregistré. Votre saisie est restée dans le champ.'
                  : messageLisible(erreur),
            });
            return false;
          }
        },

        async supprimer(coupleId, moiId, id) {
          set({ erreur: undefined });
          try {
            await supprimerSouvenirServeur(coupleId, id);
            await relire(coupleId, moiId);
            return true;
          } catch (erreur) {
            set({ erreur: messageLisible(erreur) });
            return false;
          }
        },

        vider: () =>
          set({
            scelles: [],
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.souvenirs',
      storage: stockage,
      partialize: (e) => ({
        scelles: e.scelles,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);

/**
 * Souvenirs ouverts, prêts à afficher.
 *
 * Ceux qu'on ne sait plus ouvrir — chiffrés avec des clés disparues lors d'une
 * réinstallation — sont écartés plutôt qu'affichés vides : un album ne gagne
 * rien à montrer des cases muettes, là où une conversation doit garder la
 * trace des messages qu'elle a portés.
 */
export function useSouvenirsLisibles(): Souvenir[] {
  const scelles = useSouvenirs((e) => e.scelles);
  const cle = useCleDuCouple();

  return useMemo(() => {
    if (!cle) return [];
    return trierSouvenirs(scelles)
      .map(({ contenuScelle, ...reste }) => {
        try {
          // L'enveloppe est écartée du résultat : une fois ouverte, elle n'a
          // plus rien à faire dans ce que les écrans manipulent.
          return {
            ...reste,
            contenu: JSON.parse(
              ouvrirMessage(cle, contenuScelle),
            ) as ContenuSouvenir,
          };
        } catch {
          return undefined;
        }
      })
      .filter((s): s is Souvenir => !!s);
  }, [scelles, cle]);
}

/** Dérive la clé du couple une fois, puis la garde en mémoire. */
function useCleDuCouple(): Uint8Array | undefined {
  const clePubliqueAutre = useChat((e) => e.cles?.autre);
  const [cle, setCle] = useState<Uint8Array>();

  useEffect(() => {
    let annule = false;
    if (!clePubliqueAutre) {
      setCle(undefined);
      return;
    }
    void cleDeMessages(clePubliqueAutre).then((derivee) => {
      if (!annule) setCle(derivee);
    });
    return () => {
      annule = true;
    };
  }, [clePubliqueAutre]);

  return cle;
}
