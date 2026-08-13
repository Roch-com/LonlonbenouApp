import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { Texte } from './Texte';
import { colors, espacements, ombres, rayons } from '@/design/theme';

export type TonBouton = 'principal' | 'secondaire' | 'discret' | 'urgence';

interface Props extends Omit<PressableProps, 'style'> {
  libelle: string;
  ton?: TonBouton;
  enCours?: boolean;
  pleineLargeur?: boolean;
}

export function Bouton({
  libelle,
  ton = 'principal',
  enCours,
  pleineLargeur = true,
  disabled,
  ...props
}: Props) {
  const inactif = disabled || enCours;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactif, busy: !!enCours }}
      disabled={inactif}
      {...props}
      style={({ pressed }) => [
        styles.base,
        fonds[ton],
        pleineLargeur && styles.pleineLargeur,
        pressed && styles.presse,
        inactif && styles.inactif,
      ]}
    >
      <View style={styles.contenu}>
        {enCours ? (
          <ActivityIndicator color={textesTons[ton].color} size="small" />
        ) : (
          <Texte variante="sousTitre" style={textesTons[ton]}>
            {libelle}
          </Texte>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: rayons.rond,
    paddingVertical: espacements.md,
    paddingHorizontal: espacements.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pleineLargeur: { alignSelf: 'stretch' },
  contenu: { flexDirection: 'row', alignItems: 'center', gap: espacements.xs },
  presse: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  inactif: { opacity: 0.45 },
});

const fonds = StyleSheet.create({
  principal: { backgroundColor: colors.accent, ...ombres.carte },
  secondaire: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  discret: { backgroundColor: colors.fondNuance },
  urgence: { backgroundColor: colors.urgence, ...ombres.flottant },
});

const textesTons: Record<TonBouton, { color: string }> = {
  principal: { color: colors.texteInverse },
  secondaire: { color: colors.accentFonce },
  discret: { color: colors.texte },
  urgence: { color: colors.texteInverse },
};
