/**
 * Pôle ② — Parcours guidé. **Le serveur rejoue le miroir.**
 *
 * Le store ne filtre rien : la réponse de l’autre n’arrive tout simplement pas
 * tant qu’on n’a pas écrit la sienne. Il n’y a donc rien à masquer côté écran,
 * et rien qu’un écran puisse oublier de masquer.
 *
 * Rien n’est persisté. Une réponse gardée sur disque pourrait s’afficher après
 * une dissociation, et le miroir ne vaut que s’il tient à chaque lecture.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import {
  LONGUEUR_NONCE,
  ouvrirMessage,
  scellerMessage,
  type RecommandationParcours,
  type VueParcours,
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

interface ReponseListe {
  parcours: VueParcours[];
  recommandation: RecommandationParcours | null;
}

interface EtatParcours {
  liste: VueParcours[];
  recommandation?: RecommandationParcours;
  /** Le parcours ouvert à l’écran, plus détaillé que sa ligne dans la liste. */
  ouvert?: VueParcours;
  chargement: boolean;
  envoi: boolean;
  erreur?: string;

  charger: (coupleId: string) => Promise<void>;
  ouvrir: (coupleId: string, parcoursId: string) => Promise<void>;
  engager: (coupleId: string, parcoursId: string) => Promise<boolean>;
  repondre: (
    coupleId: string,
    parcoursId: string,
    seanceId: string,
    texte: string,
  ) => Promise<boolean>;
  marquerEchange: (
    coupleId: string,
    parcoursId: string,
    seanceId: string,
  ) => Promise<boolean>;
  vider: () => void;
}

export const useParcours = create<EtatParcours>()((set, get) => ({
  liste: [],
  chargement: false,
  envoi: false,

  async charger(coupleId) {
    set({ chargement: true, erreur: undefined });
    try {
      const reponse = await appeler<ReponseListe>(
        `/couples/${coupleId}/parcours`,
      );
      set({
        liste: reponse.parcours,
        recommandation: reponse.recommandation ?? undefined,
      });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  async ouvrir(coupleId, parcoursId) {
    set({ chargement: true, erreur: undefined });
    try {
      set({
        ouvert: await appeler<VueParcours>(
          `/couples/${coupleId}/parcours/${parcoursId}`,
        ),
      });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  async engager(coupleId, parcoursId) {
    set({ envoi: true, erreur: undefined });
    try {
      set({
        ouvert: await appeler<VueParcours>(
          `/couples/${coupleId}/parcours/${parcoursId}/engager`,
          { methode: 'POST' },
        ),
      });
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    } finally {
      set({ envoi: false });
    }
  },

  async repondre(coupleId, parcoursId, seanceId, texte) {
    const propre = texte.trim();
    if (!propre) return false;

    set({ envoi: true, erreur: undefined });
    const cle = await cleDuCouple();
    if (!cle) {
      set({ erreur: MESSAGE_SANS_CLE, envoi: false });
      return false;
    }

    try {
      const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
      set({
        ouvert: await appeler<VueParcours>(
          `/couples/${coupleId}/parcours/${parcoursId}/seances/${seanceId}`,
          {
            methode: 'POST',
            corps: { texteScelle: scellerMessage(cle, nonce, propre) },
          },
        ),
      });
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    } finally {
      set({ envoi: false });
    }
  },

  async marquerEchange(coupleId, parcoursId, seanceId) {
    set({ envoi: true, erreur: undefined });
    try {
      set({
        ouvert: await appeler<VueParcours>(
          `/couples/${coupleId}/parcours/${parcoursId}/seances/${seanceId}/echange`,
          { methode: 'POST' },
        ),
      });
      // La liste porte l'avancement : elle est fausse dès qu'une séance passe.
      void get().charger(coupleId);
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    } finally {
      set({ envoi: false });
    }
  },

  vider: () => set({ ouvert: undefined, erreur: undefined }),
}));

/** La clé du couple, dérivée une fois et gardée le temps du montage. */
function useCleCouple(): Uint8Array | undefined {
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

export interface SeanceLisible {
  mienne?: string;
  sienne?: string;
}

/** Les réponses de la séance courante. Le clair n’existe que le temps du rendu. */
export function useSeanceLisible(): SeanceLisible {
  const courante = useParcours((e) => e.ouvert?.courante);
  const cle = useCleCouple();

  return useMemo(() => {
    const ouvrir = (scelle: string | undefined) => {
      if (!scelle || !cle) return undefined;
      try {
        return ouvrirMessage(cle, scelle);
      } catch {
        return undefined;
      }
    };

    return {
      mienne: ouvrir(courante?.mienne?.texteScelle),
      sienne: ouvrir(courante?.sienne?.texteScelle),
    };
  }, [courante, cle]);
}
