import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import type { MessageLisible } from '../hooks/useLecturesDechiffrees';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { heure } from '@/lib/temps';

interface Props {
  message: MessageLisible;
  deMoi: boolean;
}

export function BulleMessage({ message, deMoi }: Props) {
  const douce = message.type === 'note_douce';

  return (
    <View style={[styles.rangee, deMoi ? styles.aDroite : styles.aGauche]}>
      <View
        style={[
          styles.bulle,
          deMoi ? styles.mienne : styles.sienne,
          douce && styles.douce,
        ]}
      >
        {douce ? (
          <Texte variante="surtitre" style={styles.etiquetteDouce}>
            Note douce
          </Texte>
        ) : null}
        <Texte
          variante={douce ? 'sousTitre' : 'corps'}
          style={deMoi && !douce ? styles.texteMien : undefined}
        >
          {message.illisible
            ? 'Message illisible sur cet appareil — la cle a change.'
            : message.texte}
        </Texte>
        <Texte
          variante="meta"
          style={deMoi && !douce ? styles.metaMienne : undefined}
        >
          {heure(message.envoyeLe)}
          {deMoi && message.luLe ? ' · lu' : ''}
        </Texte>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: { flexDirection: 'row' },
  aDroite: { justifyContent: 'flex-end' },
  aGauche: { justifyContent: 'flex-start' },
  bulle: {
    maxWidth: '82%',
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.lg,
    gap: espacements.xxs,
  },
  mienne: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: rayons.sm,
  },
  sienne: {
    backgroundColor: colors.fondEleve,
    borderBottomLeftRadius: rayons.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
  douce: {
    backgroundColor: colors.tendresseDouce,
    borderColor: colors.tendresse,
    borderWidth: 1,
  },
  etiquetteDouce: { color: colors.tendresse },
  texteMien: { color: colors.texteInverse },
  metaMienne: { color: colors.texteInverse, opacity: 0.8 },
}));
