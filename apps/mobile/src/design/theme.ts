/**
 * Pont entre les tokens partagés et React Native.
 * Aucune couleur ni taille en dur ailleurs dans l'app : tout passe par ici.
 *
 * Les tailles de texte viennent d'`adaptatif.ts` plutôt que directement des
 * tokens : l'échelle du dessin d'origine dépassait sur les petits écrans.
 */
import {
  chrome,
  colors,
  degrades,
  durees,
  espacements,
  ombres,
  palette,
  rayons,
  typography,
} from '@lonlonbenu/shared';
import { interlignes, tailles } from './adaptatif';

export {
  chrome,
  colors,
  degrades,
  durees,
  espacements,
  ombres,
  palette,
  rayons,
  typography,
};
export {
  echelleTexteMax,
  estPetitEcran,
  estTresPetitEcran,
  largeurEcran,
  margeCarte,
  margeEcran,
} from './adaptatif';

export const polices = typography.familles;

/** Style de texte prêt à l'emploi, pour éviter les combinaisons approximatives. */
export const textes = {
  afficheXl: {
    fontFamily: polices.titre,
    fontSize: tailles.afficheXl,
    lineHeight: interlignes.afficheXl,
    color: colors.texte,
  },
  affiche: {
    fontFamily: polices.titre,
    fontSize: tailles.affiche,
    lineHeight: interlignes.affiche,
    color: colors.texte,
  },
  titre: {
    fontFamily: polices.titre,
    fontSize: tailles.titre,
    lineHeight: interlignes.titre,
    color: colors.texte,
  },
  sousTitre: {
    fontFamily: polices.corpsMoyen,
    fontSize: tailles.sousTitre,
    lineHeight: interlignes.sousTitre,
    color: colors.texte,
  },
  corps: {
    fontFamily: polices.corps,
    fontSize: tailles.corps,
    lineHeight: interlignes.corps,
    color: colors.texte,
  },
  corpsDoux: {
    fontFamily: polices.corps,
    fontSize: tailles.corps,
    lineHeight: interlignes.corps,
    color: colors.texteDoux,
  },
  petit: {
    fontFamily: polices.corps,
    fontSize: tailles.petit,
    lineHeight: interlignes.petit,
    color: colors.texteDoux,
  },
  meta: {
    fontFamily: polices.corps,
    fontSize: tailles.minuscule,
    lineHeight: interlignes.minuscule,
    color: colors.texteDoux,
  },
  surtitre: {
    fontFamily: polices.corpsFort,
    fontSize: tailles.minuscule,
    lineHeight: interlignes.minuscule,
    letterSpacing: typography.interlettrage.capitales,
    textTransform: 'uppercase',
    color: colors.accent,
  },
} as const;
