import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/design/theme';
import { OnboardingEcran } from '../screens/OnboardingEcran';
import { useSession } from '../stores/sessionStore';

/**
 * Tant que l'onboarding conjoint n'est pas fait, rien d'autre ne s'affiche.
 * Placé sous le verrou : on déverrouille d'abord, on configure ensuite.
 */
export function GardeOnboarding({ children }: { children: ReactNode }) {
  const fait = useSession((e) => e.onboardingFait);
  const [pret, setPret] = useState(() => useSession.persist.hasHydrated());

  useEffect(() => {
    if (pret) return;
    return useSession.persist.onFinishHydration(() => setPret(true));
  }, [pret]);

  if (!pret) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.fond, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return fait ? <>{children}</> : <OnboardingEcran />;
}
