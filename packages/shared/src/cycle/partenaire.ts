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

/**
 * Pourquoi il n’y a rien à montrer. Sans cette précision, le niveau `aucun`
 * confond trois situations que le partenaire doit pouvoir distinguer :
 * personne ne suit de cycle ici, la personne concernée n’en partage rien, ou
 * elle en partage mais n’a encore rien saisi. Les confondre laisse croire que
 * le module n’est pas configuré alors qu’il l’est, et conduit à proposer à
 * l’autre de se déclarer à la place de la personne concernée.
 *
 * Le dire n’est pas une entorse à la règle du pôle : le niveau courant a
 * toujours été lisible par les deux, précisément pour que personne ne croie
 * voir plus qu’il ne voit. On ne cache pas l’état, on ne commente pas les
 * changements — ce sont deux choses différentes.
 */
export type RaisonSansPartage =
  /** Personne n’a déclaré suivre un cycle dans ce couple. */
  | 'non_declare'
  /** Le cycle est suivi ; le niveau de partage est resté à `aucun`. */
  | 'sans_partage'
  /** Le niveau autorise un partage, mais aucune règle n’est encore saisie. */
  | 'sans_donnees';

export type VuePartenaire =
  | { niveau: 'aucun'; partage: false; raison: RaisonSansPartage }
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
const LECTURE_DISCRETE_ORDINAIRE = 'Rien de particulier à signaler ces jours-ci.';

/** Phases sur lesquelles le niveau discret allume son unique signal. */
const PHASES_ATTENTIONNEES: readonly CodePhase[] = ['menstruelle', 'spm'];

export function vuePartenaire(
  etat: EtatCycle | undefined,
  niveau: NiveauCycle,
  /** Faux quand personne n’a encore été déclaré comme suivant son cycle. */
  declare = true,
): VuePartenaire {
  if (!declare) return { niveau: 'aucun', partage: false, raison: 'non_declare' };
  if (niveau === 'aucun') {
    return { niveau: 'aucun', partage: false, raison: 'sans_partage' };
  }
  // Le niveau autorise quelque chose, mais il n’y a rien à projeter encore.
  if (!etat) return { niveau: 'aucun', partage: false, raison: 'sans_donnees' };

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
