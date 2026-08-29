import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { colors } from '@/design/theme';
import { useHydratation } from '@/lib/useHydratation';
import { EcranVerrou } from './EcranVerrou';
import { useAppVerrouillee, useVerrou } from '../stores/verrouStore';

/**
 * Enveloppe l'app entière. Le verrou est posé ici, au-dessus du routeur, et
 * non sur une route : aucun lien profond, aucune notification ne peut ouvrir un
 * écran en passant à côté.
 */
export function GardeVerrou({ children }: { children: ReactNode }) {
  const verrouillee = useAppVerrouillee();
  const signalerMasquage = useVerrou((e) => e.signalerMasquage);
  const signalerRetour = useVerrou((e) => e.signalerRetour);

  // Hook plutôt qu'un `useState` + `useEffect` écrits ici : la course entre
  // l'état initial et l'abonnement bloquait cet écran pour de bon.
  const pret = useHydratation(useVerrou);

  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') signalerRetour();
      else signalerMasquage();
    });
    return () => abonnement.remove();
  }, [signalerMasquage, signalerRetour]);

  // Tant que le réglage n'est pas relu, on n'affiche rien : montrer le contenu
  // puis le masquer laisserait entrevoir ce que le verrou est censé couvrir.
  if (!pret) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.fond, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return verrouillee ? <EcranVerrou /> : <>{children}</>;
}
