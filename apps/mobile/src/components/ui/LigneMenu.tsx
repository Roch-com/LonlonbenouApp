import { Pressable, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import { Texte } from './Texte';
import { espacements, rayons } from '@/design/theme';

interface Props {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  detail?: string;
  onPress: () => void;
  /** Ton d'alerte, réservé à ce qui est irréversible. */
  grave?: boolean;
  pastille?: number;
}

/** Entrée de menu : icône, libellé, explication d'une ligne, chevron. */
export function LigneMenu({
  icone,
  libelle,
  detail,
  onPress,
  grave,
  pastille,
}: Props) {
  const colors = useCouleurs();
  const teinte = grave ? colors.urgence : colors.accentFonce;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      style={({ pressed }) => [styles.ligne, pressed && styles.pressee]}
    >
      <View style={[styles.jeton, grave && styles.jetonGrave]}>
        <Feather name={icone} size={18} color={teinte} />
      </View>

      <View style={styles.textes}>
        <View style={styles.titreRangee}>
          <Texte
            variante="corps"
            // Deux lignes : un libellé de menu tronqué ne dit plus où il mène.
            numberOfLines={2}
            style={[styles.titre, grave && { color: colors.urgence }]}
          >
            {libelle}
          </Texte>
          {pastille ? (
            <View style={styles.pastille}>
              <Texte variante="meta" style={styles.pastilleTexte}>
                {pastille > 9 ? '9+' : pastille}
              </Texte>
            </View>
          ) : null}
        </View>
        {detail ? (
          <Texte variante="meta" numberOfLines={2}>
            {detail}
          </Texte>
        ) : null}
      </View>

      <Feather name="chevron-right" size={18} color={colors.texteVoile} />
    </Pressable>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.md,
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.xs,
    borderRadius: rayons.md,
    // Hauteur tactile confortable, même quand il n'y a pas de détail.
    minHeight: 56,
  },
  pressee: { backgroundColor: colors.effleurement },
  jeton: {
    width: 40,
    height: 40,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jetonGrave: { backgroundColor: 'rgba(192, 57, 43, 0.10)' },
  // `minWidth: 0` laisse `numberOfLines` tronquer au lieu de pousser le chevron
  // hors de l'écran.
  textes: { flex: 1, minWidth: 0, gap: 1 },
  titreRangee: { flexDirection: 'row', alignItems: 'center', gap: espacements.xs },
  titre: { flexShrink: 1 },
  pastille: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: rayons.rond,
    backgroundColor: colors.tendresse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { color: colors.texteInverse, lineHeight: 14 },
}));
