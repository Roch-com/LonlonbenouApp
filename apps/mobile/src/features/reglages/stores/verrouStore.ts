/**
 * Pôle ⑥ — Verrou d'application.
 *
 * Biométrie en premier, code PIN en secours : sur un appareil sans capteur, ou
 * quand la reconnaissance échoue, il faut toujours une porte d'entrée. Un
 * verrou dont on peut se retrouver exclu n'est pas une protection, c'est un
 * piège.
 *
 * `deverrouille` n'est jamais persisté : au démarrage à froid, l'app est
 * toujours verrouillée.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  controlerPin,
  creerVerificateurAsync,
  etatDurcissement,
  LONGUEUR_SEL,
  verifierPinAsync,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import {
  effacerVerificateur,
  enregistrerVerificateur,
  lireVerificateur,
} from '../services/secretVerrou';

/** Repasser en avant-plan sous ce délai ne redemande pas le code. */
export const DELAI_GRACE_MS = 30_000;

export interface ResultatTentative {
  ok: boolean;
  /** Message prêt à l'affichage, jamais accusateur. */
  message?: string;
  secondesRestantes?: number;
}

interface EtatVerrou {
  actif: boolean;
  biometrie: boolean;
  echecs: number;
  dernierEchecLe?: string;
  /** Horodatage du passage en arrière-plan, pour le délai de grâce. */
  masqueDepuis?: number;

  /** Non persisté : reprend toujours la valeur `false` au lancement. */
  deverrouille: boolean;

  activerVerrou: (pin: string) => Promise<ResultatTentative>;
  desactiverVerrou: () => Promise<void>;
  changerPin: (pinActuel: string, nouveauPin: string) => Promise<ResultatTentative>;
  basculerBiometrie: (valeur: boolean) => Promise<void>;

  tenterPin: (pin: string) => Promise<ResultatTentative>;
  tenterBiometrie: () => Promise<boolean>;
  verrouiller: () => void;
  signalerMasquage: () => void;
  signalerRetour: () => void;
}

export const useVerrou = create<EtatVerrou>()(
  persist(
    (set, get) => ({
      actif: false,
      biometrie: true,
      echecs: 0,
      deverrouille: false,

      activerVerrou: async (pin) => {
        const controle = controlerPin(pin);
        if (!controle.valide) return { ok: false, message: controle.message };

        const sel = Crypto.getRandomBytes(LONGUEUR_SEL);
        await enregistrerVerificateur(await creerVerificateurAsync(pin, sel));
        set({
          actif: true,
          deverrouille: true,
          echecs: 0,
          dernierEchecLe: undefined,
        });
        return { ok: true };
      },

      desactiverVerrou: async () => {
        await effacerVerificateur();
        set({
          actif: false,
          deverrouille: true,
          echecs: 0,
          dernierEchecLe: undefined,
        });
      },

      changerPin: async (pinActuel, nouveauPin) => {
        const verification = await get().tenterPin(pinActuel);
        if (!verification.ok) return verification;
        return get().activerVerrou(nouveauPin);
      },

      basculerBiometrie: async (valeur) => {
        if (!valeur) {
          set({ biometrie: false });
          return;
        }
        const disponible = await LocalAuthentication.hasHardwareAsync();
        const enrole = await LocalAuthentication.isEnrolledAsync();
        set({ biometrie: disponible && enrole });
      },

      tenterPin: async (pin) => {
        const { echecs, dernierEchecLe } = get();
        const durcissement = etatDurcissement(echecs, dernierEchecLe);
        if (durcissement.bloque) {
          return {
            ok: false,
            secondesRestantes: durcissement.secondesRestantes,
            message: `Encore ${durcissement.secondesRestantes} s avant un nouvel essai.`,
          };
        }

        const verificateur = await lireVerificateur();
        if (!verificateur) {
          // Plus de vérificateur : on ne laisse personne dehors.
          set({ actif: false, deverrouille: true });
          return { ok: true };
        }

        if (await verifierPinAsync(pin, verificateur)) {
          set({
            deverrouille: true,
            echecs: 0,
            dernierEchecLe: undefined,
            masqueDepuis: undefined,
          });
          return { ok: true };
        }

        const nouveauxEchecs = echecs + 1;
        set({ echecs: nouveauxEchecs, dernierEchecLe: new Date().toISOString() });
        const suivant = etatDurcissement(nouveauxEchecs, new Date().toISOString());
        return {
          ok: false,
          secondesRestantes: suivant.secondesRestantes,
          message: suivant.bloque
            ? `Ce code ne correspond pas. Nouvel essai dans ${suivant.secondesRestantes} s.`
            : 'Ce code ne correspond pas.',
        };
      },

      tenterBiometrie: async () => {
        if (!get().biometrie) return false;

        const disponible =
          (await LocalAuthentication.hasHardwareAsync()) &&
          (await LocalAuthentication.isEnrolledAsync());
        if (!disponible) return false;

        const resultat = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Déverrouiller LONLONBENU',
          fallbackLabel: 'Utiliser mon code',
          cancelLabel: 'Annuler',
        });

        if (resultat.success) {
          set({
            deverrouille: true,
            echecs: 0,
            dernierEchecLe: undefined,
            masqueDepuis: undefined,
          });
        }
        return resultat.success;
      },

      verrouiller: () => set({ deverrouille: false, masqueDepuis: undefined }),

      signalerMasquage: () => {
        if (get().actif) set({ masqueDepuis: Date.now() });
      },

      signalerRetour: () => {
        const { actif, masqueDepuis } = get();
        if (!actif || masqueDepuis === undefined) return;
        if (Date.now() - masqueDepuis >= DELAI_GRACE_MS) {
          set({ deverrouille: false });
        }
        set({ masqueDepuis: undefined });
      },
    }),
    {
      name: 'lonlonbenu.verrou',
      storage: stockage,
      // `deverrouille` reste hors de la persistance : relancer l'app reverrouille.
      partialize: (e) => ({
        actif: e.actif,
        biometrie: e.biometrie,
        echecs: e.echecs,
        dernierEchecLe: e.dernierEchecLe,
      }),
    },
  ),
);

/** Vrai tant que l'app doit rester masquée. */
export function useAppVerrouillee(): boolean {
  return useVerrou((e) => e.actif && !e.deverrouille);
}
