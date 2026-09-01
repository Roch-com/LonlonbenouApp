/**
 * Pôle ② — recommandation douce d’un parcours (§8.7).
 *
 * « Recommandation douce d’un parcours pertinent en fonction de l’activité
 * observée dans les autres modules (ex. accumulation d’axes de croissance sur
 * la communication). »
 *
 * ## Douce, littéralement
 *
 * Trois règles tiennent ce mot :
 *
 * 1. **Une seule à la fois.** Proposer trois parcours revient à dire au couple
 *    que tout va mal. On garde le signal le plus net et on tait le reste.
 * 2. **Un seuil, pas un frémissement.** Un axe ouvert sur la communication est
 *    une conversation ; trois en sont un motif. En dessous du seuil, on ne dit
 *    rien — se taire est une réponse acceptable.
 * 3. **Un motif observable, jamais un diagnostic.** Le texte dit ce qui a été
 *    remarqué (« trois axes ouverts sur ce thème »), pas ce que ça signifie du
 *    couple. La différence entre « vous avez souvent ouvert ce sujet » et
 *    « vous communiquez mal » est tout ce qui sépare une suggestion d’un
 *    jugement.
 *
 * ## Ce qui n’entre pas ici
 *
 * Rien qui vienne du contenu des messages ou des réponses : c’est scellé, et
 * le resterait même si ce module en avait l’usage. On ne travaille que sur des
 * dénombrements que le couple pourrait faire lui-même.
 */

import type { ThemeAxe } from '../types/croissance';
import { PARCOURS, type Parcours, type ThemeParcours } from './catalogue';

/**
 * Ce que les autres modules observent, sans rien lire d’intime.
 *
 * Tous les champs sont facultatifs : un module éteint ne doit pas empêcher la
 * recommandation de fonctionner sur les autres signaux.
 */
export interface SignauxParcours {
  /** Axes de croissance encore ouverts, comptés par thème. */
  axesOuverts?: Partial<Record<ThemeAxe, number>>;
  /** Le mode « désir d’enfant » est actif dans le module Cycle. */
  desirEnfant?: boolean;
  /** Le budget du mois a été dépassé, ce mois-ci et le précédent. */
  budgetDepasseDeSuite?: number;
  /** Parcours déjà commencés ou terminés : on ne les repropose pas. */
  dejaEngages?: readonly string[];
}

export interface RecommandationParcours {
  parcours: Parcours;
  /** Ce qui a été remarqué. Factuel, jamais interprété. */
  motif: string;
  /** L’invitation elle-même, refusable sans conséquence. */
  invitation: string;
}

/** Trois axes sur un même thème : en deçà, on ne propose rien. */
const SEUIL_AXES = 3;

/** Deux mois de suite dans le rouge, pour ne pas réagir à un mois atypique. */
const SEUIL_BUDGET = 2;

/**
 * Correspondance des thèmes d’axes vers les parcours.
 *
 * Volontairement partielle. « Temps ensemble », « famille » et « intimité »
 * n’ont pas de parcours qui leur corresponde vraiment ; les rattacher de force
 * au plus proche donnerait une suggestion à côté du sujet, ce qui est pire que
 * pas de suggestion du tout.
 */
const THEME_VERS_PARCOURS: Partial<Record<ThemeAxe, ThemeParcours>> = {
  communication: 'communication',
  quotidien: 'charge_mentale',
};

const premierDuTheme = (
  theme: ThemeParcours,
  dejaEngages: readonly string[],
): Parcours | undefined =>
  PARCOURS.find((p) => p.theme === theme && !dejaEngages.includes(p.id));

/**
 * Le parcours à proposer, s’il y a lieu.
 *
 * Rend `undefined` la plupart du temps, et c’est le comportement attendu :
 * une application qui a toujours quelque chose à suggérer finit par n’être
 * plus écoutée.
 */
export function recommanderParcours(
  signaux: SignauxParcours,
): RecommandationParcours | undefined {
  const dejaEngages = signaux.dejaEngages ?? [];

  // Le désir d'enfant passe devant : c'est une décision datée, pas une
  // tendance de fond, et elle a une fenêtre pendant laquelle elle se discute.
  if (signaux.desirEnfant) {
    const parcours = premierDuTheme('desir_enfant', dejaEngages);
    if (parcours) {
      return {
        parcours,
        motif: 'Vous avez activé le mode désir d’enfant.',
        invitation:
          'Il existe un parcours pour en parler à deux, si vous en avez envie.',
      };
    }
  }

  // Le signal le plus fort l'emporte, et lui seul.
  const axes = signaux.axesOuverts ?? {};
  let meilleur: { theme: ThemeParcours; compte: number } | undefined;
  for (const [themeAxe, compte] of Object.entries(axes)) {
    const theme = THEME_VERS_PARCOURS[themeAxe as ThemeAxe];
    if (!theme || (compte ?? 0) < SEUIL_AXES) continue;
    if (!meilleur || compte! > meilleur.compte) {
      meilleur = { theme, compte: compte! };
    }
  }

  if (meilleur) {
    const parcours = premierDuTheme(meilleur.theme, dejaEngages);
    if (parcours) {
      return {
        parcours,
        motif: `Vous avez ${meilleur.compte} axes ouverts sur ce thème.`,
        invitation:
          'Un parcours court existe là-dessus. À voir, ou pas — rien ne presse.',
      };
    }
  }

  if ((signaux.budgetDepasseDeSuite ?? 0) >= SEUIL_BUDGET) {
    const parcours = premierDuTheme('argent', dejaEngages);
    if (parcours) {
      return {
        parcours,
        motif: 'Le budget a été dépassé plusieurs mois de suite.',
        invitation:
          'Un parcours aide à en parler avant les chiffres. Quand vous voulez.',
      };
    }
  }

  return undefined;
}
