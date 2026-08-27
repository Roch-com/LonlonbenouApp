import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  useFonts,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from '@expo-google-fonts/manrope';
import { colors } from '@/design/theme';
import { GardeVerrou } from '@/features/reglages/components/GardeVerrou';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { GardeOnboarding } from '@/features/reglages/components/GardeOnboarding';
import { configurerAffichagePush } from '@/features/reglages/services/affichagePush';
import { useInscriptionPush } from '@/features/reglages/hooks/useInscriptionPush';
import { demarrerLaSurveillance } from '@/lib/surveillance';

// Hors du composant : l'initialisation doit précéder le premier rendu, sinon
// une erreur survenue pendant ce rendu — le cas le plus fréquent — échapperait
// au suivi.
const surveille = demarrerLaSurveillance();

function DispositionRacine() {
  const [policesPretes] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_500Medium_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  useEffect(() => {
    configurerAffichagePush();
    // Reprise de session : le jeton d'accès n'est jamais persisté, il se
    // regagne au démarrage à partir du jeton de rafraîchissement du trousseau.
    void useSessionServeur.getState().restaurer();
  }, []);

  useInscriptionPush();

  if (!policesPretes) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.fond, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <GardeVerrou>
        <GardeOnboarding>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.fond },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="sos"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="transparence-score"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="reglages"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="connexion"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="appairage"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="cycle"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="notifications"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="nous"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="dissociation"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        </GardeOnboarding>
      </GardeVerrou>
    </SafeAreaProvider>
  );
}

/**
 * `Sentry.wrap` capture les erreurs de rendu React, que les gestionnaires
 * globaux ne voient pas. Sans DSN, l'enveloppe est neutre — on la pose
 * inconditionnellement pour qu'activer le suivi ne demande qu'une variable
 * d'environnement, jamais un changement de code.
 */
export default surveille ? Sentry.wrap(DispositionRacine) : DispositionRacine;
