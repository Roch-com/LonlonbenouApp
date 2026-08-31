/**
 * Pôle ① — lieux favoris (§8.2 : « Maison, Travail, Salle de sport, Chez les
 * parents… »).
 *
 * ## Ils ne quittent jamais l'appareil
 *
 * C'est la décision structurante de ce module, et elle mérite d'être défendue.
 * Le cahier demande des lieux « nommés et personnalisables » servant à dériver
 * un statut automatique. Rien n'oblige à les partager : ce qui intéresse
 * l'autre, c'est « à la maison », pas les coordonnées de la maison.
 *
 * Les garder locaux supprime d'un coup toute une classe de risques. Une liste
 * de lieux nommés est bien plus révélatrice qu'une position ponctuelle — elle
 * dit où l'on dort, où l'on travaille, où vit sa famille, et elle reste vraie
 * des années. Elle n'a donc aucune raison de transiter par un serveur, même
 * chiffrée, pour un usage qui se joue entièrement sur le téléphone.
 *
 * Conséquence assumée : changer de téléphone fait perdre ses lieux. C'est le
 * même prix que les clés de messages, pour la même raison.
 *
 * ## Le rayon
 *
 * Cent mètres par défaut, ajustable. En dessous, le GPS d'un téléphone en
 * ville fait clignoter le statut à chaque relevé ; au-dessus, « à la maison »
 * s'allume trois rues plus loin.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dansLeRayon, type Position } from '@lonlonbenu/shared';
import { identifiant, stockage } from '@/lib/stockage';

export interface LieuFavori {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
  /** Rayon de déclenchement, en mètres. */
  rayonM: number;
  /**
   * Code de statut posé automatiquement à l'entrée, s'il y en a un. Sans lui,
   * le lieu sert seulement à nommer où l'on se trouve.
   */
  statut?: string;
  creeLe: string;
}

/** Suggestions de départ. Rien n'est créé sans un geste explicite. */
export const LIEUX_SUGGERES: readonly { nom: string; statut?: string }[] = [
  { nom: 'Maison', statut: 'maison' },
  { nom: 'Travail', statut: 'bureau' },
  { nom: 'Salle de sport' },
  { nom: 'Chez les parents' },
];

export const RAYON_PAR_DEFAUT_M = 100;

interface EtatLieux {
  lieux: LieuFavori[];
  /** Dernier lieu reconnu, pour ne pas rejouer le même statut en boucle. */
  dernierLieuId?: string;

  ajouter: (
    nom: string,
    position: Position,
    statut?: string,
    rayonM?: number,
  ) => string;
  renommer: (id: string, nom: string) => void;
  supprimer: (id: string) => void;
  /** Lieu contenant la position, le plus proche d'abord. */
  lieuPour: (position: Position) => LieuFavori | undefined;
  noterLieu: (id: string | undefined) => void;
  vider: () => void;
}

export const useLieux = create<EtatLieux>()(
  persist(
    (set, get) => ({
      lieux: [],

      ajouter(nom, position, statut, rayonM = RAYON_PAR_DEFAUT_M) {
        const id = identifiant();
        set((e) => ({
          lieux: [
            ...e.lieux,
            {
              id,
              nom: nom.trim(),
              latitude: position.latitude,
              longitude: position.longitude,
              rayonM,
              statut,
              creeLe: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      renommer(id, nom) {
        const propre = nom.trim();
        if (!propre) return;
        set((e) => ({
          lieux: e.lieux.map((l) => (l.id === id ? { ...l, nom: propre } : l)),
        }));
      },

      supprimer(id) {
        set((e) => ({
          lieux: e.lieux.filter((l) => l.id !== id),
          dernierLieuId: e.dernierLieuId === id ? undefined : e.dernierLieuId,
        }));
      },

      lieuPour(position) {
        // Le premier qui contient la position. Deux lieux qui se chevauchent
        // sont rares, et prendre le plus petit rayon donnerait le plus précis.
        return get()
          .lieux.filter((l) =>
            dansLeRayon(
              position,
              { latitude: l.latitude, longitude: l.longitude, releveeLe: '' },
              l.rayonM,
            ),
          )
          .sort((a, b) => a.rayonM - b.rayonM)[0];
      },

      noterLieu: (id) => set({ dernierLieuId: id }),

      vider: () => set({ lieux: [], dernierLieuId: undefined }),
    }),
    { name: 'lonlonbenu.lieux', storage: stockage },
  ),
);
