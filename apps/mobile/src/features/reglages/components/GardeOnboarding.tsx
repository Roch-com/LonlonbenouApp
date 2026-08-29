import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/design/theme';
import { useHydratation } from '@/lib/useHydratation';
import { OnboardingEcran } from '../screens/OnboardingEcran';
import { useSession } from '../stores/sessionStore';

/**
 * Tant que l'onboarding conjoint n'est pas fait, rien d'autre ne s'affiche.
 * Placé sous le verrou : on déverrouille d'abord, on configure ensuite.
 */
export function GardeOnboarding({ children }: { children: ReactNode }) {
  const fait = useSession((e) => e.onboardingFait);
  // Hook plutôt qu'un `useState` + `useEffect` écrits ici : la course entre
  // l'état initial et l'abonnement bloquait cet écran pour de bon.
  const pret = useHydratation(useSession);

  if (!pret) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.fond, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return fait ? <>{children}</> : <OnboardingEcran />;
}
