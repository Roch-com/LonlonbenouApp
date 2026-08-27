import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Texte } from './Texte';
import {
  chrome,
  colors,
  espacements,
  margeEcran,
  ombres,
  rayons,
} from '@/design/theme';

interface ActionEnTete {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  onPress: () => void;
  /** Pastille de rappel — un nombre, ou un simple point si `true`. */
  pastille?: number | boolean;
}

interface Props {
  titre: string;
  surtitre?: string;
  actions?: ActionEnTete[];
  /** Flèche de retour à gauche, à la place de la marque. */
  onRetour?: () => void;
}

/**
 * En-tête persistant des écrans d'onglet.
 *
 * Il existe pour deux raisons. La première est d'orientation : sans lui, rien
 * n'indiquait où l'on se trouvait ni comment atteindre les réglages, qui
 * n'étaient joignables qu'en fouillant un onglet. La seconde est de tenue —
 * une app sans chrome haut paraît inachevée, quelle que soit la qualité du
 * contenu en dessous.
 *
 * Il reste volontairement bas et discret : le titre éditorial de chaque écran
 * vit dans le défilement, pas ici. Superposer les deux reviendrait à annoncer
 * deux fois la même chose.
 */
export function EnTeteApp({ titre, surtitre, actions = [], onRetour }: Props) {
  const marges = useSafeAreaInsets();

  return (
    <View style={[styles.socle, { paddingTop: marges.top }]}>
      <LinearGradient
        colors={[colors.fond, colors.fondCreme]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.rangee}>
        {onRetour ? (
          <Pressable
            onPress={onRetour}
            accessibilityRole="button"
            accessibilityLabel="Revenir en arrière"
            hitSlop={12}
            style={({ pressed }) => [styles.bouton, pressed && styles.presse]}
          >
            <Feather name="chevron-left" size={22} color={colors.texte} />
          </Pressable>
        ) : null}

        <View style={styles.identite}>
          {surtitre ? (
            <Texte variante="surtitre" numberOfLines={1}>
              {surtitre}
            </Texte>
          ) : null}
          <Texte variante="titre" numberOfLines={1} style={styles.titre}>
            {titre}
          </Texte>
        </View>

        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.libelle}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.libelle}
              hitSlop={10}
              style={({ pressed }) => [styles.bouton, pressed && styles.presse]}
            >
              <Feather name={action.icone} size={20} color={colors.texte} />
              {action.pastille ? (
                <View style={styles.pastille}>
                  {typeof action.pastille === 'number' ? (
                    <Texte variante="meta" style={styles.pastilleTexte}>
                      {action.pastille > 9 ? '9+' : action.pastille}
                    </Texte>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filet} />
    </View>
  );
}

const styles = StyleSheet.create({
  socle: {
    backgroundColor: colors.fond,
    ...ombres.effleuree,
    zIndex: 2,
  },
  rangee: {
    minHeight: chrome.enTete,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.xs,
    paddingHorizontal: margeEcran,
    paddingBottom: espacements.xs,
  },
  // `flex: 1` et `minWidth: 0` : sans quoi un nom d'espace long pousse les
  // actions hors de l'écran au lieu de se tronquer lui-même.
  identite: { flex: 1, minWidth: 0, gap: 1 },
  titre: { lineHeight: undefined },
  actions: { flexDirection: 'row', alignItems: 'center', gap: espacements.xxs },
  bouton: {
    width: chrome.toucheMin,
    height: chrome.toucheMin,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presse: { backgroundColor: colors.effleurement },
  pastille: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: rayons.rond,
    backgroundColor: colors.tendresse,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.fond,
  },
  pastilleTexte: { color: colors.texteInverse, fontSize: 9, lineHeight: 12 },
  filet: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bordure,
  },
});
