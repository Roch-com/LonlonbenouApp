import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, espacements, ombres, rayons } from '@/design/theme';

interface Props extends ViewProps {
  /** Variante ivoire nuancée, pour poser une carte sur une carte. */
  discrete?: boolean;
}

export function Carte({ discrete, style, ...props }: Props) {
  return (
    <View
      {...props}
      style={[styles.base, discrete ? styles.discrete : styles.elevee, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: rayons.lg,
    padding: espacements.lg,
  },
  elevee: {
    backgroundColor: colors.fondEleve,
    ...ombres.carte,
  },
  discrete: {
    backgroundColor: colors.fondNuance,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
});
