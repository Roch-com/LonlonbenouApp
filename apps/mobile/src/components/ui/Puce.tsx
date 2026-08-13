import { Pressable, StyleSheet } from 'react-native';
import { Texte } from './Texte';
import { colors, espacements, rayons } from '@/design/theme';

interface Props {
  libelle: string;
  emoji?: string;
  active?: boolean;
  onPress?: () => void;
}

/** Pastille sélectionnable — statuts, humeurs, lieux de check-in. */
export function Puce({ libelle, emoji, active, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.puce,
        active && styles.active,
        pressed && styles.pressee,
      ]}
    >
      <Texte
        variante="petit"
        style={active ? styles.texteActif : styles.texte}
      >
        {emoji ? `${emoji}  ` : ''}
        {libelle}
      </Texte>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  puce: {
    paddingVertical: espacements.xs,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  active: {
    backgroundColor: colors.fondEleve,
    borderColor: colors.accent,
  },
  pressee: { opacity: 0.8 },
  texte: { color: colors.texteDoux },
  texteActif: { color: colors.accentFonce },
});
