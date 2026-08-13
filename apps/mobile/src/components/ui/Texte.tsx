import { StyleSheet, Text, type TextProps } from 'react-native';
import { textes } from '@/design/theme';

type Variante = keyof typeof textes;

interface Props extends TextProps {
  variante?: Variante;
}

/** Tout texte de l'app passe par ici : garantit l'usage des polices de marque. */
export function Texte({ variante = 'corps', style, ...props }: Props) {
  return <Text {...props} style={[styles[variante], style]} />;
}

const styles = StyleSheet.create(textes as Record<Variante, object>);
