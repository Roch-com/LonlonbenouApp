/**
 * Pont entre les tokens partagés et React Native.
 * Aucune couleur ni taille en dur ailleurs dans l'app : tout passe par ici.
 */
import {
  colors,
  durees,
  espacements,
  ombres,
  palette,
  rayons,
  typography,
} from '@lonlonbenu/shared';

export { colors, durees, espacements, ombres, palette, rayons, typography };

export const polices = typography.familles;

/** Style de texte prêt à l'emploi, pour éviter les combinaisons approximatives. */
export const textes = {
  afficheXl: {
    fontFamily: polices.titre,
    fontSize: typography.tailles.afficheXl,
    lineHeight: typography.interlignes.afficheXl,
    color: colors.texte,
  },
  affiche: {
    fontFamily: polices.titre,
    fontSize: typography.tailles.affiche,
    lineHeight: typography.interlignes.affiche,
    color: colors.texte,
  },
  titre: {
    fontFamily: polices.titre,
    fontSize: typography.tailles.titre,
    lineHeight: typography.interlignes.titre,
    color: colors.texte,
  },
  sousTitre: {
    fontFamily: polices.corpsMoyen,
    fontSize: typography.tailles.sousTitre,
    lineHeight: typography.interlignes.sousTitre,
    color: colors.texte,
  },
  corps: {
    fontFamily: polices.corps,
    fontSize: typography.tailles.corps,
    lineHeight: typography.interlignes.corps,
    color: colors.texte,
  },
  corpsDoux: {
    fontFamily: polices.corps,
    fontSize: typography.tailles.corps,
    lineHeight: typography.interlignes.corps,
    color: colors.texteDoux,
  },
  petit: {
    fontFamily: polices.corps,
    fontSize: typography.tailles.petit,
    lineHeight: typography.interlignes.petit,
    color: colors.texteDoux,
  },
  meta: {
    fontFamily: polices.corps,
    fontSize: typography.tailles.minuscule,
    lineHeight: typography.interlignes.minuscule,
    color: colors.texteDoux,
  },
  surtitre: {
    fontFamily: polices.corpsFort,
    fontSize: typography.tailles.minuscule,
    lineHeight: typography.interlignes.minuscule,
    letterSpacing: typography.interlettrage.capitales,
    textTransform: 'uppercase',
    color: colors.accent,
  },
} as const;
