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

/**
 * Couleur de chaque variante, par clé de palette. Résolue à l'exécution : c'est
 * ce qui permet au même style de servir en clair comme en sombre.
 */
export const couleurParVariante = {
  afficheXl: 'texte',
  affiche: 'texte',
  titre: 'texte',
  sousTitre: 'texte',
  corps: 'texte',
  corpsDoux: 'texteDoux',
  petit: 'texteDoux',
  meta: 'texteDoux',
  surtitre: 'accent',
} as const;

/**
 * Styles de texte — **police, taille, interligne, rien d'autre**.
 *
 * La couleur en est délibérément absente. Elle y était, et c'est ce qui rendait
 * tout le texte illisible en mode sombre : cet objet est construit au
 * chargement du module, avec la palette claire, et figeait donc l'encre sombre
 * dans chaque variante. `Texte` applique la couleur à l'exécution, depuis le
 * thème actif.
 */
export const textes = {
  afficheXl: {
    fontFamily: polices.titre,
    fontSize: tailles.afficheXl,
    lineHeight: interlignes.afficheXl,
  },
  affiche: {
    fontFamily: polices.titre,
    fontSize: tailles.affiche,
    lineHeight: interlignes.affiche,
  },
  titre: {
    fontFamily: polices.titre,
    fontSize: tailles.titre,
    lineHeight: interlignes.titre,
  },
  sousTitre: {
    fontFamily: polices.corpsMoyen,
    fontSize: tailles.sousTitre,
    lineHeight: interlignes.sousTitre,
  },
  corps: {
    fontFamily: polices.corps,
    fontSize: tailles.corps,
    lineHeight: interlignes.corps,
  },
  corpsDoux: {
    fontFamily: polices.corps,
    fontSize: tailles.corps,
    lineHeight: interlignes.corps,
  },
  petit: {
    fontFamily: polices.corps,
    fontSize: tailles.petit,
    lineHeight: interlignes.petit,
  },
  meta: {
    fontFamily: polices.corps,
    fontSize: tailles.minuscule,
    lineHeight: interlignes.minuscule,
  },
  surtitre: {
    fontFamily: polices.corpsFort,
    fontSize: tailles.minuscule,
    lineHeight: interlignes.minuscule,
    letterSpacing: typography.interlettrage.capitales,
    textTransform: 'uppercase',
  },
} as const;
