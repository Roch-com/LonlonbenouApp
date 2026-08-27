/**
 * Design tokens LONLONBENU.
 * Source unique de vérité pour l'identité visuelle — mobile, web et futurs supports.
 * Ton recherché : premium, glamour, fluide. Jamais utilitaire ou froid.
 */

export const palette = {
  or: '#9C7A3C',
  orFonce: '#6E5424',
  orClair: '#C9A96A',
  rose: '#B85C6B',
  roseClair: '#E3B7BE',
  ivoire: '#FBF6EC',
  ivoireOmbre: '#F2E9D8',
  encre: '#2B2420',
  encreDouce: '#6B5F55',
  encreVoilee: '#9A8E84',
  blanc: '#FFFFFF',
  /** Fond des surfaces posées sur l'ivoire, à peine détaché. */
  creme: '#FDFAF4',
  sable: '#EFE4CE',
} as const;

/** Couleurs sémantiques : ce que le code consomme au quotidien. */
export const colors = {
  fond: palette.ivoire,
  fondEleve: palette.blanc,
  fondNuance: palette.ivoireOmbre,

  texte: palette.encre,
  texteDoux: palette.encreDouce,
  texteInverse: palette.ivoire,

  accent: palette.or,
  accentFonce: palette.orFonce,
  accentDoux: palette.orClair,

  tendresse: palette.rose,
  tendresseDouce: palette.roseClair,

  fondCreme: palette.creme,

  texteVoile: palette.encreVoilee,

  bordure: 'rgba(43, 36, 32, 0.10)',
  bordureNette: 'rgba(43, 36, 32, 0.16)',
  bordureOr: 'rgba(156, 122, 60, 0.28)',
  voile: 'rgba(43, 36, 32, 0.55)',
  /** Surbrillance d'un élément pressé, sur fond clair. */
  effleurement: 'rgba(156, 122, 60, 0.10)',

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
  /** Fond général : ivoire qui se réchauffe vers le bas. */
  fond: [palette.ivoire, palette.creme, palette.ivoireOmbre] as const,
  /** En-tête d'application, sous le texte sombre. */
  chrome: ['rgba(251,246,236,0.98)', 'rgba(242,233,216,0.92)'] as const,
  /** Bouton et accents actifs. */
  or: [palette.orClair, palette.or, palette.orFonce] as const,
  /** Cartes de mise en avant. */
  tendresse: [palette.roseClair, palette.rose] as const,
  /** Voile du haut vers le bas, pour détacher une barre flottante. */
  estompeBas: [
    'rgba(251,246,236,0)',
    'rgba(251,246,236,0.9)',
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
