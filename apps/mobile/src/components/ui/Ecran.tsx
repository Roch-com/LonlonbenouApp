import type { ReactNode } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chrome, espacements, margeEcran } from '@/design/theme';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useTheme } from '@/design/ThemeProvider';

interface Props {
  children: ReactNode;
  /** Un écran conversationnel gère son propre défilement. */
  defilable?: boolean;
  /**
   * Réserve la hauteur de la barre d'onglets. Vrai pour les écrans d'onglet,
   * faux pour les modales, qui s'affichent par-dessus.
   */
  dansOnglets?: boolean;
  /** L'en-tête d'application gère lui-même la marge haute. */
  sousEnTete?: boolean;
  onRafraichir?: () => void;
  rafraichissement?: boolean;
  scrollProps?: ScrollViewProps;
}

/**
 * Cadre commun de tous les écrans.
 *
 * Il porte deux responsabilités que chaque écran refaisait de son côté, mal :
 * le fond dégradé de la marque, et la réservation de l'espace occupé par le
 * chrome. Ce second point n'est pas cosmétique — le rembourrage bas était une
 * constante devinée, et le dernier bouton de chaque écran disparaissait sous la
 * barre d'onglets.
 */
export function Ecran({
  children,
  defilable = true,
  dansOnglets = false,
  sousEnTete = false,
  onRafraichir,
  rafraichissement = false,
  scrollProps,
}: Props) {
  const { degrades, colors } = useTheme();
  const marges = useSafeAreaInsets();

  const hautDisponible = sousEnTete ? espacements.md : marges.top + espacements.md;
  // Sous les onglets, la barre couvre déjà la zone sûre du bas : on ajoute sa
  // hauteur, pas les deux, sinon on creuse un vide de 80 px.
  const basDisponible = dansOnglets
    ? chrome.barreOnglets + marges.bottom + espacements.lg
    : marges.bottom + espacements.xxl;

  const fond = (
    <LinearGradient
      colors={[...degrades.fond]}
      locations={[0, 0.45, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );

  if (!defilable) {
    return (
      <View style={styles.fond}>
        {fond}
        <View style={[styles.plein, { paddingTop: sousEnTete ? 0 : marges.top }]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      {fond}
      {/* `KeyboardAwareScrollView` et non `ScrollView` : depuis le passage au
          bord-à-bord d'Android, la fenêtre ne se redimensionne plus quand le
          clavier monte, et il recouvrait le bouton de validation de chaque
          formulaire — la date d'origine du couple, la connexion, l'appairage.
          Celui-ci fait remonter le champ actif au-dessus du clavier. */}
      <KeyboardAwareScrollView
        bottomOffset={espacements.xl}
        style={styles.defilement}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: hautDisponible, paddingBottom: basDisponible },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...(onRafraichir
          ? {
              refreshControl: (
                <RefreshControl
                  refreshing={rafraichissement}
                  onRefresh={onRafraichir}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                />
              ),
            }
          : {})}
        {...scrollProps}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  fond: { flex: 1, backgroundColor: colors.fond },
  defilement: { flex: 1 },
  plein: { flex: 1 },
  contenu: {
    paddingHorizontal: margeEcran,
    gap: espacements.md,
  },
}));
