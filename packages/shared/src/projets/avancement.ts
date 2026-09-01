/**
 * Pôle ③ — Avancement des projets.
 *
 * Un projet de couple avance ou n'avance pas ; **personne** n'avance plus que
 * l'autre. Il n'existe donc volontairement aucune fonction qui compte les
 * jalons par partenaire : ce serait un classement individuel déguisé en barre
 * de progression, exactement ce que le pôle ② s'interdit pour le score.
 *
 * `Jalon.faitPar` est conservé pour afficher qui a coché *un* jalon donné —
 * information utile et anodine — mais rien ne l'agrège.
 */

import { joursEntre } from '../temps/jours';
import type { Jalon, Projet } from '../types/projets';

export type EtatProjet = 'a_lancer' | 'en_cours' | 'termine' | 'archive';

export interface Avancement {
  total: number;
  faits: number;
  /** 0 à 100. Vaut 0 sur un projet sans jalon : rien n'est encore découpé. */
  pourcentage: number;
  etat: EtatProjet;
  prochainJalon?: Jalon;
  /** Jalons dont l'échéance est passée sans qu'ils soient faits. */
  enRetard: Jalon[];
}

export function jalonFait(jalon: Jalon): boolean {
  return !!jalon.faitLe;
}

export function avancementProjet(
  projet: Projet,
  maintenant: string = new Date().toISOString(),
): Avancement {
  const total = projet.jalons.length;
  const faits = projet.jalons.filter(jalonFait).length;
  const pourcentage = total === 0 ? 0 : Math.round((faits / total) * 100);

  const restants = projet.jalons.filter((j) => !jalonFait(j));

  // Le prochain jalon est le plus proche par échéance ; ceux sans date passent
  // après, dans l'ordre où ils ont été posés.
  const prochainJalon =
    [...restants].sort((a, b) => {
      if (a.echeance && b.echeance) return a.echeance.localeCompare(b.echeance);
      if (a.echeance) return -1;
      if (b.echeance) return 1;
      return 0;
    })[0] ?? undefined;

  const enRetard = restants.filter(
    (j) => j.echeance !== undefined && joursEntre(j.echeance, maintenant) > 0,
  );

  return {
    total,
    faits,
    pourcentage,
    etat: etatProjet(projet, total, faits),
    prochainJalon,
    enRetard,
  };
}

function etatProjet(projet: Projet, total: number, faits: number): EtatProjet {
  if (projet.archiveLe) return 'archive';
  if (total > 0 && faits === total) return 'termine';
  if (faits > 0) return 'en_cours';
  return 'a_lancer';
}

export const LIBELLES_ETAT_PROJET: Record<EtatProjet, string> = {
  a_lancer: 'À lancer',
  en_cours: 'En cours',
  termine: 'Terminé',
  archive: 'Archivé',
};

/** Bascule un jalon. Recocher un jalon déjà fait le décoche. */
export function basculerJalon(
  projet: Projet,
  jalonId: string,
  parId: string,
  maintenant: string = new Date().toISOString(),
): Projet {
  return {
    ...projet,
    jalons: projet.jalons.map((jalon) => {
      if (jalon.id !== jalonId) return jalon;
      if (jalonFait(jalon)) {
        const { faitLe: _, faitPar: __, ...reste } = jalon;
        return reste;
      }
      return { ...jalon, faitLe: maintenant, faitPar: parId };
    }),
  };
}

/** Projets vivants d'abord, terminés ensuite, archivés à la fin. */
export function trierProjets(
  projets: readonly Projet[],
  maintenant: string = new Date().toISOString(),
): Projet[] {
  const rang: Record<EtatProjet, number> = {
    en_cours: 0,
    a_lancer: 1,
    termine: 2,
    archive: 3,
  };
  return [...projets].sort(
    (a, b) =>
      rang[avancementProjet(a, maintenant).etat] -
      rang[avancementProjet(b, maintenant).etat],
  );
}

export interface EcheanceProjet {
  projetId: string;
  projetTitre: string;
  jalon: Jalon;
}

/**
 * La prochaine échéance de projet, tous projets confondus (§8.1).
 *
 * Le tableau de bord en résume une seule : c'est un écran d'accueil, pas une
 * liste de tâches. Le module Projets porte le détail.
 *
 * Les projets archivés sont écartés, et les jalons sans date aussi — une
 * échéance qui n'en est pas une n'a rien à annoncer. Un jalon déjà en retard
 * est **gardé** : c'est justement celui qu'il faut voir, et le masquer
 * reviendrait à faire disparaître ce qu'on a laissé filer.
 */
export function prochaineEcheanceProjet(
  projets: readonly Projet[],
): EcheanceProjet | undefined {
  const candidates: EcheanceProjet[] = [];

  for (const projet of projets) {
    if (projet.archiveLe) continue;
    for (const jalon of projet.jalons) {
      if (jalonFait(jalon) || !jalon.echeance) continue;
      candidates.push({
        projetId: projet.id,
        projetTitre: projet.titre,
        jalon,
      });
    }
  }

  // Le titre départage deux échéances du même jour, pour que le tableau de
  // bord n'en change pas d'un rendu à l'autre.
  return candidates.sort((a, b) =>
    a.jalon.echeance === b.jalon.echeance
      ? a.projetTitre.localeCompare(b.projetTitre)
      : a.jalon.echeance!.localeCompare(b.jalon.echeance!),
  )[0];
}
