/**
 * Pôle ③ — Vie pratique partagée. **Le serveur fait autorité.**
 *
 * Le store ne garde plus de clés de rappels : **le mobile n'émet plus aucun
 * rappel**. C'était une boucle qui ne tournait que l'app ouverte, donc un
 * rappel du matin n'arrivait que si quelqu'un ouvrait l'app — c'est-à-dire à
 * peu près jamais au moment utile. Le planificateur serveur balaie les couples
 * quoi que fassent les deux téléphones.
 *
 * Le cache persisté est un cache d'affichage hors ligne, marqué au nom de la
 * personne pour laquelle il a été chargé. Aucune écriture hors ligne : un
 * événement ajouté sans réseau partirait on ne sait quand, et le partenaire le
 * découvrirait après coup — ou jamais.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CategorieSortie,
  Evenement,
  Initiative,
  Projet,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  ajouterEvenementServeur,
  ajouterJalonServeur,
  archiverProjetServeur,
  cocherJalonServeur,
  creerProjetServeur,
  lireViePratique,
  programmerInitiativeServeur,
  proposerInitiativeServeur,
  supprimerEvenementServeur,
  supprimerInitiativeServeur,
  vivreInitiativeServeur,
  type BrouillonEvenement,
} from '../api/viePratique.api';

interface EtatViePratique {
  evenements: Evenement[];
  projets: Projet[];
  initiatives: Initiative[];

  cachePour?: string;
  synchroniseeLe?: string;
  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  charger: (coupleId: string, moiId: string) => Promise<void>;

  ajouterEvenement: (
    coupleId: string,
    moiId: string,
    brouillon: BrouillonEvenement,
  ) => Promise<boolean>;
  supprimerEvenement: (
    coupleId: string,
    moiId: string,
    id: string,
  ) => Promise<boolean>;

  creerProjet: (
    coupleId: string,
    moiId: string,
    titre: string,
    intention?: string,
  ) => Promise<boolean>;
  ajouterJalon: (
    coupleId: string,
    moiId: string,
    projetId: string,
    titre: string,
    echeance?: string,
  ) => Promise<boolean>;
  cocherJalon: (
    coupleId: string,
    moiId: string,
    projetId: string,
    jalonId: string,
  ) => Promise<boolean>;
  archiverProjet: (
    coupleId: string,
    moiId: string,
    projetId: string,
    archive: boolean,
  ) => Promise<boolean>;

  proposerInitiative: (
    coupleId: string,
    moiId: string,
    titre: string,
    categorie: CategorieSortie,
  ) => Promise<boolean>;
  programmerInitiative: (
    coupleId: string,
    moiId: string,
    id: string,
    prevuePour: string,
  ) => Promise<boolean>;
  vivreInitiative: (
    coupleId: string,
    moiId: string,
    id: string,
    souvenir?: string,
  ) => Promise<boolean>;
  supprimerInitiative: (
    coupleId: string,
    moiId: string,
    id: string,
  ) => Promise<boolean>;

  vider: () => void;
}

export const useViePratique = create<EtatViePratique>()(
  persist(
    (set, get) => {
      const relire = async (coupleId: string, moiId: string) => {
        const vue = await lireViePratique(coupleId);
        set({
          ...vue,
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      /** Serveur d'abord, état ensuite. Aucune écriture optimiste. */
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
        evenements: [],
        projets: [],
        initiatives: [],
        chargement: false,
        horsLigne: false,

        async charger(coupleId, moiId) {
          if (get().cachePour && get().cachePour !== moiId) {
            set({
              evenements: [],
              projets: [],
              initiatives: [],
              cachePour: moiId,
              synchroniseeLe: undefined,
            });
          }

          set({ chargement: true, erreur: undefined });
          try {
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({
                erreur: messageLisible(erreur),
                evenements: [],
                projets: [],
                initiatives: [],
              });
            }
          } finally {
            set({ chargement: false });
          }
        },

        ajouterEvenement: (coupleId, moiId, brouillon) =>
          ecrire(coupleId, moiId, () =>
            ajouterEvenementServeur(coupleId, brouillon),
          ),
        supprimerEvenement: (coupleId, moiId, id) =>
          ecrire(coupleId, moiId, () => supprimerEvenementServeur(coupleId, id)),

        creerProjet: (coupleId, moiId, titre, intention) =>
          ecrire(coupleId, moiId, () =>
            creerProjetServeur(coupleId, titre, intention),
          ),
        ajouterJalon: (coupleId, moiId, projetId, titre, echeance) =>
          ecrire(coupleId, moiId, () =>
            ajouterJalonServeur(coupleId, projetId, titre, echeance),
          ),
        cocherJalon: (coupleId, moiId, projetId, jalonId) =>
          ecrire(coupleId, moiId, () =>
            cocherJalonServeur(coupleId, projetId, jalonId),
          ),
        archiverProjet: (coupleId, moiId, projetId, archive) =>
          ecrire(coupleId, moiId, () =>
            archiverProjetServeur(coupleId, projetId, archive),
          ),

        proposerInitiative: (coupleId, moiId, titre, categorie) =>
          ecrire(coupleId, moiId, () =>
            proposerInitiativeServeur(coupleId, titre, categorie),
          ),
        programmerInitiative: (coupleId, moiId, id, prevuePour) =>
          ecrire(coupleId, moiId, () =>
            programmerInitiativeServeur(coupleId, id, prevuePour),
          ),
        vivreInitiative: (coupleId, moiId, id, souvenir) =>
          ecrire(coupleId, moiId, () =>
            vivreInitiativeServeur(coupleId, id, souvenir),
          ),
        supprimerInitiative: (coupleId, moiId, id) =>
          ecrire(coupleId, moiId, () => supprimerInitiativeServeur(coupleId, id)),

        vider: () =>
          set({
            evenements: [],
            projets: [],
            initiatives: [],
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.vie-pratique',
      storage: stockage,
      partialize: (e) => ({
        evenements: e.evenements,
        projets: e.projets,
        initiatives: e.initiatives,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);
