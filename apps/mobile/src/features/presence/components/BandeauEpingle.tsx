import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, margeEcran } from '@/design/theme';
import type { MessageLisible } from '../hooks/useLecturesDechiffrees';

interface Props {
  message: MessageLisible;
  /** Vrai si c'est le lecteur qui a écrit le message épinglé. */
  deMoi: boolean;
  prenomAutre: string;
  /** Ramène au message dans le fil. */
  onOuvrir: () => void;
  onDecrocher: () => void;
}

/**
 * Bandeau du message épinglé, en haut de la conversation.
 *
 * ## Pourquoi il est cliquable
 *
 * Un message épinglé sert à s'y reporter — une adresse, une heure, une phrase
 * qu'on relit. Un bandeau qui montre le texte sans permettre d'y retourner
 * oblige à faire défiler des semaines de conversation pour retrouver le
 * contexte.
 *
 * ## Une seule ligne
 *
 * Le bandeau reste au-dessus du fil en permanence : il doit informer sans
 * prendre la place de la conversation. Un message long se coupe, et c'est en
 * l'ouvrant qu'on le lit en entier.
 */
export function BandeauEpingle({
  message,
  deMoi,
  prenomAutre,
  onOuvrir,
  onDecrocher,
}: Props) {
  const colors = useCouleurs();

  return (
    <View style={styles.bandeau}>
      <Pressable
        onPress={onOuvrir}
        accessibilityRole="button"
        accessibilityLabel={`Message épinglé de ${deMoi ? 'vous' : prenomAutre}, aller au message`}
        style={({ pressed }) => [styles.zone, pressed && styles.pressee]}
      >
        <Feather name="bookmark" size={14} color={colors.accent} />
        <View style={styles.texte}>
          <Texte variante="meta">
            Épinglé · {deMoi ? 'vous' : prenomAutre}
          </Texte>
          <Texte variante="petit" numberOfLines={1}>
            {message.retire ? 'Ce message a été retiré' : message.texte}
          </Texte>
        </View>
      </Pressable>

      <Pressable
        onPress={onDecrocher}
        accessibilityRole="button"
        accessibilityLabel="Décrocher l’épingle"
        hitSlop={12}
        style={({ pressed }) => [styles.decrocher, pressed && styles.pressee]}
      >
        <Feather name="x" size={16} color={colors.texteDoux} />
      </Pressable>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.xs,
    paddingHorizontal: margeEcran,
    paddingVertical: espacements.xs,
    backgroundColor: colors.fondEleve,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  zone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
    paddingVertical: espacements.xxs,
  },
  texte: { flex: 1, minWidth: 0, gap: 1 },
  decrocher: { padding: espacements.xs },
  pressee: { opacity: 0.6 },
}));
