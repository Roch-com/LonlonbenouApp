import { StyleSheet, View } from 'react-native';
import { STATUTS, type CodeStatut } from '@lonlonbenu/shared';
import { Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';
import { usePresence } from '../stores/presenceStore';

/** Statuts manuels — P0 du module Carte & Présence, sans géolocalisation. */
export function SelecteurStatut() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const { mien } = usePresenceLisible();
  const definirStatut = usePresence((e) => e.definirStatut);

  if (!coupleId || !partenaireId) return null;

  return (
    <View style={styles.bloc}>
      <Texte variante="surtitre">Mon statut</Texte>
      <View style={styles.puces}>
        {STATUTS.map((s) => (
          <Puce
            key={s.code}
            libelle={s.libelle}
            emoji={s.emoji}
            active={mien?.code === s.code}
            onPress={() =>
              void definirStatut(coupleId, partenaireId, s.code as CodeStatut, mien?.note)
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
