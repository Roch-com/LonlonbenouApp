import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  /**
   * Rang de l'élément dans une liste. Chaque rang décale l'entrée d'un cran,
   * ce qui produit une cascade au lieu d'un bloc qui surgit d'un coup.
   */
  rang?: number;
  style?: ViewStyle;
}

/**
 * Décalage entre deux éléments successifs.
 *
 * Relevé de 55 à 90 ms : à l'usage, la cascade passait trop vite pour se lire
 * comme un enchaînement — les blocs semblaient arriver ensemble, avec juste un
 * léger flou. C'est le décalage, plus que la durée, qui donne l'impression
 * d'un écran qui se compose.
 */
const CASCADE_MS = 90;

/** Distance parcourue à l'entrée. Assez pour se voir, trop peu pour distraire. */
const MONTEE = 18;

/** Durée d'entrée d'un bloc. Au-delà de 400 ms, l'animation se remarque. */
const DUREE_MS = 380;

/**
 * Fait apparaître son contenu en montant légèrement.
 *
 * Le mouvement remplace l'affichage instantané, qui donne l'impression que
 * l'écran a « sauté » d'un état à l'autre. Deux limites tenues volontairement :
 *
 *  - **La cascade s'arrête au huitième élément.** Au-delà, l'attente cumulée
 *    dépasserait la seconde et le dernier élément paraîtrait en retard plutôt
 *    qu'élégant.
 *  - **Rien ne dépasse quatre dixièmes de seconde.** Une animation qu'on
 *    remarque est une animation trop longue ; celle-ci doit se sentir sans se
 *    voir.
 */
export function Apparition({ children, rang = 0, style }: Props) {
  const progression = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progression, {
      toValue: 1,
      duration: DUREE_MS,
      delay: Math.min(rang, 8) * CASCADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progression, rang]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progression,
          transform: [
            {
              translateY: progression.interpolate({
                inputRange: [0, 1],
                outputRange: [MONTEE, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
