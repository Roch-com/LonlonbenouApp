import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCouleurs } from '@/design/ThemeProvider';
import { chrome, espacements, ombres, polices, rayons } from '@/design/theme';
import { useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useMessagesNonLus } from '@/features/presence/stores/chatStore';
import { useConfidencesNonLues } from '@/features/croissance/stores/confidencesStore';

/**
 * Barre d'onglets — cinq destinations, pas six.
 *
 * La sixième (« Notre espace ») a rejoint le menu. À six, chaque onglet
 * disposait d'une soixantaine de points sur un écran de 360 : les libellés se
 * tronquaient, et une barre saturée fait perdre la hiérarchie qu'elle est
 * censée donner. Cinq est la limite haute reconnue, et c'est déjà beaucoup.
 */
export default function DispositionOnglets() {
  const colors = useCouleurs();
  const marges = useSafeAreaInsets();
  const moi = useMoi();
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const nonLus = useMessagesNonLus(partenaireId ?? '');
  const confidencesNonLues = useConfidencesNonLues(moi.id);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentFonce,
        tabBarInactiveTintColor: colors.texteVoile,
        // La barre flotte au-dessus du contenu : `Ecran` réserve exactement
        // `chrome.barreOnglets` pour que rien ne passe dessous.
        tabBarStyle: {
          position: 'absolute',
          height: chrome.barreOnglets + marges.bottom,
          paddingTop: espacements.xs,
          paddingBottom: marges.bottom || espacements.xs,
          backgroundColor: colors.fondEleve,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.bordure,
          ...ombres.effleuree,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontFamily: polices.corpsMoyen,
          fontSize: 10,
          letterSpacing: 0.2,
          marginTop: 2,
        },
        // Un libellé qui rétrécit reste lisible ; un libellé tronqué par des
        // points de suspension ne veut plus rien dire.
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: {
          backgroundColor: colors.tendresse,
          color: colors.texteInverse,
          fontFamily: polices.corpsFort,
          fontSize: 10,
          minWidth: 18,
          lineHeight: Platform.OS === 'ios' ? 16 : 14,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: (etat) => <Icone nom="home" {...etat} />,
        }}
      />
      <Tabs.Screen
        name="presence"
        options={{
          title: 'Présence',
          tabBarIcon: (etat) => <Icone nom="map-pin" {...etat} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Nous deux',
          tabBarBadge: nonLus > 0 ? nonLus : undefined,
          tabBarIcon: (etat) => <Icone nom="message-circle" {...etat} />,
        }}
      />
      <Tabs.Screen
        name="pratique"
        options={{
          title: 'Pratique',
          tabBarIcon: (etat) => <Icone nom="calendar" {...etat} />,
        }}
      />
      <Tabs.Screen
        name="croissance"
        options={{
          title: 'Croissance',
          tabBarBadge: confidencesNonLues > 0 ? confidencesNonLues : undefined,
          tabBarIcon: (etat) => <Icone nom="feather" {...etat} />,
        }}
      />
    </Tabs>
  );
}

/**
 * L'onglet actif reçoit une pastille ivoire derrière son icône. C'est le seul
 * repère qui reste lisible quand la couleur ne suffit pas — luminosité forte,
 * ou daltonisme.
 */
function Icone({
  nom,
  color,
  focused,
}: {
  nom: keyof typeof Feather.glyphMap;
  // React Navigation annonce une `ColorValue`, pas une chaîne : elle peut être
  // un objet opaque sur les plateformes qui gèrent les couleurs dynamiques.
  color: ColorValue;
  focused: boolean;
}) {
  const couleurs = useCouleurs();

  return (
    <View
      style={[
        styles.icone,
        // La pastille de l'onglet actif suit le thème : dans une feuille
        // statique, elle gardait l'ivoire du mode clair et formait une tache
        // pâle sur la barre sombre.
        focused && { backgroundColor: couleurs.fondNuance },
      ]}
    >
      <Feather name={nom} color={color} size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  icone: {
    width: 40,
    height: 30,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
