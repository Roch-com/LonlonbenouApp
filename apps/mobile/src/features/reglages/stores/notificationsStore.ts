/**
 * Pôle ⑥ — Socle de notifications, centralisé.
 *
 * **Aucun pôle n'émet de notification directement.** Tout passe par `publier`,
 * qui interroge `deciderRemise` (`@lonlonbenu/shared/notifications`). C'est la
 * seule façon de garantir des règles à l'échelle de l'app — le SOS qui traverse
 * tout, le mode ne pas déranger, les fréquences — plutôt que des exceptions
 * disséminées.
 *
 * Les préférences sont **personnelles, pas conjugales** : mon mode ne pas
 * déranger est le mien. Elles sont donc indexées par partenaire.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  deciderRemise,
  PREFERENCES_PAR_DEFAUT,
  type CategorieNotification,
  type Frequence,
  type PartenaireId,
  type PlageSilence,
  type PreferencesNotifications,
  type Remise,
} from '@lonlonbenu/shared';
import { identifiant, stockage } from '@/lib/stockage';

export interface NotificationEnregistree {
  id: string;
  destinataireId: PartenaireId;
  categorie: CategorieNotification;
  texte: string;
  emiseLe: string;
  remise: Remise;
  raison: string;
  lueLe?: string;
}

export interface ANotifier {
  destinataireId: PartenaireId;
  categorie: CategorieNotification;
  texte: string;
}

interface EtatNotifications {
  journal: NotificationEnregistree[];
  preferences: Record<PartenaireId, PreferencesNotifications>;

  publier: (entrees: readonly ANotifier[]) => void;
  marquerLues: (destinataireId: PartenaireId) => void;

  definirFrequence: (
    partenaireId: PartenaireId,
    categorie: CategorieNotification,
    frequence: Frequence,
  ) => void;
  definirSilence: (partenaireId: PartenaireId, silence: PlageSilence) => void;
  /** Heure du récapitulatif quotidien, « HH:MM ». */
  definirRecapitulatif: (partenaireId: PartenaireId, heure: string) => void;
  definirHeureRecapitulatif: (partenaireId: PartenaireId, heure: string) => void;
  pauser: (partenaireId: PartenaireId, minutes: number) => void;
  reprendre: (partenaireId: PartenaireId) => void;
}

const JOURNAL_MAX = 100;

function preferencesDe(
  etat: EtatNotifications,
  partenaireId: PartenaireId,
): PreferencesNotifications {
  return etat.preferences[partenaireId] ?? PREFERENCES_PAR_DEFAUT;
}

function modifier(
  etat: EtatNotifications,
  partenaireId: PartenaireId,
  transformation: (p: PreferencesNotifications) => PreferencesNotifications,
): Pick<EtatNotifications, 'preferences'> {
  return {
    preferences: {
      ...etat.preferences,
      [partenaireId]: transformation(preferencesDe(etat, partenaireId)),
    },
  };
}

export const useNotifications = create<EtatNotifications>()(
  persist(
    (set, get) => ({
      journal: [],
      preferences: {},

      publier: (entrees) => {
        const maintenant = new Date();
        const etat = get();

        const nouvelles = entrees.map((entree) => {
          const decision = deciderRemise(
            entree.categorie,
            preferencesDe(etat, entree.destinataireId),
            maintenant,
          );
          return {
            id: identifiant(),
            destinataireId: entree.destinataireId,
            categorie: entree.categorie,
            texte: entree.texte,
            emiseLe: maintenant.toISOString(),
            remise: decision.remise,
            raison: decision.raison,
          } satisfies NotificationEnregistree;
        });

        set({
          // Même « ignoree », l'entrée reste au journal : la personne peut
          // toujours retrouver ce qui ne lui a pas été signalé.
          journal: [...nouvelles, ...etat.journal].slice(0, JOURNAL_MAX),
        });
      },

      marquerLues: (destinataireId) =>
        set((e) => ({
          journal: e.journal.map((n) =>
            n.destinataireId === destinataireId && !n.lueLe
              ? { ...n, lueLe: new Date().toISOString() }
              : n,
          ),
        })),

      definirFrequence: (partenaireId, categorie, frequence) =>
        set((e) =>
          modifier(e, partenaireId, (p) => ({
            ...p,
            parCategorie: { ...p.parCategorie, [categorie]: frequence },
          })),
        ),

      definirSilence: (partenaireId, silence) =>
        set((e) => modifier(e, partenaireId, (p) => ({ ...p, silence }))),

      definirRecapitulatif: (partenaireId, heure) =>
        set((e) =>
          modifier(e, partenaireId, (p) => ({ ...p, heureRecapitulatif: heure })),
        ),

      definirHeureRecapitulatif: (partenaireId, heureRecapitulatif) =>
        set((e) =>
          modifier(e, partenaireId, (p) => ({ ...p, heureRecapitulatif })),
        ),

      pauser: (partenaireId, minutes) =>
        set((e) =>
          modifier(e, partenaireId, (p) => ({
            ...p,
            pauseJusqua: new Date(Date.now() + minutes * 60_000).toISOString(),
          })),
        ),

      reprendre: (partenaireId) =>
        set((e) =>
          modifier(e, partenaireId, ({ pauseJusqua: _, ...reste }) => reste),
        ),
    }),
    { name: 'lonlonbenu.notifications', storage: stockage },
  ),
);

/** Préférences de la personne connectée, avec repli sur les valeurs par défaut. */
export function usePreferencesDe(
  partenaireId: PartenaireId,
): PreferencesNotifications {
  return useNotifications(
    (e) => e.preferences[partenaireId] ?? PREFERENCES_PAR_DEFAUT,
  );
}

/** Émet une notification hors composant (depuis un store, par exemple). */
export function notifier(entrees: readonly ANotifier[]): void {
  useNotifications.getState().publier(entrees);
}
