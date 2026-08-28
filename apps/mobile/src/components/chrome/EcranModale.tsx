import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Children, isValidElement } from 'react';
import { Ecran, EnTeteModale } from '@/components/ui';
import { Apparition } from './Apparition';

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
        {Children.toArray(children).map((enfant, rang) =>
          isValidElement(enfant) ? (
            <Apparition key={enfant.key ?? rang} rang={rang}>
              {enfant}
            </Apparition>
          ) : (
            enfant
          ),
        )}
      </Ecran>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: { flex: 1, backgroundColor: colors.fond },
}));
