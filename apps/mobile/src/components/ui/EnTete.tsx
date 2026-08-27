import { StyleSheet, View } from 'react-native';
import { Texte } from './Texte';
import { espacements } from '@/design/theme';

interface Props {
  surtitre?: string;
  titre: string;
  sousTitre?: string;
}

/**
 * Titre éditorial d'un écran, dans le défilement.
 *
 * Le titre est borné à deux lignes : la serif d'affiche est large, et un
 * intitulé long finissait par occuper le premier écran à lui seul.
 */
export function EnTete({ surtitre, titre, sousTitre }: Props) {
  return (
    <View style={styles.bloc}>
      {surtitre ? (
        <Texte variante="surtitre" numberOfLines={1}>
          {surtitre}
        </Texte>
      ) : null}
      <Texte variante="affiche" numberOfLines={2} style={styles.titre}>
        {titre}
      </Texte>
      {sousTitre ? (
        <Texte variante="corpsDoux" style={styles.sousTitre}>
          {sousTitre}
        </Texte>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.xxs, marginBottom: espacements.xs },
  titre: { marginTop: espacements.xxs },
  sousTitre: { marginTop: espacements.xxs },
});
