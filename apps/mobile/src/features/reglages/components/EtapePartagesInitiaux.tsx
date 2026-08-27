import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ReglagePartage } from './ReglagePartage';
import { useAutre } from '../stores/sessionStore';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Configuration initiale des partages.
 *
 * Deux mécanismes radicalement différents, et c'est volontaire de les montrer
 * ensemble — les voir côte à côte fait comprendre la différence :
 *
 *   - **Carte & Présence** est un partage réciproque : il n'existe que si les
 *     deux l'activent, chacun de son côté.
 *   - **Cycle** ne se négocie pas. Seule la personne concernée choisit son
 *     niveau, et l'autre ne peut littéralement pas le faire à sa place.
 *
 * Le cycle n'est plus réglé ici : il vit sur le serveur, qui est seul à savoir
 * qui a le droit d'écrire. Cette étape y mène plutôt que d'en tenir une copie
 * locale qui aurait divergé en silence.
 */
export function EtapePartagesInitiaux() {
  const router = useRouter();
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);

  return (
    <View style={styles.section}>
      <Carte>
        <Texte variante="titre">Carte & Présence</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Chacun active de son côté. Tant que vous n’êtes pas deux, rien n’est
          visible — ni pour vous, ni pour {autre.prenom}. Vous pourrez revenir
          là-dessus à tout moment, sans avoir à vous justifier.
        </Texte>
        <ReglagePartage module="position" sansTitre />
      </Carte>

      <Carte>
        <Texte variante="titre">Cycle</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Si l’un de vous suit son cycle, c’est cette personne — et elle seule — qui
          décide de ce qui est partagé, et qui peut en changer. Personne ne peut le
          régler à sa place, pas même ici.
        </Texte>

        {coupleId ? (
          <View style={styles.action}>
            <Bouton
              libelle="Ouvrir le cycle"
              ton="secondaire"
              onPress={() => router.push('/cycle')}
            />
          </View>
        ) : (
          <Texte variante="meta" style={styles.mention}>
            Ce module a besoin de vos deux comptes reliés. Vous le trouverez dans
            l’app dès que ce sera fait — rien ne presse.
          </Texte>
        )}
      </Carte>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: espacements.md },
  intro: { marginTop: espacements.xs },
  action: { marginTop: espacements.lg },
  mention: { marginTop: espacements.md },
});
