import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { relire, type Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';

interface Props {
  texte: string;
}

/**
 * Pôle ② — assistant de reformulation (§8.5).
 *
 * ## Il ne corrige pas, il montre
 *
 * Aucune réécriture automatique, aucun bouton « corriger ». Une version lissée
 * par la machine, que l'autre lirait comme votre phrase, ferait de l'app un
 * ventriloque — et un axe de croissance ne vaut que s'il est de vous.
 *
 * ## Il ne bloque rien
 *
 * Ces remarques n'empêchent jamais d'enregistrer. Une phrase dure est parfois
 * exactement ce qu'il faut dire, et une app qui refuserait de la transmettre
 * déciderait de la conversation à la place du couple.
 *
 * ## Il se tait quand il n'a rien à dire
 *
 * Pas de félicitations, pas de coche verte. Écrire un axe n'est pas un
 * exercice qu'on réussit, et le récompenser serait déplacé.
 */
export function Relecture({ texte }: Props) {
  const colors = useCouleurs();
  const remarques = relire(texte);

  // Sous une phrase courte, il n'y a rien à relire : signaler un « toujours »
  // dans trois mots donnerait un conseil avant même que l'idée soit posée.
  if (texte.trim().length < 15 || remarques.length === 0) return null;

  return (
    <View style={styles.bloc}>
      {remarques.map((remarque) => (
        <View key={remarque.sorte} style={styles.remarque}>
          <View style={styles.entete}>
            <Feather name="edit-3" size={14} color={colors.accentFonce} />
            <Texte variante="meta" style={styles.extrait}>
              « {remarque.extrait} »
            </Texte>
          </View>
          <Texte variante="petit">{remarque.pourquoi}</Texte>
          <Texte variante="petit" style={styles.piste}>
            {remarque.piste}
          </Texte>
        </View>
      ))}

      <Texte variante="meta">
        Ce ne sont que des pistes. Vous pouvez enregistrer votre phrase telle
        qu’elle est — c’est la vôtre.
      </Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bloc: { gap: espacements.md, marginTop: espacements.xs },
  remarque: {
    gap: espacements.xxs,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espacements.xs },
  extrait: { color: colors.accentFonce },
  piste: { color: colors.texte },
}));
