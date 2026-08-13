import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, polices, typography } from '@/design/theme';
import { useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useMessagesNonLus } from '@/features/presence/stores/chatStore';
import { useConfidencesNonLues } from '@/features/croissance/stores/confidencesStore';

export default function DispositionOnglets() {
  const moi = useMoi();
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const nonLus = useMessagesNonLus(partenaireId ?? '');
  const confidencesNonLues = useConfidencesNonLues(moi.id);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentFonce,
        tabBarInactiveTintColor: colors.texteDoux,
        tabBarStyle: {
          backgroundColor: colors.fondEleve,
          borderTopColor: colors.bordure,
        },
        tabBarLabelStyle: {
          fontFamily: polices.corpsMoyen,
          fontSize: typography.tailles.minuscule,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="presence"
        options={{
          title: 'Présence',
          tabBarIcon: ({ color, size }) => (
            <Feather name="map-pin" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Nous deux',
          tabBarBadge: nonLus > 0 ? nonLus : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.tendresse },
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pratique"
        options={{
          title: 'Pratique',
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="croissance"
        options={{
          title: 'Croissance',
          tabBarBadge: confidencesNonLues > 0 ? confidencesNonLues : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.tendresse },
          tabBarIcon: ({ color, size }) => (
            <Feather name="feather" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="nous"
        options={{
          title: 'Notre espace',
          tabBarIcon: ({ color, size }) => (
            <Feather name="heart" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
