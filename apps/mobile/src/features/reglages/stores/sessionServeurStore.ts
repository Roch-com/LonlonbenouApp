/**
 * Session serveur : flux OAuth2 Authorization Code + PKCE.
 *
 * Rien n'est persisté par ce store. Le jeton d'accès reste en mémoire, le
 * jeton de rafraîchissement va au trousseau (`secretsSession.ts`), et l'état
 * est reconstruit au démarrage par `restaurer()`. Un store persisté aurait
 * signifié écrire des jetons dans AsyncStorage.
 */
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import {
  defiDepuisVerificateur,
  OCTETS_VERIFICATEUR,
  verificateurDepuisAlea,
} from '@lonlonbenu/shared';
import { appeler, brancherFournisseurDeJeton, volUnique } from '@/lib/api/client';
import { CONFIGURATION_API } from '@/lib/api/configuration';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  effacerSession,
  enregistrerPartenaireId,
  enregistrerRafraichissement,
  lirePartenaireId,
  lireRafraichissement,
} from '../services/secretsSession';
import { usePush } from './pushStore';

export type EtatSessionServeur =
  /** Avant la première tentative de restauration. */
  'inconnu' | 'anonyme' | 'connecte';

interface ReponseJetons {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface PartenaireServeur {
  id: string;
  prenom: string;
  initiales: string;
}

interface EtatSessionStore {
  etat: EtatSessionServeur;
  partenaireId?: string;
  coupleId?: string;
  /** Date d'origine du couple, telle que le serveur la connaît. */
  depuis?: string;
  /** Prénoms venus de l'appairage : le serveur fait autorité, pas le local. */
  partenaires?: PartenaireServeur[];
  jetonAcces?: string;
  /** Dernier message d'erreur affichable, remis à zéro à chaque tentative. */
  erreur?: string;
  enCours: boolean;

  restaurer: () => Promise<void>;
  /** Corrige la date d'origine du couple. Rend vrai si le serveur l'a acceptée. */
  corrigerLaDate: (depuis: string) => Promise<boolean>;
  sInscrire: (courriel: string, motDePasse: string) => Promise<boolean>;
  seConnecter: (courriel: string, motDePasse: string) => Promise<boolean>;
  seDeconnecter: () => Promise<void>;
  rafraichirLeCouple: () => Promise<void>;
}

async function alea(octets: number): Promise<Uint8Array> {
  return Crypto.getRandomBytes(octets);
}

export const useSessionServeur = create<EtatSessionStore>()((set, get) => {
  /**
   * Rotation à vol unique : plusieurs 401 simultanés ne déclenchent qu'une
   * seule rotation. Le serveur révoque la famille dès qu'un jeton déjà tourné
   * est rejoué — deux rotations concurrentes déconnecteraient l'utilisateur.
   */
  const rafraichir = volUnique(async (): Promise<string | undefined> => {
    const refresh = await lireRafraichissement();
    if (!refresh) {
      set({ etat: 'anonyme', jetonAcces: undefined });
      return undefined;
    }

    try {
      const jetons = await appeler<ReponseJetons>('/oauth/token', {
        methode: 'POST',
        sansJeton: true,
        corps: {
          grant_type: 'refresh_token',
          refresh_token: refresh,
          client_id: CONFIGURATION_API.clientId,
        },
      });

      await enregistrerRafraichissement(jetons.refresh_token);
      set({ jetonAcces: jetons.access_token, etat: 'connecte' });
      return jetons.access_token;
    } catch (erreur) {
      // Hors ligne : la session n'est pas perdue, seulement inutilisable pour
      // l'instant. On garde le jeton de rafraîchissement.
      if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
        return undefined;
      }
      await effacerSession();
      set({ etat: 'anonyme', jetonAcces: undefined, coupleId: undefined });
      return undefined;
    }
  });

  brancherFournisseurDeJeton({
    jetonActuel: () => get().jetonAcces,
    rafraichir,
  });

  /** Les deux étapes du flux, du défi PKCE aux jetons. */
  async function ouvrirUneSession(
    courriel: string,
    motDePasse: string,
  ): Promise<boolean> {
    const verificateur = verificateurDepuisAlea(await alea(OCTETS_VERIFICATEUR));
    const defi = defiDepuisVerificateur(verificateur);

    const { code } = await appeler<{ code: string }>('/oauth/authorize', {
      methode: 'POST',
      sansJeton: true,
      corps: {
        courriel,
        motDePasse,
        client_id: CONFIGURATION_API.clientId,
        code_challenge: defi,
        code_challenge_method: 'S256',
      },
    });

    const jetons = await appeler<ReponseJetons>('/oauth/token', {
      methode: 'POST',
      sansJeton: true,
      corps: {
        grant_type: 'authorization_code',
        code,
        code_verifier: verificateur,
        client_id: CONFIGURATION_API.clientId,
      },
    });

    await enregistrerRafraichissement(jetons.refresh_token);
    set({ jetonAcces: jetons.access_token, etat: 'connecte' });

    await get().rafraichirLeCouple();
    return true;
  }

  return {
    etat: 'inconnu',
    enCours: false,

    async restaurer() {
      const [refresh, partenaireId] = await Promise.all([
        lireRafraichissement(),
        lirePartenaireId(),
      ]);
      if (!refresh) {
        set({ etat: 'anonyme' });
        return;
      }

      set({ partenaireId });
      const jeton = await rafraichir();
      if (jeton) await get().rafraichirLeCouple();
      // Hors ligne avec un jeton de rafraîchissement valide : on reste sur
      // « inconnu », l'interface montrera le cache plutôt qu'un écran de
      // connexion trompeur.
      else if (get().etat === 'inconnu') set({ etat: 'anonyme' });
    },

    async sInscrire(courriel, motDePasse) {
      set({ enCours: true, erreur: undefined });
      try {
        await appeler('/comptes', {
          methode: 'POST',
          sansJeton: true,
          corps: { courriel, motDePasse },
        });
        return await ouvrirUneSession(courriel, motDePasse);
      } catch (erreur) {
        set({ erreur: messageLisible(erreur) });
        return false;
      } finally {
        set({ enCours: false });
      }
    },

    async seConnecter(courriel, motDePasse) {
      set({ enCours: true, erreur: undefined });
      try {
        return await ouvrirUneSession(courriel, motDePasse);
      } catch (erreur) {
        set({
          erreur:
            erreur instanceof ErreurApi && erreur.statut === 401
              ? 'Ces identifiants ne correspondent à aucun compte.'
              : messageLisible(erreur),
        });
        return false;
      } finally {
        set({ enCours: false });
      }
    },

    async seDeconnecter() {
      const refresh = await lireRafraichissement();
      try {
        await appeler('/oauth/revoke', {
          methode: 'POST',
          corps: { refresh_token: refresh },
        });
      } catch {
        // Révoquer côté serveur est préférable, mais son échec ne doit pas
        // empêcher de se déconnecter de cet appareil.
      }
      // L'inscription push suit la session : cet appareil ne doit plus être
      // annoncé comme joignable pour quelqu'un qui vient de s'en déconnecter.
      await usePush.getState().oublier();

      await effacerSession();
      set({
        etat: 'anonyme',
        jetonAcces: undefined,
        partenaireId: undefined,
        coupleId: undefined,
      });
    },

    async corrigerLaDate(depuis) {
      const coupleId = get().coupleId;
      if (!coupleId) return false;
      try {
        await appeler(`/couples/${coupleId}/depuis`, {
          methode: 'PUT',
          corps: { depuis },
        });
        set({ depuis });
        return true;
      } catch (erreur) {
        set({ erreur: messageLisible(erreur) });
        return false;
      }
    },

    async rafraichirLeCouple() {
      try {
        const moi = await appeler<{ partenaireId: string; coupleId?: string }>(
          '/moi',
        );
        await enregistrerPartenaireId(moi.partenaireId);
        set({ partenaireId: moi.partenaireId, coupleId: moi.coupleId });
      } catch (erreur) {
        if (erreur instanceof ErreurApi && erreur.genre === 'non_authentifie') {
          set({ etat: 'anonyme', jetonAcces: undefined });
        }
      }
    },
  };
});

/** Vrai quand le serveur peut faire autorité : connecté et couple appairé. */
export function useServeurFaitAutorite(): boolean {
  return useSessionServeur((e) => e.etat === 'connecte' && !!e.coupleId);
}
