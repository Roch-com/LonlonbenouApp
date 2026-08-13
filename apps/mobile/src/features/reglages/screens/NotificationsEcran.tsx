import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Ecran, EnTete, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { usePush } from '../stores/pushStore';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Pôle ⑥ — demande de permission pour les notifications poussées.
 *
 * L'écran explique **avant** d'ouvrir la boîte de dialogue système. Une
 * permission demandée sans contexte se refuse par réflexe, et sur iOS elle ne
 * se redemande plus jamais : la personne devrait alors passer par les réglages
 * du téléphone pour revenir dessus.
 *
 * Le refus est présenté comme une réponse valable, pas comme un problème à
 * réparer. Rien dans l'app ne cesse de fonctionner sans notifications — le
 * journal reste consultable — et le partenaire n'en est pas informé.
 */
export function NotificationsEcran() {
  const router = useRouter();

  const permission = usePush((e) => e.permission);
  const inscritLe = usePush((e) => e.inscritLe);
  const factice = usePush((e) => e.factice);
  const erreur = usePush((e) => e.erreur);
  const enCours = usePush((e) => e.enCours);
  const demander = usePush((e) => e.demander);
  const relire = usePush((e) => e.relire);

  const connecte = useSessionServeur((e) => e.etat === 'connecte');

  useEffect(() => {
    void relire();
  }, [relire]);

  return (
    <Ecran>
      <EnTete
        surtitre="Pôle ⑥"
        titre="Notifications"
        sousTitre="Pour que ce qui compte vous parvienne, même l’app fermée."
      />

      <Carte>
        <Texte variante="surtitre">Ce qui arrivera sur votre écran</Texte>
        <Texte variante="corps" style={styles.mention}>
          Une invitation à ouvrir l’app, et rien de plus. Jamais le texte d’un
          message, jamais un prénom, jamais ce dont il s’agit.
        </Texte>
        <Texte variante="meta" style={styles.mention}>
          Une notification passe par les serveurs d’Apple ou de Google et
          s’affiche sur un écran verrouillé, que n’importe qui peut lire par
          dessus votre épaule. Ce qui est écrit dans l’app y reste. Pour le chat,
          la question ne se pose même pas : il est chiffré de bout en bout, et le
          serveur lui-même ne peut pas le lire.
        </Texte>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Vos réglages restent les vôtres</Texte>
        <Texte variante="corps" style={styles.mention}>
          Le silence nocturne, la pause et les fréquences par catégorie
          s’appliquent aussi aux notifications poussées. Accepter ici ne
          contourne rien de ce que vous avez réglé.
        </Texte>
        <Texte variante="meta" style={styles.mention}>
          Seul un SOS traverse tout. C’est la seule exception, et elle n’est pas
          désactivable — dans un sens comme dans l’autre.
        </Texte>
      </Carte>

      {permission === 'accordee' ? (
        <Carte>
          <Texte variante="surtitre">C’est accordé</Texte>
          <Texte variante="corps" style={styles.mention}>
            {inscritLe
              ? 'Cet appareil est inscrit auprès du serveur.'
              : connecte
                ? 'La permission est là, mais l’inscription n’a pas encore abouti. Elle sera retentée à la prochaine ouverture.'
                : 'La permission est là. L’inscription se fera à votre prochaine connexion.'}
          </Texte>

          {factice ? (
            <Texte variante="meta" style={styles.mention}>
              Cet appareil est inscrit avec un jeton de développement :
              l’inscription fonctionne de bout en bout, mais aucune notification
              n’arrivera réellement tant que les comptes Firebase et Apple du
              projet n’existent pas. Ce n’est pas une panne de votre téléphone.
            </Texte>
          ) : null}

          {erreur ? (
            <Texte variante="meta" style={styles.mention}>
              Dernière tentative : {erreur}
            </Texte>
          ) : null}
        </Carte>
      ) : null}

      {permission === 'refusee' ? (
        <Carte>
          <Texte variante="surtitre">Vous avez dit non</Texte>
          <Texte variante="corps" style={styles.mention}>
            C’est entendu, et nous ne le redemanderons pas. Tout continue de
            fonctionner : vous retrouverez dans l’app ce qui vous attend, au
            moment où vous l’ouvrirez.
          </Texte>
          <Texte variante="meta" style={styles.mention}>
            {Platform.OS === 'ios'
              ? 'iOS ne permet de revenir sur ce choix que depuis ses réglages.'
              : 'Vous pouvez revenir sur ce choix depuis les réglages du téléphone.'}
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="Ouvrir les réglages du téléphone"
              ton="secondaire"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        </Carte>
      ) : null}

      {permission === 'indisponible' ? (
        <Carte>
          <Texte variante="corps" style={styles.mention}>
            Cet appareil ne gère pas les notifications poussées. Rien n’est perdu
            pour autant : le journal de l’app garde tout.
          </Texte>
        </Carte>
      ) : null}

      {permission === 'jamais_demandee' ? (
        <View style={styles.actions}>
          <Bouton
            libelle="Autoriser les notifications"
            enCours={enCours}
            onPress={() => void demander()}
          />
          <Bouton
            libelle="Plus tard"
            ton="discret"
            onPress={() => router.back()}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Bouton libelle="Fermer" ton="discret" onPress={() => router.back()} />
        </View>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  mention: { marginTop: espacements.md },
  actions: { marginTop: espacements.md, gap: espacements.sm },
});
