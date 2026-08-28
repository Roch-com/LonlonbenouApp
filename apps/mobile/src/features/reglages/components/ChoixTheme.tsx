import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useContexteTheme, useCouleurs } from '@/design/ThemeProvider';
import { espacements, rayons } from '@/design/theme';
import { Pressable } from 'react-native';
import type { PreferenceTheme } from '@/design/ThemeProvider';

const CHOIX: {
  code: PreferenceTheme;
  libelle: string;
  icone: keyof typeof Feather.glyphMap;
}[] = [
  { code: 'systeme', libelle: 'Automatique', icone: 'smartphone' },
  { code: 'clair', libelle: 'Clair', icone: 'sun' },
  { code: 'sombre', libelle: 'Sombre', icone: 'moon' },
];

/**
 * Choix du thème.
 *
 * « Automatique » vient en premier et reste le défaut : la personne a déjà dit
 * à son téléphone ce qu'elle préférait, et le contredire d'office serait
 * présumer mieux savoir. Les deux autres sont là pour ceux qui veulent
 * justement s'en écarter dans cette app précise.
 */
export function ChoixTheme() {
  const colors = useCouleurs();
  const { preference, definirPreference } = useContexteTheme();

  return (
    <Carte>
      <Texte variante="surtitre">Apparence</Texte>
      <Texte variante="petit" style={styles.intro}>
        Le mode sombre repose les yeux le soir, et c’est souvent le soir qu’on
        s’écrit.
      </Texte>

      <View style={styles.rangee}>
        {CHOIX.map((choix) => {
          const actif = preference === choix.code;
          return (
            <Pressable
              key={choix.code}
              onPress={() => definirPreference(choix.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={choix.libelle}
              style={({ pressed }) => [
                styles.option,
                actif && styles.optionActive,
                pressed && styles.pressee,
              ]}
            >
              <Feather
                name={choix.icone}
                size={18}
                color={actif ? colors.accentFonce : colors.texteDoux}
              />
              <Texte
                variante="petit"
                numberOfLines={1}
                style={actif ? styles.libelleActif : undefined}
              >
                {choix.libelle}
              </Texte>
            </Pressable>
          );
        })}
      </View>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  intro: { marginTop: espacements.xxs },
  rangee: {
    flexDirection: 'row',
    gap: espacements.xs,
    marginTop: espacements.md,
  },
  option: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacements.xxs,
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.xs,
    borderRadius: rayons.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    backgroundColor: colors.fondNuance,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.fondEleve,
  },
  pressee: { backgroundColor: colors.effleurement },
  libelleActif: { color: colors.accentFonce },
}));
