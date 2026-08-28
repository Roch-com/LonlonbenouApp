/**
 * Design tokens LONLONBENU.
 * Source unique de vérité pour l'identité visuelle — mobile, web et futurs supports.
 * Ton recherché : premium, glamour, fluide. Jamais utilitaire ou froid.
 */

export const palette = {
  /**
   * Bleu d'encre. Le piège du bleu est de virer « application bancaire » ;
   * ces valeurs tirent vers la nuit plutôt que vers l'azur, et le rose poudré
   * conservé plus bas se charge de la chaleur.
   */
  bleu: '#1D4E89',
  bleuFonce: '#123661',
  bleuClair: '#7BA7DC',
  encre: '#0F1D30',
  encreDouce: '#4A5B72',
  encreVoilee: '#7C8CA3',

  /**
   * Or, désormais accent secondaire. Il ne sert plus qu'aux moments rares —
   * le compteur, les jalons — et c'est ce qui lui rend sa valeur : une couleur
   * qu'on voit partout n'est plus un accent.
   *
   * `or` ne descend pas sous `#A98A4C` : en dessous, l'encre posée dessus
   * tombe à 3,82 de contraste, sous le seuil des 4,5.
   */
  or: '#A98A4C',
  orFonce: '#8A6E38',
  orClair: '#C9A96A',

  rose: '#A8455A',
  roseClair: '#F0D9DE',

  /** Fonds : des bleus si désaturés qu'on les prend pour du neutre. */
  ivoire: '#F5F8FC',
  ivoireOmbre: '#DEE8F4',
  blanc: '#FFFFFF',
  creme: '#FAFCFE',
  sable: '#E9F0F8',
} as const;

/** Couleurs sémantiques : ce que le code consomme au quotidien. */
export const colors = {
  fond: palette.ivoire,
  fondEleve: palette.blanc,
  fondNuance: palette.ivoireOmbre,
  fondCreme: palette.creme,

  texte: palette.encre,
  texteDoux: palette.encreDouce,
  texteVoile: palette.encreVoilee,
  /** Sur l'accent bleu foncé du mode clair, c'est le blanc qui se lit. */
  texteInverse: palette.blanc,

  accent: palette.bleu,
  accentFonce: palette.bleuFonce,
  accentDoux: palette.bleuClair,

  /** Accent secondaire : réservé au compteur et aux jalons. */
  or: palette.or,
  orClair: palette.orClair,
  orFonce: palette.orFonce,

  tendresse: palette.rose,
  tendresseDouce: palette.roseClair,

  /**
   * Texte posé sur une surface dorée. L'or reste clair dans les deux thèmes :
   * c'est l'encre qui tient dessus, pas la lumière. Mêmes valeurs de part et
   * d'autre, et c'est voulu.
   */
  texteSurAccent: '#2B2420',
  texteSurAccentDoux: 'rgba(43, 36, 32, 0.74)',
  bordureSurAccent: 'rgba(43, 36, 32, 0.20)',

  bordure: 'rgba(15, 29, 48, 0.10)',
  bordureNette: 'rgba(15, 29, 48, 0.16)',
  bordureOr: 'rgba(29, 78, 137, 0.28)',
  voile: 'rgba(15, 29, 48, 0.55)',
  effleurement: 'rgba(29, 78, 137, 0.10)',

  /** Réservé au SOS. Jamais utilisé pour du décoratif. */
  urgence: '#C0392B',
} as const;

export const typography = {
  familles: {
    /** Titres — serif élégante. */
    titre: 'CormorantGaramond_600SemiBold',
    titreItalique: 'CormorantGaramond_500Medium_Italic',
    /** Contenu — sans-serif lisible. */
    corps: 'Manrope_400Regular',
    corpsMoyen: 'Manrope_500Medium',
    corpsFort: 'Manrope_600SemiBold',
  },
  tailles: {
    afficheXl: 44,
    affiche: 34,
    titre: 26,
    sousTitre: 20,
    corps: 16,
    petit: 14,
    minuscule: 12,
  },
  interlignes: {
    afficheXl: 50,
    affiche: 40,
    titre: 32,
    sousTitre: 26,
    corps: 24,
    petit: 20,
    minuscule: 16,
  },
  /** Lettrage légèrement ouvert pour les libellés en capitales. */
  interlettrage: {
    capitales: 1.6,
    normal: 0,
  },
} as const;

export const espacements = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const rayons = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  rond: 999,
} as const;

/**
 * Trois niveaux de profondeur, pas un de plus.
 *
 * Android n'a qu'`elevation` et la traduit en ombre grise : une valeur trop
 * haute salit l'ivoire. On la garde basse et on laisse `shadowColor` teinté
 * faire le travail sur iOS, où l'ombre peut être chaude plutôt que grise.
 */
export const ombres = {
  /** Repose à peine — barres, champs, éléments de liste. */
  effleuree: {
    shadowColor: palette.encre,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  carte: {
    shadowColor: palette.encre,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  flottant: {
    shadowColor: palette.encre,
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
} as const;

/**
 * Dégradés de marque. Tableaux de deux à trois arrêts, prêts pour
 * `expo-linear-gradient`.
 *
 * Ils portent l'essentiel du caractère premium : une surface unie est neutre,
 * une surface qui glisse d'un ton à l'autre a de la matière. À réserver aux
 * grandes zones — fond d'écran, en-tête, bouton principal — jamais sur du
 * texte ni sur des éléments répétés, où l'effet devient bruit.
 */
export const degrades = {
  /** Fond général : bleu très pâle qui se réchauffe à peine vers le bas. */
  fond: [palette.ivoire, palette.creme, palette.sable] as const,
  chrome: ['rgba(245,248,252,0.98)', 'rgba(233,240,248,0.92)'] as const,
  /** Boutons et surfaces actives : l'accent principal. */
  accent: ['#2A63A8', palette.bleu, palette.bleuFonce] as const,
  /**
   * Le doré, réservé aux moments rares. Il ne descend pas sous `or` : plus
   * sombre, l'encre posée dessus passerait sous le seuil de contraste.
   */
  or: [palette.orClair, '#BC9C5C', palette.or] as const,
  tendresse: [palette.roseClair, palette.rose] as const,
  estompeBas: [
    'rgba(245,248,252,0)',
    'rgba(245,248,252,0.9)',
    palette.ivoire,
  ] as const,
} as const;

/**
 * Hauteurs du chrome. Fixées ici parce que les écrans doivent réserver
 * exactement la place que la barre occupe : une valeur devinée au jugé fait
 * disparaître le dernier bouton sous la barre d'onglets.
 */
export const chrome = {
  barreOnglets: 62,
  enTete: 56,
  /** Zone tactile minimale — recommandation d'accessibilité, non négociable. */
  toucheMin: 44,
} as const;

export const durees = {
  rapide: 150,
  normale: 250,
  douce: 400,
} as const;

/**
 * Palette du mode sombre.
 *
 * Ce n'est pas l'inverse mathématique du mode clair, et cela ne peut pas
 * l'être. Trois ajustements que l'inversion seule ne donne pas :
 *
 *  - **L'or s'éclaircit.** À luminosité égale, `#9C7A3C` sur fond sombre perd
 *    tout éclat et vire au brun terne. L'accent monte donc vers `#D4AE6A`.
 *  - **L'ivoire ne devient pas blanc pur.** Un texte `#FFFFFF` sur fond très
 *    sombre produit un halo qui fatigue à la lecture ; on s'arrête à `#EDE4D6`.
 *  - **Le fond reste chaud.** Un gris neutre trahirait l'identité de la marque ;
 *    ces bruns très sombres gardent la chaleur de l'ivoire d'origine.
 */
export const paletteSombre = {
  /**
   * Le bleu s'éclaircit franchement : à luminosité égale, `#1D4E89` sur fond
   * nocturne devient une tache sourde qu'on distingue à peine du fond.
   */
  bleu: '#6FA8E8',
  bleuFonce: '#9CC6F2',
  bleuClair: '#33598C',

  encre: '#E7EDF6',
  encreDouce: '#A6B4C8',
  encreVoilee: '#77869B',

  /** L'or s'éclaircit pour la même raison, et reste lisible sous l'encre. */
  or: '#D4AE6A',
  orFonce: '#B08E4E',
  orClair: '#E8CE9B',

  rose: '#DE8B9B',
  roseClair: '#5C2F38',

  /** Fonds : bleus nocturnes, jamais des gris — le gris trahirait la marque. */
  ivoire: '#0B1320',
  ivoireOmbre: '#1B2739',
  blanc: '#141F30',
  creme: '#0F1826',
  sable: '#22304A',
} as const;

/** Couleurs sémantiques du mode sombre, mêmes clés que le mode clair. */
export const colorsSombre = {
  fond: paletteSombre.ivoire,
  fondEleve: paletteSombre.blanc,
  fondNuance: paletteSombre.ivoireOmbre,
  fondCreme: paletteSombre.creme,

  texte: paletteSombre.encre,
  texteDoux: paletteSombre.encreDouce,
  texteVoile: paletteSombre.encreVoilee,
  /** Sur le bleu clair du mode sombre, c'est l'encre qui se lit. */
  texteInverse: palette.encre,

  accent: paletteSombre.bleu,
  accentFonce: paletteSombre.bleuFonce,
  accentDoux: paletteSombre.bleuClair,

  or: paletteSombre.or,
  orClair: paletteSombre.orClair,
  orFonce: paletteSombre.orFonce,

  tendresse: paletteSombre.rose,
  tendresseDouce: paletteSombre.roseClair,

  // Mêmes valeurs qu'en mode clair : l'or ne s'assombrit pas avec le thème.
  texteSurAccent: '#2B2420',
  texteSurAccentDoux: 'rgba(43, 36, 32, 0.74)',
  bordureSurAccent: 'rgba(43, 36, 32, 0.20)',

  // Sur fond sombre, une bordure noire est invisible : elles s'éclaircissent.
  bordure: 'rgba(231, 237, 246, 0.12)',
  bordureNette: 'rgba(231, 237, 246, 0.20)',
  bordureOr: 'rgba(111, 168, 232, 0.35)',
  voile: 'rgba(0, 0, 0, 0.70)',
  effleurement: 'rgba(111, 168, 232, 0.14)',

  /** Réservé au SOS. Éclairci pour rester lisible sur fond sombre. */
  urgence: '#F0665A',
} as const;

/** Dégradés du mode sombre. */
export const degradesSombre = {
  fond: [
    paletteSombre.ivoire,
    paletteSombre.creme,
    paletteSombre.ivoireOmbre,
  ] as const,
  chrome: ['rgba(11,19,32,0.98)', 'rgba(27,39,57,0.92)'] as const,
  accent: [paletteSombre.bleuFonce, paletteSombre.bleu, '#5290CE'] as const,
  or: [paletteSombre.orClair, paletteSombre.or, paletteSombre.orFonce] as const,
  tendresse: [paletteSombre.roseClair, paletteSombre.rose] as const,
  estompeBas: [
    'rgba(11,19,32,0)',
    'rgba(11,19,32,0.9)',
    paletteSombre.ivoire,
  ] as const,
} as const;

/**
 * Un thème complet : ce que consomme l'application à l'exécution.
 *
 * Les valeurs sont élargies en `string` : `as const` fige chaque couleur en
 * type littéral, ce qui rendrait le thème sombre incompatible avec le clair
 * alors que c'est précisément leur interchangeabilité qu'on cherche. Les clés,
 * elles, restent contraintes — oublier une couleur dans une palette doit se
 * voir à la compilation.
 */
export type JeuDeCouleurs = Record<keyof typeof colors, string>;
export type Degrade = readonly [string, string, ...string[]];
export type JeuDeDegrades = Record<keyof typeof degrades, Degrade>;

export interface Theme {
  mode: 'clair' | 'sombre';
  colors: JeuDeCouleurs;
  degrades: JeuDeDegrades;
}

export const themeClair: Theme = { mode: 'clair', colors, degrades };
export const themeSombre: Theme = {
  mode: 'sombre',
  colors: colorsSombre,
  degrades: degradesSombre,
};

export const themes = { clair: themeClair, sombre: themeSombre } as const;

export const tokens = {
  palette,
  colors,
  typography,
  espacements,
  rayons,
  ombres,
  degrades,
  chrome,
  durees,
} as const;

export type Tokens = typeof tokens;
