/**
 * Pôle ④ — Complicité & connexion. **Le serveur rejoue le miroir.**
 *
 * Le store ne filtre rien : le résultat de l’autre n’arrive tout simplement
 * pas tant que les deux questionnaires ne sont pas finis. Il n’y a donc rien à
 * masquer côté écran, et rien qu’un écran puisse oublier de masquer.
 *
 * Le brouillon du questionnaire, lui, est local et non persisté : on peut le
 * remplir en plusieurs fois dans la même session, et le serveur accepte un
 * envoi partiel — ce qui évite de tout recommencer si on est interrompu.
 */
import { create } from 'zustand';
import type { Choix, VueLangages, Rituel } from '@lonlonbenu/shared';
import { messageLisible } from '@/lib/api/erreurs';
import { appeler } from '@/lib/api/client';

interface InvitationRecue {
  rituel: Rituel;
  lecture: string;
}

interface VueConnexion {
  langages: VueLangages;
  rituelDuJour: Rituel;
  rituels: Rituel[];
  invitation?: InvitationRecue;
}

interface EtatConnexion {
  vue?: VueConnexion;
  /** Réponses en cours de saisie, jamais persistées. */
  brouillon: Record<string, 'a' | 'b'>;
  chargement: boolean;
  envoi: boolean;
  erreur?: string;

  charger: (coupleId: string, jour: string) => Promise<void>;
  choisir: (questionId: string, cote: 'a' | 'b') => void;
  envoyer: (coupleId: string, jour: string) => Promise<boolean>;
  reprendre: () => void;
  vider: () => void;
}

export const useConnexion = create<EtatConnexion>()((set, get) => ({
  brouillon: {},
  chargement: false,
  envoi: false,

  async charger(coupleId, jour) {
    set({ chargement: true, erreur: undefined });
    try {
      set({
        vue: await appeler<VueConnexion>(
          `/couples/${coupleId}/connexion?jour=${jour}`,
        ),
      });
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
    } finally {
      set({ chargement: false });
    }
  },

  choisir(questionId, cote) {
    set({ brouillon: { ...get().brouillon, [questionId]: cote } });
  },

  async envoyer(coupleId, jour) {
    set({ envoi: true, erreur: undefined });
    try {
      const vue = await appeler<VueConnexion>(
        `/couples/${coupleId}/connexion/langages`,
        { methode: 'PUT', corps: { choix: get().brouillon, jour } },
      );
      set({ vue, brouillon: {} });
      return true;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return false;
    } finally {
      set({ envoi: false });
    }
  },

  /** Repart d’un questionnaire vierge, sans toucher à ce qui est enregistré. */
  reprendre: () => set({ brouillon: {}, erreur: undefined }),

  vider: () => set({ vue: undefined, brouillon: {}, erreur: undefined }),
}));

/** Le brouillon, tel qu’il sera envoyé. */
export function useBrouillonLangages(): Choix {
  return useConnexion((e) => e.brouillon);
}
