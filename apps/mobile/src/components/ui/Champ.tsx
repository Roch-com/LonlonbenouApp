import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Texte } from './Texte';
import { colors, espacements, polices, rayons, typography } from '@/design/theme';

interface Props extends TextInputProps {
  etiquette?: string;
}

export function Champ({ etiquette, style, ...props }: Props) {
  return (
    <View style={styles.bloc}>
      {etiquette ? <Texte variante="petit">{etiquette}</Texte> : null}
      <TextInput
        placeholderTextColor={colors.texteDoux}
        {...props}
        style={[styles.champ, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.xs },
  champ: {
    backgroundColor: colors.fondEleve,
    borderRadius: rayons.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.sm,
    minHeight: 48,
    fontFamily: polices.corps,
    fontSize: typography.tailles.corps,
    color: colors.texte,
  },
});
