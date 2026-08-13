import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { NOTES_SUGGEREES } from '@lonlonbenu/shared';
import { Bouton, Carte, Ecran, EnTete, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useAutre, useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { CarteCycle } from '@/features/intimite/components/CarteCycle';
import { BandeauSos } from '../components/BandeauSos';
import { CarteDuPartenaire } from '../components/CarteDuPartenaire';
import { CompteurCarte } from '../components/CompteurCarte';
import { SelecteurStatut } from '../components/SelecteurStatut';
import { useChat, useMessagesNonLus } from '../stores/chatStore';

/** Pôle ① — Tableau de bord / Accueil (P0). */
export function AccueilEcran() {
  const router = useRouter();
  const moi = useMoi();
  const autre = useAutre();
  const envoyer = useChat((e) => e.envoyer);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const nonLus = useMessagesNonLus(partenaireId ?? '');

  return (
    <Ecran>
      <EnTete
        surtitre={salutation()}
        titre={moi.prenom}
        sousTitre={`Vous et ${autre.prenom}, aujourd’hui.`}
      />

      <BandeauSos />
      <CarteDuPartenaire />

      <Carte>
        <SelecteurStatut />
      </Carte>

      <CarteCycle />
      <CompteurCarte compact />

      <Carte>
        <Texte variante="surtitre">Une note douce</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Un mot en un geste, sans ouvrir la conversation.
        </Texte>
        <View style={styles.puces}>
          {NOTES_SUGGEREES.map((note) => (
            <Puce
              key={note}
              libelle={note}
              onPress={() =>
                coupleId && partenaireId
                  ? void envoyer(coupleId, partenaireId, note, 'note_douce')
                  : undefined
              }
            />
          ))}
        </View>
      </Carte>

      <Bouton
        libelle={
          nonLus > 0
            ? `Ouvrir la conversation · ${nonLus} nouveau${nonLus > 1 ? 'x' : ''}`
            : 'Ouvrir la conversation'
        }
        ton="secondaire"
        onPress={() => router.push('/chat')}
      />
    </Ecran>
  );
}

function salutation(maintenant: Date = new Date()): string {
  const h = maintenant.getHours();
  if (h < 6) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bel après-midi';
  return 'Bonsoir';
}

const styles = StyleSheet.create({
  intro: { marginBottom: espacements.md },
  puces: { gap: espacements.xs, alignItems: 'flex-start' },
});
