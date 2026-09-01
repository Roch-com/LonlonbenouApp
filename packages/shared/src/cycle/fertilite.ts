/**
 * Pôle ④ — mode « désir d'enfant » (§8.13, P1).
 *
 * « Mode désir d'enfant optionnel mettant en avant les fenêtres de fertilité. »
 *
 * ## Ce mode ne dit jamais qu'un jour est perdu
 *
 * Un couple qui essaie d'avoir un enfant vit déjà avec assez de calendriers.
 * Une app qui annonce « aujourd'hui, c'est raté » ajouterait une pression à
 * une période qui n'en manque pas. Les textes de ce fichier nomment ce qui est
 * probable, jamais ce qui aurait dû être fait.
 *
 * ## Ce mode n'est pas une méthode
 *
 * L'avertissement médical du module s'applique entièrement : ce n'est ni un
 * avis médical, ni un moyen de contraception, ni une méthode fiable pour
 * obtenir ou éviter une grossesse. Une fenêtre calculée sur des cycles saisis
 * à la main a une marge de plusieurs jours, et le dire est plus utile que de
 * donner un chiffre net qui laisserait croire à une précision inexistante.
 *
 * ## Qui l'active
 *
 * La personne concernée, comme le niveau de partage. Le partenaire ne peut ni
 * l'activer ni le lire ailleurs que dans ce que le niveau autorise déjà : un
 * mode désir d'enfant visible d'un seul côté transformerait un projet commun
 * en attente surveillée.
 */

import { ajouterJours, joursEntre } from '../temps/jours';
import { jourOvulation, type Estimations } from './calcul';

/**
 * Jours fertiles avant l'ovulation.
 *
 * Les spermatozoïdes survivent jusqu'à cinq jours ; la fenêtre commence donc
 * bien avant le jour estimé, et c'est la partie que les calendriers grand
 * public ratent le plus souvent.
 */
const JOURS_AVANT = 5;

/** Après, la fenêtre se referme vite : l'ovule vit environ un jour. */
const JOURS_APRES = 1;

export interface FenetreFertile {
  /** `YYYY-MM-DD` — premier jour de la fenêtre estimée. */
  debut: string;
  /** `YYYY-MM-DD` — dernier jour. */
  fin: string;
  /** Jour d'ovulation estimé, au milieu de la fenêtre. */
  ovulation: string;
}

/** Fenêtre estimée pour un cycle commencé à `debutRegles`. */
export function fenetreFertile(
  debutRegles: string,
  estimations: Estimations,
): FenetreFertile {
  // `jourOvulation` compte à partir de 1 : le premier jour des règles est le
  // jour 1, donc le décalage est d'un jour de moins.
  const ovulation = ajouterJours(debutRegles, jourOvulation(estimations) - 1);
  return {
    debut: ajouterJours(ovulation, -JOURS_AVANT),
    fin: ajouterJours(ovulation, JOURS_APRES),
    ovulation,
  };
}

export type PositionFenetre = 'avant' | 'dedans' | 'apres';

export interface LectureFertilite {
  position: PositionFenetre;
  fenetre: FenetreFertile;
  /** Jours jusqu'au début de la fenêtre. Négatif une fois dedans ou après. */
  joursAvantDebut: number;
  /** Phrase prête à afficher. Jamais une injonction. */
  lecture: string;
  /** Rappel de ce que vaut cette estimation. Toujours affiché avec elle. */
  reserve: string;
}

export const RESERVE_FERTILITE =
  'Cette fenêtre est estimée à partir de vos cycles saisis : elle a une marge de plusieurs jours et ne remplace ni un avis médical, ni un suivi de fertilité.';

/**
 * Où en est le cycle par rapport à la fenêtre.
 *
 * Aucune formulation n'emploie l'impératif ni ne suggère une conduite. Ce
 * module situe ; ce que le couple en fait ne le regarde pas.
 */
export function lectureFertilite(
  debutRegles: string,
  estimations: Estimations,
  maintenant: string = new Date().toISOString(),
): LectureFertilite {
  const fenetre = fenetreFertile(debutRegles, estimations);
  const jour = maintenant.slice(0, 10);

  const joursAvantDebut = joursEntre(jour, fenetre.debut);
  const apres = joursEntre(fenetre.fin, jour) > 0;

  if (apres) {
    return {
      position: 'apres',
      fenetre,
      joursAvantDebut,
      lecture:
        'La fenêtre estimée de ce cycle est passée. La suivante viendra avec les prochaines règles.',
      reserve: RESERVE_FERTILITE,
    };
  }

  if (joursAvantDebut > 0) {
    return {
      position: 'avant',
      fenetre,
      joursAvantDebut,
      lecture:
        joursAvantDebut === 1
          ? 'La fenêtre estimée commence demain.'
          : `La fenêtre estimée commence dans ${joursAvantDebut} jours.`,
      reserve: RESERVE_FERTILITE,
    };
  }

  return {
    position: 'dedans',
    fenetre,
    joursAvantDebut,
    // Constat, pas consigne : « c'est le moment » se lit comme un ordre.
    lecture: 'Vous êtes dans la fenêtre estimée de ce cycle.',
    reserve: RESERVE_FERTILITE,
  };
}
