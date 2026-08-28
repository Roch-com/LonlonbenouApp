import { Image, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import type { Partenaire } from '@lonlonbenu/shared';
import { Texte } from './Texte';
import { rayons } from '@/design/theme';

interface Props {
  partenaire: Partenaire;
  taille?: number;
}

export function Avatar({ partenaire, taille = 44 }: Props) {
  const colors = useCouleurs();
  const forme = {
    width: taille,
    height: taille,
    borderRadius: rayons.rond,
  };

  if (partenaire.photoUrl) {
    return (
      <Image
        source={{ uri: partenaire.photoUrl }}
        style={[forme, styles.image]}
        accessibilityLabel={partenaire.prenom}
      />
    );
  }

  return (
    <View style={[forme, styles.initiales]}>
      <Texte
        variante="sousTitre"
        style={{ color: colors.accentFonce, fontSize: taille * 0.36 }}
      >
        {partenaire.initiales}
      </Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  image: { backgroundColor: colors.fondNuance },
  initiales: {
    backgroundColor: colors.fondNuance,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentDoux,
  },
}));
