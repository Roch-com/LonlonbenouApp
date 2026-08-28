import { Pressable } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Texte } from './Texte';
import { espacements, ombres, rayons } from '@/design/theme';

interface Props {
  libelle: string;
  emoji?: string;
  active?: boolean;
  onPress?: () => void;
}

/**
 * Pastille sélectionnable — statuts, humeurs, lieux de check-in.
 *
 * `flexShrink` et `numberOfLines` ensemble : les notes douces suggérées sont
 * des phrases entières, et sans ces deux garde-fous elles sortaient de leur
 * carte au lieu de s'y plier.
 */
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
        numberOfLines={2}
        style={[styles.texte, active && styles.texteActif]}
      >
        {emoji ? `${emoji}  ` : ''}
        {libelle}
      </Texte>
    </Pressable>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  puce: {
    paddingVertical: espacements.xs,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondEleve,
    borderWidth: 1,
    borderColor: colors.bordure,
    // Ne dépasse jamais son conteneur, quelle que soit la longueur du libellé.
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 36,
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.fondEleve,
    borderColor: colors.accent,
    ...ombres.effleuree,
  },
  pressee: { backgroundColor: colors.effleurement },
  texte: { color: colors.texteDoux, flexShrink: 1 },
  texteActif: { color: colors.accentFonce },
}));
