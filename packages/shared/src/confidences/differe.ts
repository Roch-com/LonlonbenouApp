/**
 * Pôle ② — brouillon différé de 24 h (§8.6 du cahier).
 *
 * ## À quoi sert d'attendre
 *
 * « Brouillon privé avec envoi différé de 24h. » Ce qui s'écrit à chaud se
 * relit rarement pareil le lendemain. Le délai n'est pas une friction : c'est
 * la fonctionnalité. Il rend impossible ce que le cahier veut éviter — les
 * choses « dites à chaud » qui font partie du constat de départ (§2.1).
 *
 * ## Ce que le délai ne fait pas
 *
 * Il n'empêche pas d'effacer. On peut renoncer à tout moment, et c'est
 * important : une lettre qu'on ne peut plus retirer serait une contrainte, pas
 * un garde-fou. Ce qui est retenu, c'est l'envoi, jamais le renoncement.
 *
 * Il ne s'applique qu'aux lettres qui le demandent. Une gratitude écrite le
 * matin n'a aucune raison d'attendre le lendemain : le délai protège de la
 * colère, pas de l'élan.
 */

export const DELAI_REFLEXION_MS = 24 * 60 * 60_000;

export interface EtatDiffere {
  /** Vrai quand le délai est écoulé et que l'envoi est possible. */
  pret: boolean;
  /** Millisecondes restantes. Zéro dès que c'est prêt. */
  restantMs: number;
  /** Phrase prête à afficher, jamais impatiente. */
  lecture: string;
}

/**
 * Où en est un brouillon mis de côté.
 *
 * @param demandeLe Instant où la personne a demandé le report. Absent = le
 * brouillon n'est pas différé et part quand elle veut.
 */
export function etatDiffere(
  demandeLe: string | undefined,
  maintenant: string = new Date().toISOString(),
): EtatDiffere {
  if (!demandeLe) {
    return { pret: true, restantMs: 0, lecture: 'Prête à partir quand vous voulez.' };
  }

  const depuis = Date.parse(demandeLe);
  const instant = Date.parse(maintenant);

  // Horodatage illisible : on ne retient pas une lettre pour une donnée qu'on
  // ne sait pas lire. Bloquer sur une erreur de format serait absurde.
  if (Number.isNaN(depuis) || Number.isNaN(instant)) {
    return { pret: true, restantMs: 0, lecture: 'Prête à partir quand vous voulez.' };
  }

  const restantMs = Math.max(0, depuis + DELAI_REFLEXION_MS - instant);
  if (restantMs === 0) {
    return {
      pret: true,
      restantMs: 0,
      lecture:
        'Vous l’avez écrite hier. Relisez-la : si elle dit encore ce que vous vouliez dire, elle peut partir.',
    };
  }

  return {
    pret: false,
    restantMs,
    lecture: `Mise de côté jusqu’à demain — encore ${heuresLisibles(restantMs)}. Vous pouvez la modifier ou l’effacer entre-temps.`,
  };
}

function heuresLisibles(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.ceil(minutes / 60);
  return heures === 1 ? 'une heure' : `${heures} h`;
}
