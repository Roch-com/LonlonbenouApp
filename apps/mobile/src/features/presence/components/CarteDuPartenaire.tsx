import { StyleSheet, View } from 'react-native';
import {
  definitionHumeur,
  definitionStatut,
  type CodeHumeur,
  type CodeStatut,
} from '@lonlonbenu/shared';
import { Avatar, Carte, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';

/**
 * Ce que je vois de l'autre.
 *
 * Symétrique par construction, et désormais **garanti par le serveur** : sans
 * réciprocité, son statut n'est même pas descendu jusqu'ici. La carte ne peut
 * donc pas le révéler par erreur d'affichage.
 */
export function CarteDuPartenaire() {
  const autre = useAutre();
  const { autre: statut, humeurDeLautre, partageActif } = usePresenceLisible();

  if (!partageActif) {
    return (
      <Carte discrete>
        <View style={styles.entete}>
          <Avatar partenaire={autre} taille={52} />
          <View style={styles.identite}>
            <Texte variante="titre">{autre.prenom}</Texte>
            <Texte variante="petit">
              Le partage de présence n’est pas actif des deux côtés. Rien n’est
              visible — ni pour vous, ni pour {autre.prenom}.
            </Texte>
          </View>
        </View>
      </Carte>
    );
  }

  return (
    <Carte>
      <View style={styles.entete}>
        <Avatar partenaire={autre} taille={52} />
        <View style={styles.identite}>
          <Texte variante="titre">{autre.prenom}</Texte>
          {statut ? (
            <Texte variante="petit">
              {definitionStatut(statut.code as CodeStatut).emoji} {autre.prenom}{' '}
              {definitionStatut(statut.code as CodeStatut).lecture} ·{' '}
              {ilYA(statut.majLe)}
            </Texte>
          ) : (
            <Texte variante="petit">N’a pas encore partagé de statut</Texte>
          )}
        </View>
      </View>

      {statut?.note ? (
        <Texte variante="corpsDoux" style={styles.note}>
          « {statut.note} »
        </Texte>
      ) : null}

      {humeurDeLautre ? (
        <View style={styles.humeur}>
          <Texte variante="petit">
            Humeur du jour · {definitionHumeur(humeurDeLautre.code as CodeHumeur).emoji}{' '}
            {definitionHumeur(humeurDeLautre.code as CodeHumeur).libelle}
            {humeurDeLautre.mot ? ` — ${humeurDeLautre.mot}` : ''}
          </Texte>
        </View>
      ) : null}
    </Carte>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  identite: { flex: 1, gap: espacements.xxs },
  note: { marginTop: espacements.md, fontStyle: 'italic' },
  humeur: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
});
