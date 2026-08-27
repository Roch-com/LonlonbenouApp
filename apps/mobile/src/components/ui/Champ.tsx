import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Texte } from './Texte';
import {
  colors,
  echelleTexteMax,
  espacements,
  polices,
  rayons,
  typography,
} from '@/design/theme';

interface Props extends TextInputProps {
  etiquette?: string;
  /** Message d'erreur, affiché sous le champ. */
  erreur?: string;
}

export function Champ({ etiquette, erreur, style, ...props }: Props) {
  return (
    <View style={styles.bloc}>
      {etiquette ? (
        <Texte variante="petit" style={styles.etiquette}>
          {etiquette}
        </Texte>
      ) : null}
      <TextInput
        placeholderTextColor={colors.texteVoile}
        maxFontSizeMultiplier={echelleTexteMax}
        {...props}
        style={[styles.champ, !!erreur && styles.enErreur, style]}
      />
      {erreur ? (
        <Texte variante="meta" style={styles.messageErreur}>
          {erreur}
        </Texte>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` : dans une rangée de deux champs, chacun prend sa moitié au lieu
  // de déborder.
  bloc: { gap: espacements.xs, flex: 1, minWidth: 0 },
  etiquette: { marginLeft: espacements.xxs },
  champ: {
    backgroundColor: colors.fondEleve,
    borderRadius: rayons.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.sm,
    minHeight: 50,
    fontFamily: polices.corps,
    fontSize: typography.tailles.corps,
    color: colors.texte,
  },
  enErreur: { borderColor: colors.urgence },
  messageErreur: { color: colors.urgence, marginLeft: espacements.xxs },
});
