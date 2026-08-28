import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Texte } from './Texte';
import { durees, espacements, margeEcran, ombres, rayons } from '@/design/theme';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';

interface Props {
  visible: boolean;
  onFermer: () => void;
  titre?: string;
  sousTitre?: string;
  children: ReactNode;
}

/**
 * Feuille qui remonte du bas.
 *
 * Écrite à la main plutôt qu'avec une bibliothèque : le besoin tient en une
 * translation et un voile, et une dépendance de plus pour ça se paierait à
 * chaque montée de version d'Expo.
 *
 * Le voile se ferme au toucher et la poignée est visible : deux affordances
 * qui évitent le cul-de-sac où l'on ne sait plus comment revenir.
 */
export function FeuilleModale({
  visible,
  onFermer,
  titre,
  sousTitre,
  children,
}: Props) {
  const marges = useSafeAreaInsets();
  const glissement = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glissement, {
      toValue: visible ? 1 : 0,
      duration: visible ? durees.normale : durees.rapide,
      // Décélération franche : l'entrée doit sembler posée, pas élastique.
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, glissement]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onFermer}
      statusBarTranslucent
    >
      <View style={styles.cadre}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glissement }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.voile]}
            onPress={onFermer}
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.feuille,
            {
              paddingBottom: marges.bottom + espacements.lg,
              opacity: glissement,
              transform: [
                {
                  translateY: glissement.interpolate({
                    inputRange: [0, 1],
                    outputRange: [320, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.poignee} />

          {titre ? (
            <View style={styles.entete}>
              <Texte variante="titre">{titre}</Texte>
              {sousTitre ? <Texte variante="petit">{sousTitre}</Texte> : null}
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.contenu}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: { flex: 1, justifyContent: 'flex-end' },
  voile: { backgroundColor: colors.voile },
  feuille: {
    backgroundColor: colors.fond,
    borderTopLeftRadius: rayons.xl,
    borderTopRightRadius: rayons.xl,
    paddingTop: espacements.sm,
    paddingHorizontal: margeEcran,
    // Une feuille ne doit jamais occuper tout l'écran : la bande de contenu
    // qui reste visible au-dessus rappelle qu'on est en surimpression.
    maxHeight: '86%',
    ...ombres.flottant,
  },
  poignee: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: rayons.rond,
    backgroundColor: colors.bordureNette,
    marginBottom: espacements.md,
  },
  entete: { gap: espacements.xxs, marginBottom: espacements.md },
  contenu: { paddingBottom: espacements.xs },
}));
