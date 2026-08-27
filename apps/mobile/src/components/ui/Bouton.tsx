import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Texte } from './Texte';
import {
  colors,
  degrades,
  durees,
  espacements,
  ombres,
  rayons,
} from '@/design/theme';

export type TonBouton = 'principal' | 'secondaire' | 'discret' | 'urgence';

interface Props extends Omit<PressableProps, 'style'> {
  libelle: string;
  ton?: TonBouton;
  enCours?: boolean;
  pleineLargeur?: boolean;
  icone?: keyof typeof Feather.glyphMap;
}

/**
 * Bouton de l'app.
 *
 * Le ton principal est en dégradé plutôt qu'en aplat : c'est le seul endroit
 * où l'or apparaît en grand, et un aplat de 52 px de haut paraît plat là où un
 * dégradé donne de la matière.
 *
 * L'enfoncement est animé plutôt que binaire. Un changement d'opacité instantané
 * se lit comme un défaut d'affichage ; un retrait d'échelle sur 150 ms se lit
 * comme une réponse.
 */
export function Bouton({
  libelle,
  ton = 'principal',
  enCours,
  pleineLargeur = true,
  icone,
  disabled,
  ...props
}: Props) {
  const inactif = disabled || enCours;
  const echelle = useRef(new Animated.Value(1)).current;

  const animer = (vers: number) =>
    Animated.timing(echelle, {
      toValue: vers,
      duration: durees.rapide,
      useNativeDriver: true,
    }).start();

  const teinte = textesTons[ton].color;

  const contenu = enCours ? (
    <ActivityIndicator color={teinte} size="small" />
  ) : (
    <View style={styles.contenu}>
      {icone ? <Feather name={icone} size={18} color={teinte} /> : null}
      <Texte
        variante="sousTitre"
        numberOfLines={1}
        style={[textesTons[ton], styles.libelle]}
      >
        {libelle}
      </Texte>
    </View>
  );

  return (
    <Animated.View
      style={[
        pleineLargeur && styles.pleineLargeur,
        reliefs[ton],
        { transform: [{ scale: echelle }] },
        inactif && styles.inactif,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactif, busy: !!enCours }}
        disabled={inactif}
        onPressIn={() => animer(0.97)}
        onPressOut={() => animer(1)}
        {...props}
        style={[styles.base, ton !== 'principal' && fonds[ton]]}
      >
        {ton === 'principal' ? (
          <LinearGradient
            colors={[...degrades.or]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {contenu}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: rayons.rond,
    paddingVertical: espacements.md,
    paddingHorizontal: espacements.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
  },
  pleineLargeur: { alignSelf: 'stretch' },
  contenu: { flexDirection: 'row', alignItems: 'center', gap: espacements.xs },
  // `flexShrink` : un libellé long se tronque plutôt que d'élargir le bouton
  // au-delà de son conteneur.
  libelle: { flexShrink: 1, textAlign: 'center' },
  inactif: { opacity: 0.45 },
});

const fonds = StyleSheet.create({
  principal: { backgroundColor: colors.accent },
  secondaire: {
    backgroundColor: colors.fondEleve,
    borderWidth: 1,
    borderColor: colors.bordureOr,
  },
  discret: { backgroundColor: colors.fondNuance },
  urgence: { backgroundColor: colors.urgence },
});

/**
 * L'ombre est portée par l'enveloppe et non par le Pressable : celui-ci a
 * `overflow: hidden` pour contenir le dégradé, ce qui rognerait l'ombre.
 * Le bouton discret n'en a pas — il ne doit rien réclamer.
 */
const reliefs = StyleSheet.create({
  principal: { borderRadius: rayons.rond, ...ombres.carte },
  secondaire: { borderRadius: rayons.rond, ...ombres.effleuree },
  discret: {},
  urgence: { borderRadius: rayons.rond, ...ombres.flottant },
});

const textesTons: Record<TonBouton, { color: string }> = {
  principal: { color: colors.texteInverse },
  secondaire: { color: colors.accentFonce },
  discret: { color: colors.texte },
  urgence: { color: colors.texteInverse },
};
