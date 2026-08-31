/**
 * Pôle ① — partage de position (§8.2).
 *
 * ## Rien n'est persisté
 *
 * Une position relue sur disque affirmerait « elle est à la maison » à propos
 * de quelqu'un parti depuis des heures. Le seul état juste est celui que le
 * serveur vient de donner ; hors ligne, on ne sait pas, et on ne dit rien.
 *
 * ## Le relevé s'arrête avec l'écran
 *
 * `demarrer` est appelé par l'écran de présence et rendu par son nettoyage.
 * Aucun suivi d'arrière-plan : ce serait un gouffre à batterie (§9.6) et
 * exactement la veille continue que le projet s'interdit. On relève pendant
 * qu'on regarde, pas pendant qu'on vit.
 */
import { create } from 'zustand';
import type { Position } from '@lonlonbenu/shared';
import { messageLisible } from '@/lib/api/erreurs';
import { definirPositionServeur } from '../api/presence.api';
import {
  cleDuCouple,
  demanderLaPermission,
  ouvrirPosition,
  permissionActuelle,
  prochainIntervalle,
  releverLaPosition,
  scellerPosition,
  type EtatPermissionPosition,
} from '../services/positionAppareil';

interface EtatPosition {
  permission: EtatPermissionPosition;
  /** Ma dernière position relevée, jamais envoyée en clair. */
  mienne?: Position;
  /** Celle de l'autre, ouverte localement. Absente sans réciprocité. */
  autre?: Position;
  /** Vrai quand un relevé est en cours de publication. */
  enCours: boolean;
  erreur?: string;

  relirePermission: () => Promise<void>;
  demander: () => Promise<EtatPermissionPosition>;
  /** Relève, scelle et publie une fois. Rend l'espacement du prochain relevé. */
  publierUnRelevé: (coupleId: string) => Promise<number>;
  /** Ouvre l'enveloppe reçue du serveur. */
  ouvrirCelleDeLAutre: (scellee: string | undefined) => Promise<void>;
  vider: () => void;
}

export const usePosition = create<EtatPosition>()((set, get) => ({
  permission: 'jamais_demandee',
  enCours: false,

  async relirePermission() {
    set({ permission: await permissionActuelle() });
  },

  async demander() {
    const permission = await demanderLaPermission();
    set({ permission });
    return permission;
  },

  async publierUnRelevé(coupleId) {
    if (get().permission !== 'accordee') return 0;

    set({ enCours: true });
    try {
      const position = await releverLaPosition();
      if (!position) return 0;

      const cle = await cleDuCouple();
      if (!cle) {
        // Sans clé de couple, rien ne part : la position en clair n'est
        // jamais une solution de repli.
        set({
          erreur:
            'Ouvrez la conversation une fois sur chacun de vos téléphones : vos clés de chiffrement s’y échangent, et elles servent aussi à la position.',
        });
        return 0;
      }

      const intervalle = prochainIntervalle(get().mienne, position);
      await definirPositionServeur(coupleId, scellerPosition(cle, position));
      set({ mienne: position, erreur: undefined });
      return intervalle;
    } catch (cause) {
      set({ erreur: messageLisible(cause) });
      return 0;
    } finally {
      set({ enCours: false });
    }
  },

  async ouvrirCelleDeLAutre(scellee) {
    if (!scellee) {
      set({ autre: undefined });
      return;
    }
    const cle = await cleDuCouple();
    set({ autre: ouvrirPosition(cle, scellee) });
  },

  vider: () => set({ mienne: undefined, autre: undefined, erreur: undefined }),
}));
