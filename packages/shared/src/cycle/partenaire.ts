/**
 * Pôle ④ — Ce que le partenaire voit, selon le niveau choisi par la personne
 * concernée. **Seule porte de lecture côté partenaire** : aucun écran ne lit
 * l'état du cycle directement.
 *
 * Le niveau n'est pas un filtre d'affichage posé après coup, c'est ce qui
 * détermine la forme même de l'objet rendu. Un niveau `discret` ne renvoie
 * aucun champ de phase : il n'y a rien à oublier de masquer.
 *
 * Trois choses ne sortent jamais d'ici en P0, quel que soit le niveau :
 * les symptômes, les notes personnelles et les dates. Le niveau `complet`
 * (niveau 3) est déclaré mais pas ouvert ; tant qu'il ne l'est pas, il est
 * traité comme le niveau 2. Sous-partager est une erreur réparable, l'inverse
 * ne l'est pas.
 */

import {
  definitionPhase,
  RAPPEL_AU_PARTENAIRE,
  type CodePhase,
  type NiveauCycle,
} from '../types/cycle';
import type { EtatCycle } from './calcul';

export type VuePartenaire =
  | { niveau: 'aucun'; partage: false }
  | {
      niveau: 'discret';
      partage: true;
      /** Seul signal transmis : ces jours-ci méritent un peu plus d'attention. */
      jourAttentionne: boolean;
      lecture: string;
      rappel: string;
    }
  | {
      niveau: 'phases';
      partage: true;
      phase: CodePhase;
      libellePhase: string;
      lecture: string;
      attentions: readonly string[];
      rappel: string;
    };

const LECTURE_DISCRETE_ATTENTIONNEE =
  'Ces jours-ci méritent sans doute un peu plus d’attention que d’habitude.';
const LECTURE_DISCRETE_ORDINAIRE =
  'Rien de particulier à signaler ces jours-ci.';

/** Phases sur lesquelles le niveau discret allume son unique signal. */
const PHASES_ATTENTIONNEES: readonly CodePhase[] = ['menstruelle', 'spm'];

export function vuePartenaire(
  etat: EtatCycle | undefined,
  niveau: NiveauCycle,
): VuePartenaire {
  if (niveau === 'aucun' || !etat) return { niveau: 'aucun', partage: false };

  if (niveau === 'discret') {
    const jourAttentionne = PHASES_ATTENTIONNEES.includes(etat.phase);
    return {
      niveau: 'discret',
      partage: true,
      jourAttentionne,
      lecture: jourAttentionne
        ? LECTURE_DISCRETE_ATTENTIONNEE
        : LECTURE_DISCRETE_ORDINAIRE,
      rappel: RAPPEL_AU_PARTENAIRE,
    };
  }

  // `phases`, et `complet` tant que le niveau 3 n'est pas ouvert.
  const definition = definitionPhase(etat.phase);
  return {
    niveau: 'phases',
    partage: true,
    phase: etat.phase,
    libellePhase: definition.libelle,
    lecture: definition.lecturePartenaire,
    attentions: definition.attentions,
    rappel: RAPPEL_AU_PARTENAIRE,
  };
}
