import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ecran, EnTete, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { SectionAxes } from '../components/SectionAxes';
import { SectionConfidences } from '../components/SectionConfidences';
import { SectionScore } from '../components/SectionScore';

type Onglet = 'axes' | 'confidences' | 'elan';

/** Pôle ② — Communication profonde & croissance (P0). */
export function CroissanceEcran() {
  const autre = useAutre();
  const [onglet, setOnglet] = useState<Onglet>('axes');

  return (
    <Ecran>
      <EnTete
        surtitre="Croissance"
        titre="Se dire les choses"
        sousTitre={SOUS_TITRES[onglet](autre.prenom)}
      />

      <View style={styles.segments}>
        <Segment
          libelle="Axes de croissance"
          actif={onglet === 'axes'}
          onPress={() => setOnglet('axes')}
        />
        <Segment
          libelle="Confidences"
          actif={onglet === 'confidences'}
          onPress={() => setOnglet('confidences')}
        />
        <Segment
          libelle="Notre élan"
          actif={onglet === 'elan'}
          onPress={() => setOnglet('elan')}
        />
      </View>

      {onglet === 'axes' ? <SectionAxes /> : null}
      {onglet === 'confidences' ? <SectionConfidences /> : null}
      {onglet === 'elan' ? <SectionScore /> : null}
    </Ecran>
  );
}

const SOUS_TITRES: Record<Onglet, (prenomAutre: string) => string> = {
  axes: (autre) => `Ce que vous décidez de regarder avec ${autre}.`,
  confidences: (autre) => `Ce que vous choisissez d’offrir à ${autre}.`,
  elan: () => 'Vos gestes récents, à deux. Jamais une note de l’un ou de l’autre.',
};

function Segment({
  libelle,
  actif,
  onPress,
}: {
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={[styles.segment, actif && styles.segmentActif]}
    >
      <Texte
        variante="petit"
        style={actif ? styles.segmentTexteActif : styles.segmentTexte}
      >
        {libelle}
      </Texte>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: espacements.xxs,
    padding: espacements.xxs,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    marginBottom: espacements.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: espacements.sm,
    borderRadius: rayons.rond,
    alignItems: 'center',
  },
  segmentActif: { backgroundColor: colors.fondEleve },
  segmentTexte: { color: colors.texteDoux },
  segmentTexteActif: { color: colors.accentFonce },
});
