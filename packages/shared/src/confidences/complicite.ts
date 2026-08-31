/**
 * Pôle ② — questions de complicité (§8.6 du cahier).
 *
 * « Questions de complicité quotidiennes/hebdomadaires avec réponses partagées
 * une fois les deux réponses reçues. »
 *
 * ## La règle du miroir, encore
 *
 * C'est le même mécanisme que les axes de croissance : rien ne se lit avant
 * que les deux aient répondu. Ce n'est pas un jeu de suspense, c'est ce qui
 * empêche la seconde réponse d'être écrite en fonction de la première. Une
 * réponse lue d'avance n'est plus une réponse, c'est un commentaire.
 *
 * ## Le choix de la question
 *
 * Elle est **dérivée du jour**, identique pour les deux, et non tirée au sort
 * par le premier qui ouvre l'app. Sans cela, chacun répondrait à une question
 * différente et la mise en regard n'aurait aucun sens.
 *
 * ## Le ton des questions
 *
 * Aucune ne demande d'évaluer l'autre, ni de comparer. Une question de couple
 * qui commence par « qu'est-ce que tu changerais chez… » n'ouvre pas une
 * conversation, elle ouvre un procès — et le pôle ② a déjà les axes de
 * croissance pour ce qui doit changer, avec le cadre qui va avec.
 */

import { joursEntre } from '../temps/jours';
import type { PartenaireId } from '../types/couple';

export interface QuestionComplicite {
  id: string;
  texte: string;
}

/**
 * Banque de questions.
 *
 * Elles portent sur le concret et le passé plutôt que sur des promesses : « la
 * dernière fois que » se répond, « comment vois-tu notre avenir » se subit.
 */
export const QUESTIONS: readonly QuestionComplicite[] = [
  { id: 'q01', texte: 'Quel geste de ces derniers jours t’a fait du bien ?' },
  { id: 'q02', texte: 'Qu’est-ce qui t’a fait rire récemment, chez nous ?' },
  { id: 'q03', texte: 'De quoi as-tu le plus besoin en ce moment ?' },
  { id: 'q04', texte: 'Quel moment de notre semaine tu garderais ?' },
  { id: 'q05', texte: 'Qu’est-ce qui te pèse en ce moment, hors de nous ?' },
  { id: 'q06', texte: 'Une chose que tu aimerais qu’on fasse bientôt ?' },
  { id: 'q07', texte: 'Qu’est-ce qui t’a manqué cette semaine ?' },
  { id: 'q08', texte: 'De quoi es-tu fier·e, ces temps-ci ?' },
  { id: 'q09', texte: 'Qu’est-ce que je fais qui te rassure ?' },
  { id: 'q10', texte: 'Quelle habitude à nous tu aimerais garder longtemps ?' },
  { id: 'q11', texte: 'Qu’est-ce que tu n’oses pas me demander ?' },
  { id: 'q12', texte: 'Un souvenir de nous qui t’est revenu récemment ?' },
  { id: 'q13', texte: 'Comment tu te sens, là, maintenant ?' },
  { id: 'q14', texte: 'Qu’est-ce qui t’aiderait, cette semaine ?' },
] as const;

/** Point de départ de la rotation. Une date fixe rend le choix reproductible. */
const ORIGINE = '2026-01-01';

/**
 * Question du jour, la même pour les deux.
 *
 * Dérivée de la date et non tirée au sort : deux téléphones doivent tomber sur
 * la même, sinon les réponses ne se répondent pas.
 */
export function questionDuJour(jour: string): QuestionComplicite {
  const index = Math.abs(joursEntre(ORIGINE, jour)) % QUESTIONS.length;
  return QUESTIONS[index]!;
}

export interface ReponseComplicite {
  partenaireId: PartenaireId;
  /** Scellée : c'est du texte intime, comme tout le pôle ②. */
  texteScelle: string;
  repondeLe: string;
}

export interface EchangeComplicite {
  questionId: string;
  jour: string;
  reponses: readonly ReponseComplicite[];
}

export type EtatEchange =
  | 'personne'
  | 'moi_seul'
  | 'lui_seul'
  | 'les_deux';

export interface VueEchange {
  question: QuestionComplicite;
  etat: EtatEchange;
  /** Ma réponse, toujours visible : c'est la mienne. */
  mienne?: ReponseComplicite;
  /** Celle de l'autre, **seulement** une fois les deux reçues. */
  sienne?: ReponseComplicite;
  lecture: string;
}

/**
 * Ce qu'une personne voit de l'échange du jour.
 *
 * `sienne` reste absente tant que les deux n'ont pas répondu. Le filtrage est
 * fait ici, dans le modèle partagé, pour que le serveur rejoue exactement la
 * même règle et qu'aucun écran n'ait à se souvenir de la masquer.
 */
export function vueEchange(
  echange: EchangeComplicite | undefined,
  jour: string,
  moiId: PartenaireId,
): VueEchange {
  const question = questionDuJour(jour);
  const mienne = echange?.reponses.find((r) => r.partenaireId === moiId);
  const autre = echange?.reponses.find((r) => r.partenaireId !== moiId);

  if (mienne && autre) {
    return {
      question,
      etat: 'les_deux',
      mienne,
      sienne: autre,
      lecture: 'Vous avez répondu tous les deux.',
    };
  }
  if (mienne) {
    return {
      question,
      etat: 'moi_seul',
      mienne,
      lecture:
        'Votre réponse est enregistrée. Elle s’ouvrira quand l’autre aura répondu — pas avant, pour qu’aucune ne s’écrive en fonction de l’autre.',
    };
  }
  if (autre) {
    return {
      question,
      etat: 'lui_seul',
      // Volontairement absente : la connaître d'avance changerait la réponse.
      lecture:
        'Une réponse vous attend. Elle s’ouvrira quand vous aurez écrit la vôtre.',
    };
  }
  return {
    question,
    etat: 'personne',
    lecture: 'La question du jour. À vous deux, chacun de son côté.',
  };
}
