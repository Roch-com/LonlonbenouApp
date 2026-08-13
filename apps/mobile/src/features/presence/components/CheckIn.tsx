import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LIEUX_SUGGERES } from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';
import { usePresence } from '../stores/presenceStore';

/**
 * Check-in P0 : le lieu est choisi ou saisi à la main. Rien n'est capté
 * automatiquement — et **le lieu part scellé** : le serveur le range sans
 * pouvoir le lire.
 */
export function CheckIn() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const faireUnCheckIn = usePresence((e) => e.faireUnCheckIn);
  const { checkIns } = usePresenceLisible();

  const [lieu, setLieu] = useState('');
  const [mot, setMot] = useState('');

  const dernier = checkIns.find((c) => c.partenaireId === partenaireId);

  const valider = async () => {
    if (!lieu.trim() || !coupleId || !partenaireId) return;
    if (await faireUnCheckIn(coupleId, partenaireId, lieu, mot)) {
      setLieu('');
      setMot('');
    }
  };

  return (
    <Carte>
      <Texte variante="surtitre">Check-in</Texte>
      <Texte variante="corpsDoux" style={styles.intro}>
        Dire où tu es, quand tu en as envie.
      </Texte>

      <View style={styles.puces}>
        {LIEUX_SUGGERES.map((suggestion) => (
          <Puce
            key={suggestion}
            libelle={suggestion}
            active={lieu === suggestion}
            onPress={() => setLieu(suggestion)}
          />
        ))}
      </View>

      <View style={styles.champs}>
        <Champ
          placeholder="Ou un autre endroit…"
          value={lieu}
          onChangeText={setLieu}
        />
        <Champ
          placeholder="Un mot pour l’accompagner (facultatif)"
          value={mot}
          onChangeText={setMot}
        />
        <Bouton
          libelle="Partager ma présence"
          onPress={() => void valider()}
          disabled={!lieu.trim()}
        />
      </View>

      {dernier ? (
        <Texte variante="petit" style={styles.dernier}>
          Dernier check-in : {dernier.lieu} · {ilYA(dernier.faitLe)}
        </Texte>
      ) : null}
    </Carte>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  dernier: { marginTop: espacements.md },
});
