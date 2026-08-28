import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import type { VuePartenaire } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';

interface Props {
  prenomAutre: string;
  vue: VuePartenaire;
  compact?: boolean;
}

/**
 * Ce que voit le partenaire — et **uniquement** ce que le serveur a bien voulu
 * mettre en forme. Ce composant n'a accès à aucune donnée de cycle : ni dates,
 * ni symptômes, ni jour du cycle ne sont jamais descendus jusqu'ici. Il ne
 * peut donc pas en révéler par accident.
 */
export function VuePartenaireCycle({ prenomAutre, vue, compact }: Props) {
  if (!vue.partage) {
    if (compact) return null;
    return (
      <Carte discrete>
        <Texte variante="surtitre">Cycle</Texte>
        <Texte variante="corpsDoux" style={styles.espace}>
          {prenomAutre} n’a rien mis en partage ici, et c’est entièrement son choix.
          Il n’y a rien à demander ni à attendre.
        </Texte>
      </Carte>
    );
  }

  return (
    <Carte>
      <Texte variante="surtitre">
        Le cycle de {prenomAutre}
        {vue.niveau === 'phases' ? ` · ${vue.libellePhase}` : ''}
      </Texte>

      <Texte variante="corps" style={styles.espace}>
        {vue.lecture}
      </Texte>

      {vue.niveau === 'phases' && !compact ? (
        <View style={styles.attentions}>
          {vue.attentions.map((attention) => (
            <Texte key={attention} variante="corpsDoux">
              · {attention}
            </Texte>
          ))}
        </View>
      ) : null}

      <View style={styles.rappel}>
        <Texte variante="petit">{vue.rappel}</Texte>
      </View>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  espace: { marginTop: espacements.xs },
  attentions: { marginTop: espacements.md, gap: espacements.xs },
  rappel: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
}));
