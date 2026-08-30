import { Modal, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, margeEcran, ombres, rayons } from '@/design/theme';

export interface ActionMessage {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  actions: ActionMessage[];
  onFermer: () => void;
}

/**
 * Feuille d'actions sur un message, ouverte à l'appui long.
 *
 * Par le bas plutôt qu'en menu flottant près de la bulle : sur un téléphone
 * tenu à une main, un menu ancré en haut de l'écran est hors de portée du
 * pouce, et c'est justement le geste qu'on vient de faire pour l'ouvrir.
 *
 * Le fond touchable ferme la feuille. Sans lui, la seule sortie serait le
 * bouton système de retour — que beaucoup n'essaient pas, de peur de quitter
 * la conversation.
 */
export function ActionsMessage({ visible, actions, onFermer }: Props) {
  const colors = useCouleurs();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onFermer}
    >
      <Pressable
        style={styles.voile}
        onPress={onFermer}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <View style={styles.feuille}>
        {actions.map((action) => (
          <Pressable
            key={action.libelle}
            onPress={() => {
              action.onPress();
              onFermer();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressee]}
          >
            <Feather name={action.icone} size={18} color={colors.texte} />
            <Texte variante="corps">{action.libelle}</Texte>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  voile: { flex: 1, backgroundColor: colors.voile },
  feuille: {
    position: 'absolute',
    left: margeEcran,
    right: margeEcran,
    bottom: espacements.xl,
    padding: espacements.xs,
    borderRadius: rayons.lg,
    backgroundColor: colors.fondEleve,
    ...ombres.flottant,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.md,
    paddingVertical: espacements.md,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.md,
  },
  pressee: { backgroundColor: colors.effleurement },
}));
