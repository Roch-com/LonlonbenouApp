/** Pôle ① — Compteur du couple (P0). Calculs purs, testables, sans fuseau. */

import { ajouterJours, jourUtc, joursEntre, MS_PAR_JOUR } from '../temps/jours';

/** Nombre de jours écoulés depuis `depuis`. Le jour même vaut 0. */
export function joursEnsemble(depuis: string, maintenant: string): number {
  return joursEntre(depuis, maintenant);
}

export type TypeJalonCompteur = 'centaine' | 'millier' | 'anniversaire';

export interface JalonCompteur {
  type: TypeJalonCompteur;
  libelle: string;
  /** Jour d'atteinte, compté depuis `depuis`. */
  jour: number;
  dateIso: string;
  joursRestants: number;
}

function anniversaireEnJours(depuis: string, annees: number): number {
  const [a, m, j] = depuis.slice(0, 10).split('-').map(Number);
  const cible = Date.UTC(a! + annees, m! - 1, j!);
  return Math.round((cible - jourUtc(depuis)) / MS_PAR_JOUR);
}

/** Prochain jalon à fêter : centaine, millier ou anniversaire, le plus proche. */
export function prochainJalon(depuis: string, maintenant: string): JalonCompteur {
  const jours = joursEnsemble(depuis, maintenant);

  const candidats: Omit<JalonCompteur, 'dateIso' | 'joursRestants'>[] = [
    {
      type: 'centaine',
      jour: (Math.floor(jours / 100) + 1) * 100,
      libelle: '',
    },
    {
      type: 'millier',
      jour: (Math.floor(jours / 1000) + 1) * 1000,
      libelle: '',
    },
  ];

  const anneesEcoulees = Math.floor(jours / 365.25);
  for (let n = anneesEcoulees; n <= anneesEcoulees + 2; n++) {
    const jour = anniversaireEnJours(depuis, n);
    if (jour > jours) {
      candidats.push({
        type: 'anniversaire',
        jour,
        libelle: `${n} an${n > 1 ? 's' : ''} ensemble`,
      });
      break;
    }
  }

  const gagnant = candidats.reduce((meilleur, c) =>
    c.jour < meilleur.jour ? c : meilleur,
  );

  return {
    type: gagnant.type,
    jour: gagnant.jour,
    libelle: gagnant.libelle || `${gagnant.jour} jours ensemble`,
    dateIso: ajouterJours(depuis, gagnant.jour),
    joursRestants: gagnant.jour - jours,
  };
}

/** Formatage « 1 247 » — espace fine insécable, cohérent avec le ton premium. */
export function formaterJours(jours: number): string {
  return jours.toLocaleString('fr-FR').replace(/ | /g, ' ');
}
