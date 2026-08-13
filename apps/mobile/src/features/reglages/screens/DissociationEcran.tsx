import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Ecran, EnTete, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { useAutre } from '../stores/sessionStore';
import {
  ACCES_REVOQUES,
  dissocierLeCouple,
  repartirDeZero,
} from '../services/dissociation';

type Etape = 'explication' | 'confirmation' | 'faite';

/**
 * Pôle ⑥ — Dissociation de compte.
 *
 * Deux principes de rédaction, autant que de code : dire exactement ce qui va
 * se passer, et ne jamais tenter de retenir. Pas de « êtes-vous sûr, pensez à
 * tous ces souvenirs » : quelqu'un qui quitte une relation n'a pas à négocier
 * avec une application.
 */
export function DissociationEcran() {
  const router = useRouter();
  const autre = useAutre();
  const [etape, setEtape] = useState<Etape>('explication');
  const [enCours, setEnCours] = useState(false);

  const dissocier = async () => {
    setEnCours(true);
    await dissocierLeCouple();
    setEnCours(false);
    setEtape('faite');
  };

  if (etape === 'faite') {
    return (
      <Ecran>
        <EnTete surtitre="C’est fait" titre="Les accès sont coupés" />
        <Carte>
          <Texte variante="corps">
            Plus rien n’est accessible, ni pour vous ni pour {autre.prenom}. Les
            données de cet appareil sont devenues illisibles et les partages sont
            tous éteints.
          </Texte>
          <Texte variante="corpsDoux" style={styles.espace}>
            Prenez soin de vous.
          </Texte>
        </Carte>
        <Bouton
          libelle="Fermer"
          onPress={() => {
            router.dismissAll();
            repartirDeZero();
          }}
        />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <EnTete
        surtitre="Dissociation"
        titre="Séparer vos deux comptes"
        sousTitre="Sans détour : voici exactement ce qui se passe."
      />

      <Carte>
        <Texte variante="surtitre">Ce qui est révoqué, dans les deux sens</Texte>
        <View style={styles.liste}>
          {ACCES_REVOQUES.map((acces) => (
            <Texte key={acces} variante="corps">
              · {acces}
            </Texte>
          ))}
        </View>
        <Texte variante="corpsDoux" style={styles.espace}>
          La coupure est symétrique et immédiate. Il n’existe aucun état où l’un
          de vous garderait un accès que l’autre a perdu.
        </Texte>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Ce qui disparaît</Texte>
        <Texte variante="corps" style={styles.espace}>
          La clé qui protège les données de cet appareil est détruite en premier.
          Dès cet instant, la conversation, les souvenirs, les lettres et tout le
          reste deviennent illisibles — définitivement, y compris pour vous.
        </Texte>
        <Texte variante="corpsDoux" style={styles.espace}>
          Il n’y a pas de sauvegarde et pas de retour en arrière. Si vous
          souhaitez garder une trace de quelque chose, faites-le avant.
        </Texte>
      </Carte>

      {etape === 'explication' ? (
        <View style={styles.actions}>
          <Bouton
            libelle="J’ai lu, continuer"
            ton="secondaire"
            onPress={() => setEtape('confirmation')}
          />
          <Bouton libelle="Revenir" ton="discret" onPress={() => router.back()} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Texte variante="corps" style={styles.question}>
            Dissocier maintenant ?
          </Texte>
          <Bouton
            libelle="Dissocier nos comptes"
            ton="urgence"
            enCours={enCours}
            onPress={() => void dissocier()}
          />
          <Bouton
            libelle="Pas maintenant"
            ton="discret"
            onPress={() => setEtape('explication')}
          />
        </View>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  liste: { marginTop: espacements.sm, gap: espacements.xs },
  espace: { marginTop: espacements.md },
  actions: { gap: espacements.sm },
  question: { textAlign: 'center', color: colors.texte },
});
