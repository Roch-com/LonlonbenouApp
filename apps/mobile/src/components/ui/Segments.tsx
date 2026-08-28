import { Pressable, ScrollView, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Texte } from './Texte';
import { espacements, estPetitEcran, ombres, rayons } from '@/design/theme';

export interface Segment<T extends string> {
  cle: T;
  libelle: string;
}

interface Props<T extends string> {
  segments: readonly Segment<T>[];
  actif: T;
  onChanger: (cle: T) => void;
  /** Libellé du groupe, pour les lecteurs d'écran. */
  etiquette?: string;
}

/**
 * Sélecteur de section, en pastilles.
 *
 * Deux écrans en avaient chacun leur copie, et les deux souffraient du même
 * défaut : trois libellés se partageant la largeur d'un téléphone, sans aucune
 * consigne sur ce qui devait céder. « Axes de croissance » repassait à la ligne
 * et déformait la rangée.
 *
 * La réponse est double. Le texte est borné à une ligne et se réduit
 * légèrement plutôt que de se couper. Et sur petit écran, la rangée devient
 * défilable — mieux vaut faire glisser que rendre trois libellés illisibles.
 */
export function Segments<T extends string>({
  segments,
  actif,
  onChanger,
  etiquette,
}: Props<T>) {
  const contenu = segments.map((segment) => {
    const selectionne = segment.cle === actif;
    return (
      <Pressable
        key={segment.cle}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectionne }}
        accessibilityLabel={segment.libelle}
        onPress={() => onChanger(segment.cle)}
        style={({ pressed }) => [
          styles.segment,
          !estPetitEcran && styles.segmentLarge,
          selectionne && styles.segmentActif,
          pressed && !selectionne && styles.segmentPresse,
        ]}
      >
        <Texte
          variante="petit"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={selectionne ? styles.texteActif : styles.texte}
        >
          {segment.libelle}
        </Texte>
      </Pressable>
    );
  });

  if (estPetitEcran) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={etiquette}
        contentContainerStyle={styles.rangeeDefilante}
        style={styles.piste}
      >
        {contenu}
      </ScrollView>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={etiquette}
      style={styles.rangee}
    >
      {contenu}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: {
    flexDirection: 'row',
    gap: espacements.xxs,
    padding: espacements.xxs,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    marginBottom: espacements.xs,
  },
  piste: { marginBottom: espacements.xs, flexGrow: 0 },
  rangeeDefilante: {
    gap: espacements.xxs,
    padding: espacements.xxs,
  },
  segment: {
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  /** Sur écran confortable, les trois se partagent la largeur à parts égales. */
  segmentLarge: { flex: 1, paddingHorizontal: espacements.xs },
  segmentActif: {
    backgroundColor: colors.fondEleve,
    ...ombres.effleuree,
  },
  segmentPresse: { backgroundColor: colors.effleurement },
  texte: { color: colors.texteDoux },
  texteActif: { color: colors.accentFonce },
}));
