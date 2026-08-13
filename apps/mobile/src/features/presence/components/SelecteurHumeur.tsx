import { StyleSheet, View } from 'react-native';
import { HUMEURS } from '@lonlonbenu/shared';
import { Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';
import { usePresence } from '../stores/presenceStore';

/** Humeur du jour — P0 du chat. Déclarative, jamais déduite ni notée. */
export function SelecteurHumeur() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const { monHumeur } = usePresenceLisible();
  const definirHumeur = usePresence((e) => e.definirHumeur);

  if (!coupleId || !partenaireId) return null;

  return (
    <View style={styles.bloc}>
      <Texte variante="surtitre">Mon humeur</Texte>
      <View style={styles.puces}>
        {HUMEURS.map((h) => (
          <Puce
            key={h.code}
            libelle={h.libelle}
            emoji={h.emoji}
            active={monHumeur?.code === h.code}
            onPress={() =>
              void definirHumeur(coupleId, partenaireId, h.code, monHumeur?.mot)
            }
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.sm },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
});
