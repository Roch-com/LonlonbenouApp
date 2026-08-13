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
  blanc: '#FFFFFF',
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

  bordure: 'rgba(43, 36, 32, 0.10)',
  voile: 'rgba(43, 36, 32, 0.55)',

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

export const ombres = {
  carte: {
    shadowColor: palette.encre,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  flottant: {
    shadowColor: palette.encre,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
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
  durees,
} as const;

export type Tokens = typeof tokens;
