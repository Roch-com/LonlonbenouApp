import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Texte } from './Texte';
import { chrome, colors, espacements, margeEcran, rayons } from '@/design/theme';

interface Props {
  titre?: string;
  /** Libellé du bouton de fermeture, lu par les lecteurs d'écran. */
  libelleFermeture?: string;
  onFermer?: () => void;
}

/**
 * Barre de fermeture des écrans présentés en modale.
 *
 * Sur Android, une modale sans bouton de fermeture n'offre que le geste retour
 * système — invisible, et introuvable pour qui ne le connaît pas. Plusieurs
 * écrans de l'app étaient dans ce cas : on y entrait sans savoir en sortir.
 */
export function EnTeteModale({
  titre,
  libelleFermeture = 'Fermer',
  onFermer,
}: Props) {
  const router = useRouter();
  const marges = useSafeAreaInsets();

  const fermer = () => {
    if (onFermer) return onFermer();
    if (router.canGoBack()) return router.back();
    // Une modale ouverte en lien direct n'a pas d'historique : on renvoie à
    // l'accueil plutôt que de laisser un bouton sans effet.
    router.replace('/');
  };

  return (
    <View style={[styles.barre, { paddingTop: marges.top + espacements.xs }]}>
      <View style={styles.titreBloc}>
        {titre ? (
          <Texte variante="surtitre" numberOfLines={1}>
            {titre}
          </Texte>
        ) : null}
      </View>

      <Pressable
        onPress={fermer}
        accessibilityRole="button"
        accessibilityLabel={libelleFermeture}
        hitSlop={12}
        style={({ pressed }) => [styles.fermeture, pressed && styles.pressee]}
      >
        <Feather name="x" size={20} color={colors.texte} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.md,
    paddingHorizontal: margeEcran,
    paddingBottom: espacements.xs,
    backgroundColor: colors.fond,
  },
  titreBloc: { flex: 1, minWidth: 0 },
  fermeture: {
    width: chrome.toucheMin,
    height: chrome.toucheMin,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressee: { backgroundColor: colors.effleurement },
});
