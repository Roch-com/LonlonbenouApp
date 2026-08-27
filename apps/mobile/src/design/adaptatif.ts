/**
 * Adaptation à la largeur de l'écran.
 *
 * L'app était dessinée pour un écran confortable : sur un 360 dp — la largeur
 * la plus répandue en Afrique de l'Ouest, dont les téléphones du couple pilote
 * — les titres serif de 34 px et les marges de 24 px ne laissaient plus assez
 * de place, et les mots se coupaient.
 *
 * Le facteur ci-dessous ramène l'échelle typographique et les marges à ce que
 * l'écran peut réellement porter. Il ne descend jamais sous 0,86 : en deçà, on
 * ne gagne plus en confort, on perd en lisibilité.
 */
import { Dimensions, PixelRatio, Platform } from 'react-native';
import { espacements, typography } from '@lonlonbenu/shared';

/** Largeur de référence du dessin d'origine. */
const REFERENCE = 390;

const { width, height } = Dimensions.get('window');

/** Le petit côté : un téléphone en paysage ne doit pas passer pour une tablette. */
export const largeurEcran = Math.min(width, height);

export const estPetitEcran = largeurEcran < 375;
export const estTresPetitEcran = largeurEcran < 340;

/** Entre 0,86 et 1. On ne grandit pas sur les grands écrans : le dessin est déjà généreux. */
export const facteur = Math.max(0.86, Math.min(1, largeurEcran / REFERENCE));

/** Arrondi au demi-pixel du terminal : évite le rendu flou des textes. */
function ajuster(valeur: number): number {
  return PixelRatio.roundToNearestPixel(valeur * facteur);
}

/**
 * Échelle typographique adaptée. Les grandes tailles bougent, les petites non :
 * réduire un texte de 12 px le rendrait illisible, et il n'a de toute façon
 * jamais posé de problème de place.
 */
export const tailles = {
  afficheXl: ajuster(typography.tailles.afficheXl),
  affiche: ajuster(typography.tailles.affiche),
  titre: ajuster(typography.tailles.titre),
  sousTitre: ajuster(typography.tailles.sousTitre),
  corps: estTresPetitEcran ? 15 : typography.tailles.corps,
  petit: typography.tailles.petit,
  minuscule: typography.tailles.minuscule,
} as const;

export const interlignes = {
  afficheXl: ajuster(typography.interlignes.afficheXl),
  affiche: ajuster(typography.interlignes.affiche),
  titre: ajuster(typography.interlignes.titre),
  sousTitre: ajuster(typography.interlignes.sousTitre),
  corps: estTresPetitEcran ? 22 : typography.interlignes.corps,
  petit: typography.interlignes.petit,
  minuscule: typography.interlignes.minuscule,
} as const;

/**
 * Marge latérale des écrans. Sur un petit écran, 24 px de chaque côté
 * amputaient le contenu de 13 % de la largeur.
 */
export const margeEcran = estPetitEcran ? espacements.md : espacements.lg;

/** Rembourrage intérieur des cartes, accordé à la marge d'écran. */
export const margeCarte = estPetitEcran ? espacements.md : espacements.lg;

/**
 * Android applique le réglage système de taille de police à tous les textes.
 * Poussé au maximum, il casse toutes les mises en page. On le borne sans
 * l'ignorer : l'accessibilité reste servie, la mise en page tient.
 */
export const echelleTexteMax = Platform.OS === 'android' ? 1.25 : 1.3;
