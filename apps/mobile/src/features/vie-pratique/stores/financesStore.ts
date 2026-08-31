/**
 * Pôle ③ — Finances partagées. **Le serveur fait autorité, mais ne calcule rien.**
 *
 * Les montants sont scellés avec la clé du couple : le serveur ne sait ni
 * combien vous dépensez, ni en quoi, ni qui paie. Tous les totaux, l'équilibre
 * et les budgets se calculent donc ici, après ouverture des enveloppes.
 *
 * Le cache persisté ne détient que du scellé. Le clair n'existe qu'au rendu.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import {
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
  type ContenuDepense,
  type Depense,
  type ReglesPartage,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '@/features/presence/services/clesMessages';
import { useChat } from '@/features/presence/stores/chatStore';
import {
  ajouterDepenseServeur,
  definirReglagesServeur,
  lireFinances,
  supprimerDepenseServeur,
  type DepenseScellee,
  type ReglagesFinancesServeur,
} from '../api/finances.api';

const MESSAGE_SANS_CLE =
  'Ouvrez la conversation une fois sur chacun de vos téléphones : vos clés de chiffrement s’y échangent, et elles protègent aussi vos comptes.';

async function cleDuCouple(): Promise<Uint8Array | undefined> {
  const clePubliqueAutre = useChat.getState().cles?.autre;
  if (!clePubliqueAutre) return undefined;
  return cleDeMessages(clePubliqueAutre);
}

interface EtatFinances {
  reglages: ReglagesFinancesServeur;
  scellees: DepenseScellee[];
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;
  basculerModule: (
    coupleId: string,
    moiId: string,
    actif: boolean,
  ) => Promise<boolean>;
  definirDevise: (
    coupleId: string,
    moiId: string,
    devise: string,
  ) => Promise<boolean>;
  definirRegles: (
    coupleId: string,
    moiId: string,
    regles: ReglesPartage,
  ) => Promise<boolean>;
  ajouter: (
    coupleId: string,
    moiId: string,
    jour: string,
    contenu: ContenuDepense,
  ) => Promise<boolean>;
  supprimer: (coupleId: string, moiId: string, id: string) => Promise<boolean>;
  vider: () => void;
}

const REGLAGES_INITIAUX: ReglagesFinancesServeur = {
  actif: false,
  devise: 'XOF',
  majLe: new Date(0).toISOString(),
};

export const useFinances = create<EtatFinances>()(
  persist(
    (set, get) => {
      const relire = async (coupleId: string, moiId: string) => {
        const vue = await lireFinances(coupleId);
        set({
          reglages: vue.reglages,
          scellees: vue.depenses,
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      /** Écriture puis relecture : l'affiché vient toujours du serveur. */
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
        reglages: REGLAGES_INITIAUX,
        scellees: [],
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          if (get().cachePour && get().cachePour !== moiId) {
            set({ scellees: [], cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), scellees: [] });
            }
          } finally {
            set({ chargement: false });
          }
        },

        basculerModule: (coupleId, moiId, actif) =>
          ecrire(coupleId, moiId, () =>
            definirReglagesServeur(coupleId, { actif }),
          ),

        definirDevise: (coupleId, moiId, devise) =>
          ecrire(coupleId, moiId, () =>
            definirReglagesServeur(coupleId, { devise }),
          ),

        async definirRegles(coupleId, moiId, regles) {
          const cle = await cleDuCouple();
          if (!cle) {
            set({ erreur: MESSAGE_SANS_CLE });
            return false;
          }
          const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
          return ecrire(coupleId, moiId, () =>
            definirReglagesServeur(coupleId, {
              reglesScellees: scellerMessage(cle, nonce, JSON.stringify(regles)),
            }),
          );
        },

        async ajouter(coupleId, moiId, jour, contenu) {
          const cle = await cleDuCouple();
          if (!cle) {
            set({ erreur: MESSAGE_SANS_CLE });
            return false;
          }
          const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
          return ecrire(coupleId, moiId, () =>
            ajouterDepenseServeur(
              coupleId,
              jour,
              scellerMessage(cle, nonce, JSON.stringify(contenu)),
            ),
          );
        },

        supprimer: (coupleId, moiId, id) =>
          ecrire(coupleId, moiId, () => supprimerDepenseServeur(coupleId, id)),

        vider: () =>
          set({
            reglages: REGLAGES_INITIAUX,
            scellees: [],
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.finances',
      storage: stockage,
      partialize: (e) => ({
        reglages: e.reglages,
        scellees: e.scellees,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);

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

/**
 * Dépenses ouvertes, prêtes à calculer.
 *
 * Celles qu'on ne sait plus ouvrir sont écartées : une dépense illisible
 * fausserait tous les totaux, et un solde faux vaut moins que pas de solde.
 */
export function useDepensesLisibles(): Depense[] {
  const scellees = useFinances((e) => e.scellees);
  const cle = useCleDuCouple();

  return useMemo(() => {
    if (!cle) return [];
    return scellees
      .map(({ contenuScelle, ...reste }) => {
        try {
          return {
            ...reste,
            ...(JSON.parse(ouvrirMessage(cle, contenuScelle)) as ContenuDepense),
          };
        } catch {
          return undefined;
        }
      })
      .filter((d): d is Depense => !!d);
  }, [scellees, cle]);
}

/** Règles de partage ouvertes. Le partage égal à défaut. */
export function useReglesPartage(): ReglesPartage {
  const scellees = useFinances((e) => e.reglages.reglesScellees);
  const cle = useCleDuCouple();

  return useMemo(() => {
    if (!cle || !scellees) return { mode: 'egal' };
    try {
      return JSON.parse(ouvrirMessage(cle, scellees)) as ReglesPartage;
    } catch {
      // Règles illisibles : on retombe sur le partage égal plutôt que de
      // calculer un solde avec des parts inventées.
      return { mode: 'egal' };
    }
  }, [scellees, cle]);
}
