/**
 * Pôle ② — Score d'implication : le matériau de base.
 *
 * Un « geste » est un fait observable, déjà produit ailleurs dans l'app : un
 * message envoyé, une gratitude offerte, un check-in fait. Rien n'est mesuré
 * qui ne soit déjà une action volontaire du partenaire, et **aucun contenu
 * n'entre ici** — seulement le type du geste, son auteur et sa date.
 *
 * Règle structurante : **aucun geste ne pèse plus qu'un autre.** Il n'y a pas
 * de barème. Envoyer une lettre ne « vaut » pas trois messages, parce que
 * décider de ce qui compte le plus dans un couple n'est pas le rôle d'une app.
 * Le score ne regarde donc pas des quantités mais des rythmes : des jours où
 * quelque chose s'est passé, et une variété de façons de se rejoindre.
 *
 * Conséquence utile : le score ne se gonfle pas. Cinquante messages dans la
 * même journée comptent comme un seul jour vivant.
 */

import type { PartenaireId } from '../types/couple';

export type TypeGeste =
  | 'message'
  | 'note_douce'
  | 'humeur'
  | 'statut'
  | 'check_in'
  | 'gratitude'
  | 'lettre'
  | 'axe_ouvert'
  | 'axe_contribution';

export interface Geste {
  auteurId: PartenaireId;
  type: TypeGeste;
  /** ISO 8601. Seul le jour civil est utilisé. */
  faitLe: string;
}

export interface DefinitionGeste {
  code: TypeGeste;
  /** Formulé à la première personne : c'est ce que j'ai fait, pas une note. */
  libelle: string;
  /** Invitation employée par les suggestions privées. Jamais culpabilisante. */
  invitation: string;
}

export const GESTES: readonly DefinitionGeste[] = [
  {
    code: 'message',
    libelle: 'écrire un message',
    invitation: 'Un message, même court, suffit à faire signe.',
  },
  {
    code: 'note_douce',
    libelle: 'laisser une note douce',
    invitation:
      'Une note douce se glisse en un geste, sans ouvrir la conversation.',
  },
  {
    code: 'humeur',
    libelle: 'dire son humeur',
    invitation: 'Dire votre humeur du jour évite d’avoir à l’expliquer plus tard.',
  },
  {
    code: 'statut',
    libelle: 'partager un statut',
    invitation: 'Un statut dit où vous en êtes, sans avoir à raconter.',
  },
  {
    code: 'check_in',
    libelle: 'faire un check-in',
    invitation: 'Un check-in rassure sans qu’on ait à demander.',
  },
  {
    code: 'gratitude',
    libelle: 'offrir une gratitude',
    invitation: 'Un merci part en dix secondes et se garde longtemps.',
  },
  {
    code: 'lettre',
    libelle: 'envoyer une lettre',
    invitation: 'Une lettre attend le moment que vous choisissez.',
  },
  {
    code: 'axe_ouvert',
    libelle: 'ouvrir un axe',
    invitation: 'Un axe permet de poser un sujet sans en faire un reproche.',
  },
  {
    code: 'axe_contribution',
    libelle: 'déposer sa part sur un axe',
    invitation: 'Déposer votre part sur un axe ouvre la discussion des deux côtés.',
  },
] as const;

export function definitionGeste(code: TypeGeste): DefinitionGeste {
  const trouve = GESTES.find((g) => g.code === code);
  if (!trouve) throw new Error(`Geste inconnu : ${code}`);
  return trouve;
}
