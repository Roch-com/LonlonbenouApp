/**
 * Pôle ③ — Vie pratique partagée, côté serveur.
 *
 * Le rejeu est plus direct que les tranches précédentes, et c'est normal : ces
 * données sont `couple` **par construction**. Un agenda commun, des projets
 * communs, des sorties communes — il n'y a pas de consentement mutuel à
 * vérifier, pas de miroir à faire jouer, pas de niveau de partage.
 *
 * Reste donc le seul contrôle qui compte ici : **appartenance au couple, et
 * couple non dissocié**. Les fonctions de lecture du partagé (`trierProjets`,
 * `journal`, `evenementsAVenir`) restent côté client : elles n'ont rien à
 * cacher, seulement à ordonner.
 *
 * Deux règles héritées du modèle et conservées telles quelles :
 *   - `visibilite` vaut toujours `couple`, posé par le serveur, jamais reçu du
 *     client. Le projet surprise (P1) sera la seule exception ;
 *   - **rien n'est jamais agrégé par personne.** `faitPar` est conservé pour
 *     afficher qui a coché *un* jalon donné ; aucun décompte ne s'en déduit.
 */

import { randomUUID } from 'node:crypto';
import {
  basculerJalon,
  marquerVecue,
  programmer,
  type CategorieEvenement,
  type CategorieSortie,
  type Evenement,
  type Initiative,
  type Jalon,
  type PartenaireId,
  type Projet,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusViePratique =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'donnees_invalides'
  | 'introuvable';

export interface VueViePratique {
  evenements: Evenement[];
  projets: Projet[];
  initiatives: Initiative[];
}

type Resultat<T = undefined> = {
  ok: boolean;
  motif?: RefusViePratique;
  valeur?: T;
};

export interface ServiceViePratique {
  lire(coupleId: string, lecteurId: PartenaireId): Promise<Resultat<VueViePratique>>;

  ajouterEvenement(
    coupleId: string,
    moiId: PartenaireId,
    brouillon: {
      titre: string;
      categorie: CategorieEvenement;
      debut: string;
      fin?: string;
      journeeEntiere: boolean;
      lieu?: string;
      note?: string;
      rappelHeures?: number;
    },
  ): Promise<Resultat<Evenement>>;
  supprimerEvenement(
    coupleId: string,
    moiId: PartenaireId,
    id: string,
  ): Promise<Resultat>;

  creerProjet(
    coupleId: string,
    moiId: PartenaireId,
    titre: string,
    intention?: string,
  ): Promise<Resultat<Projet>>;
  ajouterJalon(
    coupleId: string,
    moiId: PartenaireId,
    projetId: string,
    titre: string,
    echeance?: string,
  ): Promise<Resultat<Projet>>;
  cocherJalon(
    coupleId: string,
    moiId: PartenaireId,
    projetId: string,
    jalonId: string,
  ): Promise<Resultat<Projet>>;
  archiverProjet(
    coupleId: string,
    moiId: PartenaireId,
    projetId: string,
    archive: boolean,
  ): Promise<Resultat<Projet>>;

  proposerInitiative(
    coupleId: string,
    moiId: PartenaireId,
    titre: string,
    categorie: CategorieSortie,
  ): Promise<Resultat<Initiative>>;
  programmerInitiative(
    coupleId: string,
    moiId: PartenaireId,
    id: string,
    prevuePour: string,
  ): Promise<Resultat<Initiative>>;
  vivreInitiative(
    coupleId: string,
    moiId: PartenaireId,
    id: string,
    souvenir?: string,
  ): Promise<Resultat<Initiative>>;
  supprimerInitiative(
    coupleId: string,
    moiId: PartenaireId,
    id: string,
  ): Promise<Resultat>;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusViePratique }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceViePratique(depot: Depot): ServiceViePratique {
  /** Enchaîne le contrôle d'accès et l'opération, pour ne pas l'oublier. */
  async function avecAcces<T>(
    coupleId: string,
    moiId: PartenaireId,
    operation: () => Promise<Resultat<T>>,
  ): Promise<Resultat<T>> {
    const acces = await autoriser(depot, coupleId, moiId);
    if ('motif' in acces) return { ok: false, motif: acces.motif };
    return operation();
  }

  return {
    lire: (coupleId, lecteurId) =>
      avecAcces(coupleId, lecteurId, async () => ({
        ok: true,
        valeur: {
          evenements: await depot.viePratique.evenements(coupleId),
          projets: await depot.viePratique.projets(coupleId),
          initiatives: await depot.viePratique.initiatives(coupleId),
        },
      })),

    ajouterEvenement: (coupleId, moiId, brouillon) =>
      avecAcces(coupleId, moiId, async () => {
        if (!brouillon.titre.trim() || !brouillon.debut) {
          return { ok: false, motif: 'donnees_invalides' };
        }

        const evenement: Evenement = {
          id: randomUUID(),
          titre: brouillon.titre.trim(),
          categorie: brouillon.categorie,
          debut: brouillon.debut,
          fin: brouillon.fin,
          journeeEntiere: brouillon.journeeEntiere,
          lieu: brouillon.lieu?.trim() || undefined,
          note: brouillon.note?.trim() || undefined,
          creePar: moiId,
          creeLe: new Date().toISOString(),
          // Posé par le serveur, jamais reçu du client.
          visibilite: 'couple',
          rappelHeures: brouillon.rappelHeures,
        };
        await depot.viePratique.enregistrerEvenement(coupleId, evenement);
        return { ok: true, valeur: evenement };
      }),

    supprimerEvenement: (coupleId, moiId, id) =>
      avecAcces(coupleId, moiId, async () => {
        await depot.viePratique.supprimerEvenement(coupleId, id);
        return { ok: true };
      }),

    creerProjet: (coupleId, moiId, titre, intention) =>
      avecAcces(coupleId, moiId, async () => {
        const propre = titre.trim();
        if (!propre) return { ok: false, motif: 'donnees_invalides' };

        const projet: Projet = {
          id: randomUUID(),
          titre: propre,
          intention: intention?.trim() || undefined,
          jalons: [],
          creePar: moiId,
          creeLe: new Date().toISOString(),
        };
        await depot.viePratique.enregistrerProjet(coupleId, projet);
        return { ok: true, valeur: projet };
      }),

    ajouterJalon: (coupleId, moiId, projetId, titre, echeance) =>
      avecAcces(coupleId, moiId, async () => {
        const propre = titre.trim();
        if (!propre) return { ok: false, motif: 'donnees_invalides' };
        if (echeance !== undefined && !FORMAT_JOUR.test(echeance)) {
          return { ok: false, motif: 'donnees_invalides' };
        }

        const projet = await depot.viePratique.projetParId(coupleId, projetId);
        if (!projet) return { ok: false, motif: 'introuvable' };

        const jalon: Jalon = { id: randomUUID(), titre: propre, echeance };
        const misAJour = { ...projet, jalons: [...projet.jalons, jalon] };
        await depot.viePratique.enregistrerProjet(coupleId, misAJour);
        return { ok: true, valeur: misAJour };
      }),

    cocherJalon: (coupleId, moiId, projetId, jalonId) =>
      avecAcces(coupleId, moiId, async () => {
        const projet = await depot.viePratique.projetParId(coupleId, projetId);
        if (!projet) return { ok: false, motif: 'introuvable' };

        // `basculerJalon` vient du partagé : recocher décoche, et rien d'autre
        // ne peut modifier l'état d'un jalon.
        const misAJour = basculerJalon(projet, jalonId, moiId);
        await depot.viePratique.enregistrerProjet(coupleId, misAJour);
        return { ok: true, valeur: misAJour };
      }),

    archiverProjet: (coupleId, moiId, projetId, archive) =>
      avecAcces(coupleId, moiId, async () => {
        const projet = await depot.viePratique.projetParId(coupleId, projetId);
        if (!projet) return { ok: false, motif: 'introuvable' };

        const { archiveLe: _, ...sansArchive } = projet;
        const misAJour = archive
          ? { ...projet, archiveLe: new Date().toISOString() }
          : sansArchive;
        await depot.viePratique.enregistrerProjet(coupleId, misAJour);
        return { ok: true, valeur: misAJour };
      }),

    proposerInitiative: (coupleId, moiId, titre, categorie) =>
      avecAcces(coupleId, moiId, async () => {
        const propre = titre.trim();
        if (!propre) return { ok: false, motif: 'donnees_invalides' };

        const initiative: Initiative = {
          id: randomUUID(),
          titre: propre,
          categorie,
          etat: 'idee',
          proposeePar: moiId,
          proposeeLe: new Date().toISOString(),
        };
        await depot.viePratique.enregistrerInitiative(coupleId, initiative);
        return { ok: true, valeur: initiative };
      }),

    programmerInitiative: (coupleId, moiId, id, prevuePour) =>
      avecAcces(coupleId, moiId, async () => {
        if (!FORMAT_JOUR.test(prevuePour)) {
          return { ok: false, motif: 'donnees_invalides' };
        }
        const initiative = await depot.viePratique.initiativeParId(coupleId, id);
        if (!initiative) return { ok: false, motif: 'introuvable' };

        const misAJour = programmer(initiative, prevuePour);
        await depot.viePratique.enregistrerInitiative(coupleId, misAJour);
        return { ok: true, valeur: misAJour };
      }),

    vivreInitiative: (coupleId, moiId, id, souvenir) =>
      avecAcces(coupleId, moiId, async () => {
        const initiative = await depot.viePratique.initiativeParId(coupleId, id);
        if (!initiative) return { ok: false, motif: 'introuvable' };

        const misAJour = marquerVecue(initiative, souvenir);
        await depot.viePratique.enregistrerInitiative(coupleId, misAJour);
        return { ok: true, valeur: misAJour };
      }),

    supprimerInitiative: (coupleId, moiId, id) =>
      avecAcces(coupleId, moiId, async () => {
        await depot.viePratique.supprimerInitiative(coupleId, id);
        return { ok: true };
      }),
  };
}
