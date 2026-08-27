/**
 * Pôle ① — Carte & Présence. **Le serveur fait autorité.**
 *
 * Le store ne décide plus de ce qui est visible : le serveur a déjà appliqué
 * la réciprocité stricte et n'a rien envoyé du statut de l'autre tant que les
 * deux n'ont pas consenti. Il n'y a donc rien à filtrer ici, et rien qu'on
 * puisse oublier de filtrer.
 *
 * Les textes libres (note de statut, lieu de check-in, message de SOS) sont
 * scellés avec la même clé que les messages, avant de partir. Le serveur les
 * range sans pouvoir les lire.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LONGUEUR_NONCE, ouvrirMessage, scellerMessage } from '@lonlonbenu/shared';
import * as Crypto from 'expo-crypto';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  changerEtatAlerteServeur,
  declencherSosServeur,
  definirHumeurServeur,
  definirStatutServeur,
  faireUnCheckInServeur,
  lirePresence,
  type VuePresenceServeur,
} from '../api/presence.api';
import { cleDeMessages } from '../services/clesMessages';
import { useChat } from './chatStore';

interface EtatPresence {
  vue?: VuePresenceServeur;
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  definirStatut: (
    coupleId: string,
    moiId: string,
    code: string,
    note?: string,
  ) => Promise<void>;
  definirHumeur: (
    coupleId: string,
    moiId: string,
    code: string,
    mot?: string,
  ) => Promise<void>;
  faireUnCheckIn: (
    coupleId: string,
    moiId: string,
    lieu: string,
    mot?: string,
  ) => Promise<boolean>;
  declencherSos: (
    coupleId: string,
    moiId: string,
    lieu?: string,
    message?: string,
  ) => Promise<boolean>;
  changerEtatAlerte: (
    coupleId: string,
    moiId: string,
    id: string,
    action: 'vue' | 'resolue',
  ) => Promise<void>;
  vider: () => void;
}

/** Scelle un texte libre avec la clé du couple, ou rend `undefined` si vide. */
async function sceller(texte?: string): Promise<string | undefined> {
  const propre = texte?.trim();
  if (!propre) return undefined;

  const autre = useChat.getState().cles?.autre;
  if (!autre) {
    // Sans la clé de l'autre, on préfère ne rien envoyer qu'envoyer en clair.
    throw new ErreurApi(
      'conflit',
      'La conversation n’est pas encore ouverte des deux côtés : ce texte ne peut pas être chiffré.',
    );
  }
  const cle = await cleDeMessages(autre);
  return scellerMessage(cle, Crypto.getRandomBytes(LONGUEUR_NONCE), propre);
}

export const usePresence = create<EtatPresence>()(
  persist(
    (set, get) => {
      const relire = async (coupleId: string, moiId: string) => {
        set({
          vue: await lirePresence(coupleId),
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

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
                ? 'Sans connexion, rien ne peut être partagé pour l’instant.'
                : messageLisible(erreur),
          });
          return false;
        }
      };

      return {
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
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

        async definirStatut(coupleId, moiId, code, note) {
          await ecrire(coupleId, moiId, async () =>
            definirStatutServeur(coupleId, code, await sceller(note)),
          );
        },

        async definirHumeur(coupleId, moiId, code, mot) {
          await ecrire(coupleId, moiId, async () =>
            definirHumeurServeur(coupleId, code, await sceller(mot)),
          );
        },

        faireUnCheckIn: (coupleId, moiId, lieu, mot) =>
          ecrire(coupleId, moiId, async () =>
            faireUnCheckInServeur(
              coupleId,
              (await sceller(lieu))!,
              await sceller(mot),
            ),
          ),

        declencherSos: (coupleId, moiId, lieu, message) =>
          ecrire(coupleId, moiId, async () =>
            declencherSosServeur(
              coupleId,
              await sceller(lieu),
              await sceller(message),
            ),
          ),

        async changerEtatAlerte(coupleId, moiId, id, action) {
          await ecrire(coupleId, moiId, () =>
            changerEtatAlerteServeur(coupleId, id, action),
          );
        },

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
      name: 'lonlonbenu.presence',
      storage: stockage,
      partialize: (e) => ({
        vue: e.vue,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);

/**
 * Ouvre un texte scellé pour l'affichage. Rend `undefined` plutôt que du
 * chiffré brut : mieux vaut un champ vide qu'une suite de caractères illisible.
 */
export async function ouvrirTexte(scelle?: string): Promise<string | undefined> {
  if (!scelle) return undefined;
  const autre = useChat.getState().cles?.autre;
  if (!autre) return undefined;
  try {
    return ouvrirMessage(await cleDeMessages(autre), scelle);
  } catch {
    return undefined;
  }
}
