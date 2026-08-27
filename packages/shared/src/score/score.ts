/**
 * Pôle ② — Score d'implication.
 *
 * Quatre garde-fous, tenus par la forme même de l'API et vérifiés dans
 * `score.test.ts` :
 *
 * 1. **Ce n'est jamais une note d'une personne.** Le score porte sur des
 *    rythmes de gestes observables, pas sur des qualités. Aucun geste ne pèse
 *    plus qu'un autre, et il n'existe volontairement **aucune fonction qui
 *    renvoie un score individuel** — ni pour soi, ni a fortiori pour l'autre.
 *
 * 2. **Le score de couple est unique.** `scoreDuCouple` ne prend pas de
 *    lecteur en paramètre : il est structurellement impossible d'en afficher
 *    une version différente à l'un et à l'autre. Pas de classement, pas de
 *    colonne « vous / lui ».
 *
 * 3. **Les suggestions sont privées et autoréférentielles.** Elles ne
 *    déclenchent aucune notification, et elles ne se fondent que sur mon propre
 *    retrait par rapport à mon propre passé — jamais sur une comparaison avec
 *    l'autre. Si mon partenaire s'éloigne, ce n'est pas à moi qu'on le
 *    signale, et ce n'est pas à moi de le rattraper.
 *
 * 4. **Aucune série à ne pas rompre.** Pas de « streak », pas de compte à
 *    rebours : un mécanisme qui punit l'oubli fabrique de l'anxiété, pas du
 *    lien.
 */

import { joursEntre } from '../temps/jours';
import type { PartenaireId } from '../types/couple';
import { definitionGeste, GESTES, type Geste, type TypeGeste } from './gestes';

/** Deux semaines : assez long pour lisser une mauvaise semaine, assez court pour rester vrai. */
export const FENETRE_JOURS = 14;

/** Nombre de façons différentes de se rejoindre au-delà duquel la variété est pleine. */
const SEUIL_VARIETE = 4;

/** En deçà, on ne suggère rien : le geste est encore frais. */
const SEUIL_DORMANCE_JOURS = 5;

/** Écart de jours actifs à partir duquel une tendance personnelle est réelle. */
const SEUIL_TENDANCE_JOURS = 2;

const MAX_SUGGESTIONS = 2;

// ---------------------------------------------------------------- score couple

export type CodeComposante = 'regularite' | 'elan_partage' | 'variete';

export interface Composante {
  code: CodeComposante;
  libelle: string;
  explication: string;
  /** 0 à 100. */
  valeur: number;
  /** Part dans le score final. */
  poids: number;
}

export type BandeScore = 'vif' | 'regulier' | 'discret' | 'silencieux';

export interface ScoreCouple {
  /** 0 à 100. Secondaire à l'affichage : c'est la bande qui parle. */
  valeur: number;
  bande: BandeScore;
  libelle: string;
  composantes: readonly Composante[];
  fenetreJours: number;
  /** Jours de la fenêtre où au moins un geste a eu lieu. */
  joursVivants: number;
}

const POIDS: Record<CodeComposante, number> = {
  regularite: 0.45,
  elan_partage: 0.35,
  variete: 0.2,
};

/** Index du jour d'un geste : 0 = aujourd'hui, 1 = hier… */
function reculEnJours(geste: Geste, maintenant: string): number {
  return joursEntre(geste.faitLe, maintenant);
}

function dansLaFenetre(
  gestes: readonly Geste[],
  maintenant: string,
  debut: number,
  fin: number,
): Geste[] {
  return gestes.filter((g) => {
    const recul = reculEnJours(g, maintenant);
    return recul >= debut && recul < fin;
  });
}

function joursDistincts(gestes: readonly Geste[], maintenant: string): number {
  return new Set(gestes.map((g) => reculEnJours(g, maintenant))).size;
}

/**
 * Score du couple sur la fenêtre glissante.
 *
 * Aucun paramètre de lecteur : les deux partenaires voient exactement le même
 * objet, toujours. C'est le point 2 des garde-fous, garanti par la signature.
 */
export function scoreDuCouple(
  gestes: readonly Geste[],
  partenaires: readonly [PartenaireId, PartenaireId],
  maintenant: string = new Date().toISOString(),
  fenetre: number = FENETRE_JOURS,
): ScoreCouple {
  const fenetreGestes = dansLaFenetre(gestes, maintenant, 0, fenetre);

  const joursVivants = joursDistincts(fenetreGestes, maintenant);
  const regularite = (joursVivants / fenetre) * 100;

  const [a, b] = partenaires;
  const joursA = joursDistincts(
    fenetreGestes.filter((g) => g.auteurId === a),
    maintenant,
  );
  const joursB = joursDistincts(
    fenetreGestes.filter((g) => g.auteurId === b),
    maintenant,
  );
  const plusActif = Math.max(joursA, joursB);
  // Équilibre entre les deux rythmes, sans jamais dire lequel est lequel.
  const elanPartage =
    plusActif === 0 ? 0 : (Math.min(joursA, joursB) / plusActif) * 100;

  const typesUtilises = new Set(fenetreGestes.map((g) => g.type)).size;
  const variete = Math.min(typesUtilises / SEUIL_VARIETE, 1) * 100;

  const composantes: Composante[] = [
    {
      code: 'regularite',
      libelle: 'Régularité',
      explication: 'Des gestes répartis dans le temps, plutôt que par à-coups.',
      valeur: Math.round(regularite),
      poids: POIDS.regularite,
    },
    {
      code: 'elan_partage',
      libelle: 'Élan partagé',
      explication: 'Vous avez été deux à faire des gestes sur la période.',
      valeur: Math.round(elanPartage),
      poids: POIDS.elan_partage,
    },
    {
      code: 'variete',
      libelle: 'Variété',
      explication: 'Plusieurs façons différentes de se rejoindre.',
      valeur: Math.round(variete),
      poids: POIDS.variete,
    },
  ];

  const valeur = Math.round(
    regularite * POIDS.regularite +
      elanPartage * POIDS.elan_partage +
      variete * POIDS.variete,
  );

  const bande = bandeDe(valeur);

  return {
    valeur,
    bande,
    libelle: LIBELLES_BANDE[bande],
    composantes,
    fenetreJours: fenetre,
    joursVivants,
  };
}

function bandeDe(valeur: number): BandeScore {
  if (valeur >= 75) return 'vif';
  if (valeur >= 50) return 'regulier';
  if (valeur >= 25) return 'discret';
  return 'silencieux';
}

/**
 * Micro-copy des bandes. Aucune ne reproche quoi que ce soit, et la plus basse
 * rappelle que l'app mesure l'app — pas le couple.
 */
export const LIBELLES_BANDE: Record<BandeScore, string> = {
  vif: 'Vous vous êtes beaucoup rejoints ces temps-ci.',
  regulier: 'Vous vous rejoignez régulièrement.',
  discret: 'Le lien est passé plus discrètement par ici.',
  silencieux: 'Il ne s’est presque rien passé dans l’app ces derniers jours.',
};

// ------------------------------------------------------------- élan personnel

export type Tendance = 'en_hausse' | 'stable' | 'en_retrait';

export interface MonElan {
  tendance: Tendance;
  /** Mes jours actifs sur la fenêtre courante. */
  joursActifs: number;
  /** Mes jours actifs sur la fenêtre précédente, pour me situer par rapport à moi. */
  joursActifsAvant: number;
}

/**
 * Mon propre rythme, comparé à mon propre passé — jamais à celui de l'autre.
 * Destiné à n'être affiché qu'à la personne concernée.
 */
export function monElan(
  gestes: readonly Geste[],
  moiId: PartenaireId,
  maintenant: string = new Date().toISOString(),
  fenetre: number = FENETRE_JOURS,
): MonElan {
  const miens = gestes.filter((g) => g.auteurId === moiId);

  const joursActifs = joursDistincts(
    dansLaFenetre(miens, maintenant, 0, fenetre),
    maintenant,
  );
  const joursActifsAvant = joursDistincts(
    dansLaFenetre(miens, maintenant, fenetre, fenetre * 2),
    maintenant,
  );

  const ecart = joursActifs - joursActifsAvant;
  const tendance: Tendance =
    ecart <= -SEUIL_TENDANCE_JOURS
      ? 'en_retrait'
      : ecart >= SEUIL_TENDANCE_JOURS
        ? 'en_hausse'
        : 'stable';

  return { tendance, joursActifs, joursActifsAvant };
}

// -------------------------------------------------------- suggestions privées

export interface SuggestionPrivee {
  geste: TypeGeste;
  texte: string;
}

/**
 * Ordre de repli quand plusieurs gestes dorment depuis aussi longtemps : on
 * propose d'abord le plus léger. Suggérer « ouvre un axe de croissance » à
 * quelqu'un qui s'éloigne serait à contretemps.
 */
const ORDRE_DOUCEUR: readonly TypeGeste[] = [
  'note_douce',
  'gratitude',
  'humeur',
  'statut',
  'message',
  'check_in',
  'lettre',
  'axe_contribution',
  'axe_ouvert',
];

/**
 * Suggestions à n'afficher qu'à `moiId`, sans notification, sans trace visible
 * par l'autre.
 *
 * Elles n'apparaissent que si je me suis retiré par rapport à moi-même. Un
 * couple simplement peu actif depuis toujours n'est pas relancé : ce serait du
 * harcèlement, pas de l'aide. Et le retrait de l'autre ne déclenche jamais rien
 * chez moi — je n'ai pas à porter son rythme.
 */
export function suggestionsPrivees(
  gestes: readonly Geste[],
  moiId: PartenaireId,
  maintenant: string = new Date().toISOString(),
  fenetre: number = FENETRE_JOURS,
): SuggestionPrivee[] {
  const elan = monElan(gestes, moiId, maintenant, fenetre);
  if (elan.tendance !== 'en_retrait') return [];

  const miens = gestes.filter((g) => g.auteurId === moiId);
  const horizon = fenetre * 2;

  const candidats = GESTES.map((definition) => {
    const dernier = miens
      .filter((g) => g.type === definition.code)
      .map((g) => reculEnJours(g, maintenant))
      .filter((recul) => recul >= 0)
      .sort((x, y) => x - y)[0];

    // Jamais fait ≡ dormant depuis l'horizon, pas depuis l'infini : sinon un
    // geste jamais tenté passerait systématiquement devant une habitude perdue.
    const dormance = dernier === undefined ? horizon : Math.min(dernier, horizon);
    return { code: definition.code, dormance };
  }).filter((c) => c.dormance >= SEUIL_DORMANCE_JOURS);

  return candidats
    .sort(
      (x, y) =>
        y.dormance - x.dormance ||
        ORDRE_DOUCEUR.indexOf(x.code) - ORDRE_DOUCEUR.indexOf(y.code),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => ({ geste: c.code, texte: definitionGeste(c.code).invitation }));
}
