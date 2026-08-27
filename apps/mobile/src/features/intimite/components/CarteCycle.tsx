import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { definitionPhase, quand } from '@lonlonbenu/shared';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { VuePartenaireCycle } from './VuePartenaireCycle';
import { useCycle } from '../stores/cycleStore';

/**
 * Version compacte pour l'accueil. Comme partout, c'est le serveur qui a
 * décidé de la forme : la carte se contente de rendre ce qu'il a envoyé.
 */
export function CarteCycle() {
  const router = useRouter();
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const vue = useCycle((e) => e.vue);
  const charger = useCycle((e) => e.charger);

  useEffect(() => {
    if (connecte && coupleId && partenaireId) {
      void charger(coupleId, partenaireId);
    }
  }, [connecte, coupleId, partenaireId, charger]);

  if (!connecte || !vue) return null;

  if (vue.role === 'partenaire') {
    return <VuePartenaireCycle prenomAutre={autre.prenom} vue={vue.vue} compact />;
  }

  const maintenant = new Date().toISOString();

  return (
    <Carte>
      <Texte variante="surtitre">Mon cycle</Texte>
      {vue.etat ? (
        <>
          <Texte variante="titre" style={styles.phase}>
            {definitionPhase(vue.etat.phase).libelle}
          </Texte>
          <Texte variante="petit">
            Jour {vue.etat.jourDuCycle}
            {vue.etat.estimations.fiable
              ? ` · prochaines règles ${quand(vue.etat.prochainesReglesLe, maintenant)}`
              : ''}
          </Texte>
        </>
      ) : (
        <Texte variante="corpsDoux" style={styles.phase}>
          Rien de saisi pour l’instant.
        </Texte>
      )}
      <View style={styles.action}>
        <Bouton
          libelle="Ouvrir"
          ton="secondaire"
          onPress={() => router.push('/cycle')}
        />
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  phase: { marginTop: espacements.xxs },
  action: { marginTop: espacements.md },
});
