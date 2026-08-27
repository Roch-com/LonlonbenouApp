import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ecran, EnTeteModale } from '@/components/ui';
import { colors } from '@/design/theme';

interface Props {
  /** Court libellé de contexte, affiché à gauche de la croix. */
  section?: string;
  children: ReactNode;
  defilable?: boolean;
  onFermer?: () => void;
}

/**
 * Cadre des écrans présentés en surimpression.
 *
 * Sa raison d'être tient dans la croix en haut à droite. Sur Android, une
 * modale sans bouton de fermeture ne se quitte que par le geste retour — rien
 * à l'écran ne l'annonce, et plusieurs écrans de l'app se refermaient ainsi
 * sur qui ne connaissait pas le geste.
 */
export function EcranModale({
  section,
  children,
  defilable = true,
  onFermer,
}: Props) {
  return (
    <View style={styles.cadre}>
      <EnTeteModale
        {...(section ? { titre: section } : {})}
        {...(onFermer ? { onFermer } : {})}
      />
      <Ecran sousEnTete defilable={defilable}>
        {children}
      </Ecran>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { flex: 1, backgroundColor: colors.fond },
});
