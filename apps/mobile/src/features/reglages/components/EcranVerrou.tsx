import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LONGUEUR_PIN_MIN } from '@lonlonbenu/shared';
import { Bouton, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { ClavierPin } from './ClavierPin';
import { useVerrou } from '../stores/verrouStore';

/**
 * Porte d'entrée de l'app. La biométrie est tentée d'emblée ; le code reste
 * accessible en dessous, sans avoir à échouer d'abord.
 *
 * La validation est explicite : déclencher la vérification dès la longueur
 * minimale atteinte rendrait impossible l'usage d'un code à cinq ou six
 * chiffres.
 */
export function EcranVerrou() {
  const marges = useSafeAreaInsets();
  const biometrieActivee = useVerrou((e) => e.biometrie);
  const tenterBiometrie = useVerrou((e) => e.tenterBiometrie);
  const tenterPin = useVerrou((e) => e.tenterPin);

  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const biometrieTentee = useRef(false);

  useEffect(() => {
    if (biometrieTentee.current || !biometrieActivee) return;
    biometrieTentee.current = true;
    void tenterBiometrie();
  }, [biometrieActivee, tenterBiometrie]);

  const valider = async () => {
    if (enCours || pin.length < LONGUEUR_PIN_MIN) return;
    setEnCours(true);
    const resultat = await tenterPin(pin);
    setEnCours(false);
    if (!resultat.ok) {
      setMessage(resultat.message);
      setPin('');
    }
  };

  return (
    <View style={[styles.fond, { paddingTop: marges.top + espacements.xl }]}>
      <View style={styles.entete}>
        <Texte variante="surtitre">LONLONBENU</Texte>
        <Texte variante="affiche">Votre espace est fermé</Texte>
        <Texte variante="corpsDoux" style={styles.sousTitre}>
          Ce qui est ici n’appartient qu’à vous deux.
        </Texte>
      </View>

      <ClavierPin
        valeur={pin}
        onChange={(valeur) => {
          setMessage(undefined);
          setPin(valeur);
        }}
        desactive={enCours}
      />

      <View
        style={[styles.pied, { paddingBottom: marges.bottom + espacements.lg }]}
      >
        <Texte variante="petit" style={styles.message}>
          {message ??
            (enCours ? 'Vérification…' : 'Saisissez votre code, puis validez.')}
        </Texte>

        <Bouton
          libelle="Déverrouiller"
          onPress={() => void valider()}
          enCours={enCours}
          disabled={pin.length < LONGUEUR_PIN_MIN}
        />

        {biometrieActivee ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void tenterBiometrie()}
            hitSlop={12}
          >
            <Texte variante="corps" style={styles.lien}>
              Utiliser la biométrie
            </Texte>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex: 1,
    backgroundColor: colors.fond,
    paddingHorizontal: espacements.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entete: { alignItems: 'center', gap: espacements.xxs },
  sousTitre: { textAlign: 'center' },
  pied: { alignSelf: 'stretch', alignItems: 'center', gap: espacements.md },
  message: { textAlign: 'center', minHeight: 20 },
  lien: { color: colors.accentFonce },
});
