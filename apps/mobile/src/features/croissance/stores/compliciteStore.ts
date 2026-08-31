/**
 * Pôle ② — questions de complicité. **Le serveur rejoue le miroir.**
 *
 * Le store ne filtre rien : la réponse de l'autre n'arrive tout simplement pas
 * tant qu'on n'a pas répondu. Il n'y a donc rien à masquer côté écran, et rien
 * qu'un écran puisse oublier de masquer.
 *
 * Rien n'est persisté. Une réponse gardée sur disque pourrait s'afficher après
 * une dissociation, et le miroir ne vaut que s'il tient à chaque lecture.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import {
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
  type QuestionComplicite,
  type VueEchange,
} from '@lonlonbenu/shared';
import { messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '@/features/presence/services/clesMessages';
import { useChat } from '@/features/presence/stores/chatStore';
import { appeler } from '@/lib/api/client';

const MESSAGE_SANS_CLE =
  'Ouvrez la conversation une fois sur chacun de vos téléphones : vos clés de chiffrement s’y échangent, et elles protègent aussi vos réponses.';

async function cleDuCouple(): Promise<Uint8Array | undefined> {
  const clePubliqueAutre = useChat.getState().cles?.autre;
  if (!clePubliqueAutre) return undefined;
  return cleDeMessages(clePubliqueAutre);
}

interface EtatComplicite {
  vue?: VueEchange;
  chargement: boolean;
  erreur?: string;

  charger: (coupleId: string, jour: string) => Promise<void>;
  repondre: (coupleId: string, jour: string, texte: string) => Promise<boolean>;
  vider: () => void;
}

export const useComplicite = create<EtatComplicite>()((set) => ({
  chargement: false,

  async charger(coupleId, jour) {
    set({ chargement: true, erreur: undefined });
    try {
      set({
        vue: await appeler<VueEchange>(
          `/couples/${coupleId}/complicite?jour=${jour}`,
        ),
      });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  async repondre(coupleId, jour, texte) {
    const propre = texte.trim();
    if (!propre) return false;

    set({ erreur: undefined });
    const cle = await cleDuCouple();
    if (!cle) {
      set({ erreur: MESSAGE_SANS_CLE });
      return false;
    }

    try {
      const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
      set({
        vue: await appeler<VueEchange>(`/couples/${coupleId}/complicite`, {
          methode: 'PUT',
          corps: { jour, texteScelle: scellerMessage(cle, nonce, propre) },
        }),
      });
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    }
  },

  vider: () => set({ vue: undefined, erreur: undefined }),
}));

export interface EchangeLisible {
  question: QuestionComplicite;
  etat: VueEchange['etat'];
  lecture: string;
  mienne?: string;
  sienne?: string;
}

/** L'échange ouvert. Le clair n'existe que le temps du rendu. */
export function useEchangeLisible(): EchangeLisible | undefined {
  const vue = useComplicite((e) => e.vue);
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

  return useMemo(() => {
    if (!vue) return undefined;

    const ouvrir = (scelle: string | undefined) => {
      if (!scelle || !cle) return undefined;
      try {
        return ouvrirMessage(cle, scelle);
      } catch {
        return undefined;
      }
    };

    return {
      question: vue.question,
      etat: vue.etat,
      lecture: vue.lecture,
      mienne: ouvrir(vue.mienne?.texteScelle),
      sienne: ouvrir(vue.sienne?.texteScelle),
    };
  }, [vue, cle]);
}
