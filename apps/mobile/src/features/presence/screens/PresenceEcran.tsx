import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useRouter } from 'expo-router';
import { Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranOnglet } from '@/components/chrome/EcranOnglet';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { useAutre, useSession } from '@/features/reglages/stores/sessionStore';
import { BandeauSos } from '../components/BandeauSos';
import { CarteDuPartenaire } from '../components/CarteDuPartenaire';
import { CheckIn } from '../components/CheckIn';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';

/**
 * Pôle ① — Carte & Présence, périmètre P0.
 * Statuts manuels, check-in, SOS. Pas de carte temps réel, pas d'ETA,
 * pas de geofencing : ces briques sont P1 et supposent le partage réciproque
 * de position activé des deux côtés.
 */
export function PresenceEcran() {
  const router = useRouter();
  const couple = useSession((e) => e.couple);
  const autre = useAutre();
  const { checkIns } = usePresenceLisible();

  return (
    <EcranOnglet section="Présence">
      <EnTete
        surtitre="Présence"
        titre="Où en êtes-vous"
        sousTitre="Chacun partage ce qu’il souhaite, quand il le souhaite."
      />

      <BandeauSos />
      <CarteDuPartenaire />
      <CheckIn />

      <Carte>
        <Texte variante="surtitre">Journal des présences</Texte>
        {checkIns.length === 0 ? (
          <Texte variante="corpsDoux" style={styles.vide}>
            Aucun check-in pour l’instant.
          </Texte>
        ) : (
          <View style={styles.journal}>
            {checkIns.slice(0, 8).map((c) => {
              const auteur = couple.partenaires.find(
                (p) => p.id === c.partenaireId,
              );
              return (
                <View key={c.id} style={styles.entree}>
                  <Texte variante="corps">
                    {auteur?.prenom ?? '—'} · {c.lieu}
                  </Texte>
                  <Texte variante="petit">
                    {ilYA(c.faitLe)}
                    {c.mot ? ` — « ${c.mot} »` : ''}
                  </Texte>
                </View>
              );
            })}
          </View>
        )}
      </Carte>

      <Bouton
        libelle="Déclencher un SOS"
        ton="urgence"
        onPress={() => router.push('/sos')}
      />
      <Texte variante="petit" style={styles.mentionSos}>
        Le SOS prévient {autre.prenom} immédiatement. Personne d’autre n’est alerté.
      </Texte>
    </EcranOnglet>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  vide: { marginTop: espacements.sm },
  journal: { marginTop: espacements.md, gap: espacements.md },
  entree: {
    gap: espacements.xxs,
    paddingBottom: espacements.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bordure,
  },
  mentionSos: { textAlign: 'center' },
}));
