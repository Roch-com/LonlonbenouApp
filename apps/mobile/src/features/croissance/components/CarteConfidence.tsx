import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Confidence } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';
import { ilYA } from '@/lib/temps';

interface Props {
  confidence: Confidence;
  /** Identite du serveur : c'est elle qui fait foi, pas la session locale. */
  moiId: string;
  prenomAutre: string;
  onLue: () => void;
}

export function CarteConfidence({ confidence, moiId, prenomAutre, onLue }: Props) {
  const deMoi = confidence.auteurId === moiId;
  const nonLue = !deMoi && !confidence.luLe;

  useEffect(() => {
    if (nonLue) onLue();
  }, [nonLue, onLue]);

  return (
    <Carte style={deMoi ? undefined : styles.recue}>
      <View style={styles.entete}>
        <Texte variante="surtitre">
          {deMoi ? `À ${prenomAutre}` : `De ${prenomAutre}`}
        </Texte>
        {nonLue ? (
          <View style={styles.pastille}>
            <Texte variante="meta" style={styles.pastilleTexte}>
              nouveau
            </Texte>
          </View>
        ) : null}
      </View>

      {confidence.titre ? (
        <Texte variante="titre" style={styles.titre}>
          {confidence.titre}
        </Texte>
      ) : null}

      <Texte variante={confidence.type === 'gratitude' ? 'sousTitre' : 'corps'}>
        {confidence.texte}
      </Texte>

      <Texte variante="meta" style={styles.pied}>
        {confidence.envoyeeLe ? ilYA(confidence.envoyeeLe) : ilYA(confidence.creeLe)}
      </Texte>
    </Carte>
  );
}

const styles = StyleSheet.create({
  recue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.tendresse,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },
  pastille: {
    paddingVertical: 2,
    paddingHorizontal: espacements.xs,
    borderRadius: rayons.rond,
    backgroundColor: colors.tendresseDouce,
  },
  pastilleTexte: { color: colors.tendresse },
  titre: { marginTop: espacements.xs },
  pied: { marginTop: espacements.sm },
});
