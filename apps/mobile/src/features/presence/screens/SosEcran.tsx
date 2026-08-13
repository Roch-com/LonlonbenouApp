import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bouton, Carte, Champ, Ecran, EnTete, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { usePresence } from '../stores/presenceStore';

/**
 * Pôle ① — SOS (P0).
 *
 * Déclenchement volontaire, en deux temps. L'alerte parvient à l'autre **même
 * si le partage de position est en pause** : c'est le serveur qui le garantit.
 */
export function SosEcran() {
  const router = useRouter();
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const declencherSos = usePresence((e) => e.declencherSos);
  const erreur = usePresence((e) => e.erreur);

  const [lieu, setLieu] = useState('');
  const [message, setMessage] = useState('');
  const [confirme, setConfirme] = useState(false);

  const envoyer = async () => {
    if (!coupleId || !partenaireId) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (await declencherSos(coupleId, partenaireId, lieu, message)) router.back();
  };

  return (
    <Ecran>
      <EnTete
        surtitre="SOS"
        titre="Besoin d’aide ?"
        sousTitre={`${autre.prenom} recevra une alerte immédiate.`}
      />

      <Carte>
        <Texte variante="corpsDoux">
          Tu peux envoyer l’alerte telle quelle. Les précisions ci-dessous sont
          facultatives — ne perds pas de temps si tu n’en as pas.
        </Texte>

        <View style={styles.champs}>
          <Champ
            etiquette="Où es-tu ?"
            placeholder="Facultatif"
            value={lieu}
            onChangeText={setLieu}
          />
          <Champ
            etiquette="Un message"
            placeholder="Facultatif"
            value={message}
            onChangeText={setMessage}
            multiline
          />
        </View>
      </Carte>

      {erreur ? (
        <Carte discrete>
          <Texte variante="petit">{erreur}</Texte>
        </Carte>
      ) : null}

      {confirme ? (
        <View style={styles.confirmation}>
          <Texte variante="corps" style={styles.question}>
            Envoyer l’alerte à {autre.prenom} maintenant ?
          </Texte>
          <Bouton libelle="Oui, envoyer le SOS" ton="urgence" onPress={() => void envoyer()} />
          <Bouton
            libelle="Annuler"
            ton="discret"
            onPress={() => setConfirme(false)}
          />
        </View>
      ) : (
        <Bouton
          libelle="Préparer l’alerte"
          ton="urgence"
          onPress={() => setConfirme(true)}
        />
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  champs: { gap: espacements.md, marginTop: espacements.md },
  confirmation: { gap: espacements.sm },
  question: { textAlign: 'center' },
});
