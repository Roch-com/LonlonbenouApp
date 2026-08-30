import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';

interface Props {
  /** Diamètre d'un point. Réduit dans l'en-tête, plein format dans le fil. */
  taille?: number;
}

/**
 * Trois points qui respirent pendant que l'autre écrit.
 *
 * L'onde est décalée d'un point à l'autre plutôt que synchrone : trois points
 * qui clignotent ensemble se lisent comme un chargement en cours — donc comme
 * une attente subie — là où une onde qui traverse se lit comme quelqu'un qui
 * s'active à l'autre bout.
 *
 * L'opacité seule, sans translation : un point qui monte et descend attire
 * l'œil hors de la conversation, ce qui est exactement ce qu'il ne faut pas
 * dans un en-tête qu'on garde sous les yeux en lisant.
 */
export function PointsDeSaisie({ taille = 5 }: Props) {
  const valeurs = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = valeurs.map((valeur, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(valeur, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(valeur, {
            toValue: 0.3,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Le repos final complète le cycle : sans lui, les trois points
          // dérivent les uns par rapport aux autres au fil des boucles.
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [valeurs]);

  return (
    <View style={styles.rangee}>
      {valeurs.map((opacity, i) => (
        <Animated.View
          key={i}
          style={[
            styles.point,
            { width: taille, height: taille, borderRadius: taille / 2, opacity },
          ]}
        />
      ))}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  point: { backgroundColor: colors.accent },
}));
