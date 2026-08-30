import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useRouter } from 'expo-router';
import { Avatar, Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { ReglagePartage } from '@/features/reglages/components/ReglagePartage';
import {
  useAutre,
  useMoi,
  useSession,
} from '@/features/reglages/stores/sessionStore';
import { useNotifications } from '@/features/reglages/stores/notificationsStore';
import { ConsentementServeur } from '@/features/reglages/components/ConsentementServeur';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { CompteurCarte } from '../components/CompteurCarte';
import { DateDuCouple } from '@/features/reglages/components/DateDuCouple';

/**
 * Pôle ① — Compteur, plus le strict minimum du pôle ⑥ nécessaire pour que le
 * partage de position soit gouvernable dès le P0.
 */
export function NousEcran() {
  const router = useRouter();
  const moi = useMoi();
  const autre = useAutre();
  const couple = useSession((e) => e.couple);
  const changerDePartenaire = useSession((e) => e.changerDePartenaire);
  const nomEspace = useSession((e) => e.nomEspace);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const journal = useNotifications((e) => e.journal);
  const marquerLues = useNotifications((e) => e.marquerLues);

  const mesNotifications = journal.filter((n) => n.destinataireId === moi.id);

  return (
    <EcranModale section="Notre espace">
      <EnTete surtitre="Nous" titre={nomEspace} />

      <Carte>
        <View style={styles.duo}>
          {couple.partenaires.map((p) => (
            <View key={p.id} style={styles.membre}>
              <Avatar partenaire={p} taille={56} />
              <Texte variante="corps">{p.prenom}</Texte>
              {p.id === moi.id ? (
                <Texte variante="meta">connecté·e ici</Texte>
              ) : null}
              </View>
            ),
          )}
        </View>
      </Carte>

      <CompteurCarte />

      <DateDuCouple />

      <Carte>
        <Texte variante="surtitre">Ce que vous partagez</Texte>
        {/* Les trois partages vivent sur le serveur dès qu'un compte est
            relié : on affiche l'état qui fait autorité, jamais une copie
            locale. La position et le score étaient restés sur cette copie, si
            bien que chaque téléphone n'y voyait que son propre consentement et
            annonçait à tort que l'autre n'avait rien activé. */}
        <View style={styles.partages}>
          {(['position', 'activite', 'croissance', 'score'] as const).map(
            (module, index) => (
              <View key={module}>
                {index > 0 ? <View style={styles.separateur} /> : null}
                {coupleId ? (
                  <ConsentementServeur
                    coupleId={coupleId}
                    module={module}
                    prenomAutre={autre.prenom}
                  />
                ) : (
                  <ReglagePartage module={module} sansTitre={false} />
                )}
            </View>
          ))}
        </View>
        <Texte variante="meta" style={styles.mention}>
          Un partage n’est actif que si vous l’activez tous les deux, et chacun peut
          le suspendre quand il veut. Toute modification est annoncée aux deux —
          jamais en silence.
        </Texte>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Ce qui a changé</Texte>
        {mesNotifications.length === 0 ? (
          <Texte variante="corpsDoux" style={styles.vide}>
            Rien de neuf.
          </Texte>
        ) : (
          <View style={styles.notifications}>
            {mesNotifications.slice(0, 8).map((n) => (
              <View key={n.id} style={styles.notification}>
                <Texte variante="corps">{n.texte}</Texte>
                <Texte variante="meta">
                  {ilYA(n.emiseLe)}
                  {n.remise !== 'envoyee' ? ` · ${n.raison}` : ''}
                </Texte>
              </View>
            ))}
          </View>
        )}
        {mesNotifications.length > 0 ? (
          <View style={styles.action}>
            <Bouton
              libelle="Marquer comme lu"
              ton="discret"
              onPress={() => marquerLues(moi.id)}
            />
          </View>
        ) : null}
      </Carte>

      <Carte>
        <Texte variante="surtitre">Sécurité</Texte>
        <Texte variante="corpsDoux" style={styles.vide}>
          Verrou de l’application, code de secours, et séparation des comptes.
        </Texte>
        <View style={styles.action}>
          <Bouton
            libelle="Ouvrir les réglages de sécurité"
            ton="secondaire"
            onPress={() => router.push('/reglages')}
          />
        </View>
      </Carte>

      <Carte discrete>
        <Texte variante="surtitre">Test — couple pilote</Texte>
        <Texte variante="petit" style={styles.vide}>
          Bascule d’un partenaire à l’autre pour vérifier que chaque écran est bien
          symétrique. À retirer avant la mise en production.
        </Texte>
        <View style={styles.action}>
          <Bouton
            libelle={`Passer sur ${autre.prenom}`}
            ton="secondaire"
            onPress={changerDePartenaire}
          />
        </View>
      </Carte>
    </EcranModale>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  duo: { flexDirection: 'row', justifyContent: 'space-around' },
  membre: { alignItems: 'center', gap: espacements.xs },
  partages: { marginTop: espacements.md, gap: espacements.lg },
  separateur: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bordure,
  },
  mention: { marginTop: espacements.md },
  vide: { marginTop: espacements.sm },
  notifications: { marginTop: espacements.md, gap: espacements.md },
  notification: { gap: espacements.xxs },
  action: { marginTop: espacements.md },
}));
