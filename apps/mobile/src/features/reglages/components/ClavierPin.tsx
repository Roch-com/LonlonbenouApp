import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LONGUEUR_PIN_MAX } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';

interface Props {
  valeur: string;
  onChange: (valeur: string) => void;
  /** Nombre de points affichés. */
  longueurAttendue?: number;
  desactive?: boolean;
}

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function ClavierPin({
  valeur,
  onChange,
  longueurAttendue = LONGUEUR_PIN_MAX,
  desactive,
}: Props) {
  const ajouter = (chiffre: string) => {
    if (desactive || valeur.length >= LONGUEUR_PIN_MAX) return;
    onChange(valeur + chiffre);
  };

  const effacer = () => {
    if (desactive) return;
    onChange(valeur.slice(0, -1));
  };

  return (
    <View style={styles.bloc}>
      <View style={styles.points} accessibilityLabel={`${valeur.length} chiffres saisis`}>
        {Array.from({ length: longueurAttendue }, (_, i) => (
          <View
            key={i}
            style={[styles.point, i < valeur.length && styles.pointRempli]}
          />
        ))}
      </View>

      <View style={styles.clavier}>
        {TOUCHES.map((touche) => (
          <Touche
            key={touche}
            libelle={touche}
            onPress={() => ajouter(touche)}
            desactive={desactive}
          />
        ))}
        <View style={styles.touche} />
        <Touche libelle="0" onPress={() => ajouter('0')} desactive={desactive} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer le dernier chiffre"
          onPress={effacer}
          disabled={desactive}
          style={({ pressed }) => [
            styles.touche,
            pressed && styles.touchePressee,
            desactive && styles.toucheInactive,
          ]}
        >
          <Feather name="delete" size={22} color={colors.texteDoux} />
        </Pressable>
      </View>
    </View>
  );
}

function Touche({
  libelle,
  onPress,
  desactive,
}: {
  libelle: string;
  onPress: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      disabled={desactive}
      style={({ pressed }) => [
        styles.touche,
        styles.toucheChiffre,
        pressed && styles.touchePressee,
        desactive && styles.toucheInactive,
      ]}
    >
      <Texte variante="affiche" style={styles.chiffre}>
        {libelle}
      </Texte>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.xl, alignItems: 'center' },
  points: { flexDirection: 'row', gap: espacements.sm },
  point: {
    width: 12,
    height: 12,
    borderRadius: rayons.rond,
    borderWidth: 1,
    borderColor: colors.accentDoux,
  },
  pointRempli: { backgroundColor: colors.accent, borderColor: colors.accent },
  clavier: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: espacements.md,
    maxWidth: 280,
  },
  touche: {
    width: 76,
    height: 76,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toucheChiffre: { backgroundColor: colors.fondEleve },
  touchePressee: { backgroundColor: colors.fondNuance },
  toucheInactive: { opacity: 0.4 },
  chiffre: { color: colors.texte },
});
