import { StyleSheet, Text, type TextProps } from 'react-native';
import { echelleTexteMax, textes } from '@/design/theme';

type Variante = keyof typeof textes;

interface Props extends TextProps {
  variante?: Variante;
}

/**
 * Tout texte de l'app passe par ici : garantit l'usage des polices de marque.
 *
 * `maxFontSizeMultiplier` borne le réglage système de taille de police. Sans
 * lui, un utilisateur qui l'a poussé au maximum voit toutes les mises en page
 * se disloquer — titres sur quatre lignes, boutons débordant de leur carte.
 * La borne laisse une amplification confortable sans casser la structure.
 */
export function Texte({ variante = 'corps', style, ...props }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={echelleTexteMax}
      {...props}
      style={[styles[variante], style]}
    />
  );
}

const styles = StyleSheet.create(textes);
