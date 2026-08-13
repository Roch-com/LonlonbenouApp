import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { useSessionServeur } from '../stores/sessionServeurStore';

interface Props {
  onAppaire: () => void;
}

/**
 * Étape « vous relier » de l'onboarding.
 *
 * Elle ne simule plus rien : elle mène au vrai flux d'appairage
 * (`/connexion` puis `/appairage`), arbitré par le serveur. L'ancienne étape
 * fabriquait un code localement, ce qui donnait l'illusion d'un couple relié
 * alors que les deux appareils restaient étrangers l'un à l'autre.
 *
 * On peut la passer : les pôles encore locaux (présence, chat, vie pratique)
 * fonctionnent sans compte. Mais on le dit franchement plutôt que de laisser
 * croire que tout est en place.
 */
export function EtapeAppairage({ onAppaire }: Props) {
  const router = useRouter();
  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const rafraichirLeCouple = useSessionServeur((e) => e.rafraichirLeCouple);

  // Au retour de `/appairage`, l'état du couple a pu changer.
  useEffect(() => {
    if (etat === 'connecte') void rafraichirLeCouple();
  }, [etat, rafraichirLeCouple]);

  if (coupleId) {
    return (
      <Carte>
        <Texte variante="titre">Vous êtes reliés</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Vos deux comptes se parlent. Ce qui passe par le serveur — les axes de
          croissance, le cycle — arrivera bien de l’un à l’autre.
        </Texte>
        <View style={styles.actions}>
          <Bouton libelle="Continuer" onPress={onAppaire} />
        </View>
      </Carte>
    );
  }

  return (
    <Carte>
      <Texte variante="titre">Relier vos deux appareils</Texte>
      <Texte variante="corpsDoux" style={styles.intro}>
        {etat === 'connecte'
          ? 'Votre compte existe, mais il n’est encore relié à personne. L’appairage se fait une fois, avec un code que l’un transmet à l’autre.'
          : 'Chacun crée son compte sur son propre téléphone, puis l’un transmet un code à l’autre. C’est ce qui permet à ce que vous écrivez d’arriver jusqu’à votre partenaire.'}
      </Texte>

      <View style={styles.actions}>
        {etat === 'connecte' ? (
          <Bouton
            libelle="Relier nos comptes"
            onPress={() => router.push('/appairage')}
          />
        ) : (
          <Bouton
            libelle="Créer mon compte"
            onPress={() => router.push('/connexion')}
          />
        )}
        <Bouton libelle="Plus tard" ton="discret" onPress={onAppaire} />
      </View>

      <Texte variante="meta" style={styles.mention}>
        En passant cette étape, l’app reste utilisable, mais tout demeure sur ce
        téléphone : rien ne parvient à votre partenaire.
      </Texte>
    </Carte>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: espacements.xs },
  actions: { marginTop: espacements.lg, gap: espacements.sm },
  mention: { marginTop: espacements.md, color: colors.texteDoux },
});
