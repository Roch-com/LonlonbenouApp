import { View } from 'react-native';
import type { ActiviteVisible, Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { PointsDeSaisie } from './PointsDeSaisie';

interface Props {
  activite?: ActiviteVisible;
}

/**
 * Sous-titre de la conversation : « en ligne », « vu il y a… », « écrit… ».
 *
 * ## Ce qui n'est pas affiché, et pourquoi
 *
 * Rien du tout quand `activite` est absente. C'est le cas tant que le partage
 * n'est pas actif des deux côtés — et il ne faut alors surtout pas écrire
 * « hors ligne », qui laisserait croire à une information alors qu'on n'en a
 * aucune. Une ligne vide est plus honnête qu'une ligne fausse.
 *
 * Pas d'heure exacte non plus : « vu il y a 5 min » plutôt que « vu à 23:47 ».
 * L'heure précise invite à recouper avec l'horodatage du dernier message, et
 * c'est de là que naissent les reproches que ce projet cherche à éviter.
 */
export function LignePresence({ activite }: Props) {
  if (!activite) return null;

  if (activite.ecrit) {
    return (
      <View style={styles.rangee}>
        <PointsDeSaisie />
        <Texte variante="meta" style={styles.actif}>
          écrit…
        </Texte>
      </View>
    );
  }

  if (activite.enLigne) {
    return (
      <View style={styles.rangee}>
        <View style={styles.pastille} />
        <Texte variante="meta" style={styles.actif}>
          en ligne
        </Texte>
      </View>
    );
  }

  if (!activite.vuLe) return null;

  return (
    <Texte variante="meta" numberOfLines={1}>
      {/* « vu » sans le prénom : on est déjà dans sa conversation. */}
      vu {ilYA(activite.vuLe)}
    </Texte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: espacements.xxs },
  pastille: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // Bleu d'accent plutôt que le vert des messageries : la palette du
    // projet n'en a pas, et en introduire un pour un point de six pixels
    // ferait entrer une couleur de plus sans aucune autre justification.
    backgroundColor: colors.accent,
  },
  actif: { color: colors.accent },
}));
