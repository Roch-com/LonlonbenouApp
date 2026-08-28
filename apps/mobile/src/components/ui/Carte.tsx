import { StyleSheet, View, type ViewProps } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useTheme } from '@/design/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { espacements, margeCarte, ombres, rayons } from '@/design/theme';

type Ton = 'elevee' | 'discrete' | 'accent' | 'or' | 'tendresse';

interface Props extends ViewProps {
  /** Variante ivoire nuancée, pour poser une carte sur une carte. */
  discrete?: boolean;
  /** Mise en avant dorée : l'accent secondaire, réservé aux moments rares. */
  ton?: Ton;
  /** Rembourrage resserré, pour les cartes qui contiennent une liste. */
  compacte?: boolean;
}

/**
 * Surface de contenu.
 *
 * Le liseré clair sur les cartes élevées n'est pas décoratif : sur Android,
 * `elevation` produit une ombre grise qui ternit l'ivoire, et un bord net
 * redonne la définition que l'ombre seule ne suffit pas à porter.
 */
export function Carte({ discrete, ton, compacte, style, ...props }: Props) {
  const { degrades } = useTheme();
  const variante: Ton = ton ?? (discrete ? 'discrete' : 'elevee');
  const rembourrage = compacte ? espacements.md : margeCarte;

  if (variante === 'accent' || variante === 'or' || variante === 'tendresse') {
    return (
      <View
        {...props}
        style={[styles.base, styles.enRelief, { padding: 0 }, style]}
      >
        <LinearGradient
          colors={variante === 'or' ? [...degrades.or] : [...degrades.tendresse]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.degrade, { padding: rembourrage }]}
        >
          {props.children}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      {...props}
      style={[
        styles.base,
        { padding: rembourrage },
        variante === 'discrete' ? styles.discrete : styles.elevee,
        style,
      ]}
    />
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  base: {
    borderRadius: rayons.lg,
    // `overflow` garde le dégradé et les images dans l'arrondi ; sans lui, les
    // angles bavent sur Android.
    overflow: 'hidden',
  },
  elevee: {
    backgroundColor: colors.fondEleve,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
    ...ombres.carte,
  },
  discrete: {
    backgroundColor: colors.fondNuance,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
  enRelief: { ...ombres.carte },
  degrade: { width: '100%' },
}));
