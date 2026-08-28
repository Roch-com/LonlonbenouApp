import { StyleSheet, Text, type TextProps } from 'react-native';
import { couleurParVariante, echelleTexteMax, textes } from '@/design/theme';
import { useCouleurs } from '@/design/ThemeProvider';

type Variante = keyof typeof textes;

interface Props extends TextProps {
  variante?: Variante;
}

/**
 * Tout texte de l'app passe par ici : garantit l'usage des polices de marque.
 *
 * La couleur est résolue **à chaque rendu**, depuis le thème actif. Elle vivait
 * auparavant dans les styles eux-mêmes, construits une seule fois au chargement
 * du module avec la palette claire : en mode sombre, chaque titre et chaque
 * paragraphe gardait l'encre sombre d'origine, et disparaissait dans le fond.
 *
 * `maxFontSizeMultiplier` borne le réglage système de taille de police. Sans
 * lui, un utilisateur qui l'a poussé au maximum voit toutes les mises en page
 * se disloquer — titres sur quatre lignes, boutons débordant de leur carte.
 */
export function Texte({ variante = 'corps', style, ...props }: Props) {
  const colors = useCouleurs();

  return (
    <Text
      maxFontSizeMultiplier={echelleTexteMax}
      {...props}
      style={[
        styles[variante],
        { color: colors[couleurParVariante[variante]] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create(textes);
