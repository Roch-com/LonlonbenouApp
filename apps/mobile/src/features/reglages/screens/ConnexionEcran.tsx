import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Champ, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { colors, espacements } from '@/design/theme';
import { CONFIGURATION_API } from '@/lib/api/configuration';
import { useSessionServeur } from '../stores/sessionServeurStore';

type Mode = 'connexion' | 'inscription';

const LONGUEUR_MOT_DE_PASSE_MIN = 10;

export function ConnexionEcran() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('connexion');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  const seConnecter = useSessionServeur((e) => e.seConnecter);
  const sInscrire = useSessionServeur((e) => e.sInscrire);
  const enCours = useSessionServeur((e) => e.enCours);
  const erreur = useSessionServeur((e) => e.erreur);

  const valide =
    courriel.includes('@') && motDePasse.length >= LONGUEUR_MOT_DE_PASSE_MIN;

  const valider = async () => {
    const ok =
      mode === 'connexion'
        ? await seConnecter(courriel.trim(), motDePasse)
        : await sInscrire(courriel.trim(), motDePasse);
    if (ok) router.back();
  };

  return (
    <EcranModale section="Compte">
      <EnTete
        surtitre="Votre compte"
        titre={mode === 'connexion' ? 'Se connecter' : 'Créer un compte'}
        sousTitre="Un compte par personne : c’est ce qui permet à deux appareils de se parler."
      />

      <Carte>
        <View style={styles.champs}>
          <Champ
            etiquette="Courriel"
            value={courriel}
            onChangeText={setCourriel}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Champ
            etiquette="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'connexion' ? 'password' : 'newPassword'}
          />

          {mode === 'inscription' ? (
            <Texte variante="meta">
              {LONGUEUR_MOT_DE_PASSE_MIN} caractères au minimum. C’est lui qui
              protège tout ce que vous écrirez ici.
            </Texte>
          ) : null}

          {erreur ? (
            <Texte variante="petit" style={styles.erreur}>
              {erreur}
            </Texte>
          ) : null}

          <Bouton
            libelle={mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
            onPress={() => void valider()}
            enCours={enCours}
            disabled={!valide}
          />
          <Bouton
            libelle={
              mode === 'connexion'
                ? 'Je n’ai pas encore de compte'
                : 'J’ai déjà un compte'
            }
            ton="discret"
            onPress={() =>
              setMode(mode === 'connexion' ? 'inscription' : 'connexion')
            }
          />
        </View>
      </Carte>

      <Carte discrete>
        <Texte variante="meta">Serveur : {CONFIGURATION_API.base}</Texte>
      </Carte>
    </EcranModale>
  );
}

const styles = StyleSheet.create({
  champs: { gap: espacements.sm },
  erreur: { color: colors.tendresse },
});
