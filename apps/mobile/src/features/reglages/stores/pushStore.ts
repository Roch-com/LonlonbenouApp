/**
 * Pôle ⑥ — inscription de cet appareil aux notifications poussées.
 *
 * Trois choses distinctes, souvent confondues :
 *
 * 1. **La permission système**, accordée à l'app par la personne, une fois.
 * 2. **Le jeton d'appareil**, délivré par Apple ou Google, qui change tout seul
 *    (réinstallation, restauration de sauvegarde, rotation).
 * 3. **L'inscription serveur**, qui relie ce jeton au partenaire connecté.
 *
 * Les trois doivent tenir ensemble : une permission accordée sans jeton inscrit
 * ne sert à rien, et un jeton inscrit devenu obsolète fait pousser dans le vide.
 * D'où `synchroniser`, rejouée à chaque ouverture de session.
 *
 * ## Ce que ce store ne fait pas
 *
 * Il ne relance jamais quelqu'un qui a refusé. Un refus est une réponse, pas un
 * état intermédiaire à corriger — et une app qui redemande à chaque ouverture
 * est exactement le genre d'insistance que ce projet s'interdit. La demande se
 * reprend depuis les réglages, quand la personne le décide.
 *
 * Il n'informe pas non plus le partenaire : refuser les notifications est un
 * choix personnel, et le signaler à l'autre en ferait un reproche.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Notifications from 'expo-notifications';
import { stockage } from '@/lib/stockage';
import { messageLisible } from '@/lib/api/erreurs';
import { inscrireAppareil } from '../api/appareils.api';
import {
  obtenirLeJeton,
  oublierLeJetonFactice,
  plateformePush,
} from '../services/jetonAppareil';

export type EtatPermission =
  /** Jamais demandée sur cet appareil. */
  | 'jamais_demandee'
  | 'accordee'
  | 'refusee'
  /** Plateforme sans notifications (le web, pour l'instant). */
  | 'indisponible';

interface EtatPush {
  permission: EtatPermission;
  /** Horodatage de la dernière inscription réussie auprès du serveur. */
  inscritLe?: string;
  /** Vrai quand le jeton inscrit est un jeton de développement. */
  factice: boolean;
  erreur?: string;
  enCours: boolean;

  /** Lit l'état système sans rien demander à la personne. */
  relire: () => Promise<void>;
  /** Demande la permission, puis inscrit le jeton. Rend l'état obtenu. */
  demander: () => Promise<EtatPermission>;
  /** Rejoue l'inscription si la permission est déjà là. Silencieuse. */
  synchroniser: () => Promise<void>;
  /** Déconnexion ou dissociation : cet appareil n'est plus le nôtre. */
  oublier: () => Promise<void>;
}

function depuisLaReponse(
  accordee: boolean,
  demandeeAvant: boolean,
): EtatPermission {
  if (accordee) return 'accordee';
  return demandeeAvant ? 'refusee' : 'jamais_demandee';
}

export const usePush = create<EtatPush>()(
  persist(
    (set, get) => {
      /** Obtient le jeton et l'inscrit. Rend `false` si rien n'a pu partir. */
      async function inscrire(): Promise<boolean> {
        const jeton = await obtenirLeJeton();
        if (!jeton) return false;

        try {
          await inscrireAppareil(jeton.jetonPush, jeton.plateforme);
          set({
            inscritLe: new Date().toISOString(),
            factice: jeton.factice,
            erreur: undefined,
          });
          return true;
        } catch (erreur) {
          set({ erreur: messageLisible(erreur) });
          return false;
        }
      }

      return {
        permission: 'jamais_demandee',
        factice: false,
        enCours: false,

        async relire() {
          if (!plateformePush()) {
            set({ permission: 'indisponible' });
            return;
          }
          const etat = await Notifications.getPermissionsAsync();
          set({
            permission: depuisLaReponse(
              etat.granted,
              etat.status !== 'undetermined',
            ),
          });
        },

        async demander() {
          if (!plateformePush()) {
            set({ permission: 'indisponible' });
            return 'indisponible';
          }

          set({ enCours: true, erreur: undefined });
          try {
            const etat = await Notifications.requestPermissionsAsync({
              // Le strict nécessaire. Pas de CarPlay — un bandeau qui
              // s'affiche sur l'écran d'une voiture souvent partagée va contre
              // tout le reste — et pas d'alertes critiques, qui traverseraient
              // le mode silencieux du téléphone : le SOS traverse déjà les
              // réglages de l'app, pas ceux de l'appareil.
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });

            const permission = depuisLaReponse(etat.granted, true);
            set({ permission });

            if (permission === 'accordee') await inscrire();
            return permission;
          } finally {
            set({ enCours: false });
          }
        },

        async synchroniser() {
          if (!plateformePush()) return;

          await get().relire();
          // Rien à faire sans permission : surtout pas la redemander en douce.
          if (get().permission !== 'accordee') return;

          await inscrire();
        },

        async oublier() {
          await oublierLeJetonFactice();
          set({ inscritLe: undefined, factice: false, erreur: undefined });
        },
      };
    },
    {
      name: 'lonlonbenu.push',
      storage: stockage,
      // La permission vient du système, jamais du disque : la personne peut
      // l'avoir retirée dans les réglages iOS ou Android entre deux ouvertures.
      partialize: ({ inscritLe, factice }) => ({ inscritLe, factice }),
    },
  ),
);
