/**
 * Pôle ④ — Complicité & connexion : rappel doux (§8.14).
 *
 * « Rappels doux en cas de période de distanciation prolongée détectée via les
 * autres modules (initiatives, chat). »
 *
 * ## La fonctionnalité la plus facile à rater du cahier
 *
 * Un rappel de ce genre devient culpabilisant en une phrase. Quatre règles le
 * tiennent, et elles ne sont pas négociables :
 *
 * 1. **Aucune attribution.** Jamais « votre partenaire n’a rien proposé
 *    depuis ». Les signaux sont des faits du couple, pas de l’un des deux, et
 *    le texte ne nomme personne. Attribuer ferait de ce module un instrument
 *    de reproche, ce que le garde-fou de bienveillance interdit.
 * 2. **Strictement symétrique.** Les deux reçoivent le même texte au même
 *    moment. Un rappel envoyé à un seul serait une observation à sens unique,
 *    et le cahier n’en veut nulle part.
 * 3. **Aucun chiffre.** On ne dit pas « 23 jours ». Un compteur transforme une
 *    invitation en bilan, et un bilan appelle une justification.
 * 4. **Rare.** Les seuils sont hauts et se cumulent. Une semaine calme est une
 *    semaine calme, pas un signal — les couples ont le droit d’être occupés.
 *
 * ## Ce qui n’est pas observé
 *
 * Aucun contenu. Ni les messages, ni les réponses, ni les confidences : c’est
 * scellé, et le resterait même si ce module en avait l’usage. On ne compte que
 * des dates de dernière activité, que le couple pourrait retrouver lui-même.
 */

import { rituelDuJour, rituelsSuggeres, type Rituel } from './rituels';
import type { LangageAmour } from './langages';

export interface SignauxDistance {
  /** Jours depuis la dernière initiative vécue à deux. */
  joursSansInitiative?: number;
  /** Jours depuis le dernier échange dans la conversation. */
  joursSansMessage?: number;
  /** Jours depuis le dernier moment noté au calendrier commun. */
  joursSansMomentPartage?: number;
}

/**
 * Seuils hauts, et volontairement.
 *
 * Trois semaines sans rien vécu ensemble n’est pas un accident de calendrier ;
 * dix jours sans un mot dans la conversation non plus. En dessous, on se tait.
 */
const SEUIL_INITIATIVE = 21;
const SEUIL_MESSAGE = 10;
const SEUIL_MOMENT = 30;

export interface InvitationReconnexion {
  /** Une suggestion concrète, pour que l’invitation ne reste pas en l’air. */
  rituel: Rituel;
  /** Le texte, identique pour les deux. Sans chiffre, sans nom. */
  lecture: string;
}

/**
 * L’invitation à se retrouver, s’il y a lieu.
 *
 * Rend `undefined` la plupart du temps, et c’est le comportement attendu.
 *
 * Deux signaux sont exigés plutôt qu’un : une conversation calme pendant des
 * vacances passées ensemble ne veut rien dire, et une période chargée sans
 * sortie non plus. C’est leur conjonction qui commence à en dire quelque
 * chose — et même alors, on se contente de proposer un moment.
 */
export function inviterReconnexion(
  signaux: SignauxDistance,
  jour: string,
  langagesDeLautre?: readonly LangageAmour[],
): InvitationReconnexion | undefined {
  const franchis = [
    (signaux.joursSansInitiative ?? 0) >= SEUIL_INITIATIVE,
    (signaux.joursSansMessage ?? 0) >= SEUIL_MESSAGE,
    (signaux.joursSansMomentPartage ?? 0) >= SEUIL_MOMENT,
  ].filter(Boolean).length;

  if (franchis < 2) return undefined;

  // Le rituel du jour sert de repli : il est le même des deux côtés, ce que la
  // symétrie exige. Le tri par langage ne change ce choix qu'une fois les deux
  // questionnaires faits — donc de la même façon pour les deux.
  const tries = rituelsSuggeres(langagesDeLautre);
  const rituel = langagesDeLautre?.length ? tries[0]! : rituelDuJour(jour);

  return {
    rituel,
    lecture:
      'Ces temps-ci ont été chargés. Si l’envie est là, voici une idée pour se retrouver un moment.',
  };
}
