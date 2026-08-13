import { StyleSheet, View } from 'react-native';
import { Texte } from './Texte';
import { espacements } from '@/design/theme';

interface Props {
  surtitre?: string;
  titre: string;
  sousTitre?: string;
}

export function EnTete({ surtitre, titre, sousTitre }: Props) {
  return (
    <View style={styles.bloc}>
      {surtitre ? <Texte variante="surtitre">{surtitre}</Texte> : null}
      <Texte variante="affiche">{titre}</Texte>
      {sousTitre ? <Texte variante="corpsDoux">{sousTitre}</Texte> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.xxs, marginBottom: espacements.xs },
});
