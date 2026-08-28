import { useEffect } from 'react';
import { Switch, View } from 'react-native';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { useRouter } from 'expo-router';
import {
  categoriesReglables,
  definitionCategorie,
  FREQUENCES,
  type Frequence,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useMoi } from '../stores/sessionStore';
import { usePreferencesDe, useNotifications } from '../stores/notificationsStore';
import { usePush } from '../stores/pushStore';

/**
 * Pôle ⑥ — Réglages du socle de notifications.
 *
 * Les préférences sont personnelles : ce que je règle ici ne s'applique qu'à
 * moi, et mon partenaire n'en est pas informé — ce n'est pas une information
 * qui le concerne.
 */
export function ReglagesNotifications() {
  const colors = useCouleurs();
  const router = useRouter();
  const moi = useMoi();
  const preferences = usePreferencesDe(moi.id);

  const permission = usePush((e) => e.permission);
  const inscritLe = usePush((e) => e.inscritLe);
  const factice = usePush((e) => e.factice);
  const relirePermission = usePush((e) => e.relire);

  // La permission a pu changer dans les réglages du téléphone entre-temps.
  useEffect(() => {
    void relirePermission();
  }, [relirePermission]);

  const definirFrequence = useNotifications((e) => e.definirFrequence);
  const definirSilence = useNotifications((e) => e.definirSilence);
  const definirHeure = useNotifications((e) => e.definirHeureRecapitulatif);
  const pauser = useNotifications((e) => e.pauser);
  const reprendre = useNotifications((e) => e.reprendre);

  const enPause =
    preferences.pauseJusqua !== undefined &&
    Date.now() < Date.parse(preferences.pauseJusqua);

  return (
    <View style={styles.section}>
      <Carte>
        <Texte variante="surtitre">Sur cet appareil</Texte>
        <Texte variante="corps" style={styles.mention}>
          {permission === 'accordee'
            ? inscritLe
              ? factice
                ? 'Autorisées et inscrites, avec un jeton de développement : rien n’arrivera tant que le projet n’a pas ses comptes Firebase et Apple.'
                : 'Autorisées. Ce qui vous attend vous parviendra même l’app fermée.'
              : 'Autorisées, mais l’inscription auprès du serveur n’a pas encore abouti.'
            : permission === 'refusee'
              ? 'Non autorisées sur cet appareil. Vous retrouverez tout dans l’app, à son ouverture.'
              : permission === 'indisponible'
                ? 'Cet appareil ne gère pas les notifications poussées.'
                : 'Pas encore demandées. Sans elles, rien ne vous parvient hors de l’app.'}
        </Texte>
        <View style={styles.actions}>
          <Bouton
            libelle={
              permission === 'jamais_demandee'
                ? 'Autoriser les notifications'
                : 'Voir le détail'
            }
            ton="secondaire"
            onPress={() => router.push('/notifications')}
          />
        </View>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Ne pas déranger</Texte>
        <View style={styles.ligne}>
          <View style={styles.texte}>
            <Texte variante="corps">Silence nocturne</Texte>
            <Texte variante="petit">
              De {preferences.silence.debut} à {preferences.silence.fin}. Rien n’est
              perdu : ce qui arrive pendant est remis ensuite.
            </Texte>
          </View>
          <Switch
            value={preferences.silence.actif}
            onValueChange={(actif) =>
              definirSilence(moi.id, { ...preferences.silence, actif })
            }
            trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
            thumbColor={preferences.silence.actif ? colors.accent : undefined}
            accessibilityLabel="Silence nocturne"
          />
        </View>

        {preferences.silence.actif ? (
          <View style={styles.heures}>
            <Champ
              etiquette="Début"
              value={preferences.silence.debut}
              onChangeText={(debut) =>
                definirSilence(moi.id, { ...preferences.silence, debut })
              }
              placeholder="22:30"
              keyboardType="numbers-and-punctuation"
            />
            <Champ
              etiquette="Fin"
              value={preferences.silence.fin}
              onChangeText={(fin) =>
                definirSilence(moi.id, { ...preferences.silence, fin })
              }
              placeholder="07:30"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        ) : null}

        <Texte variante="meta" style={styles.mention}>
          Un SOS traverse toujours le silence, la pause et tous les réglages de
          cette page. C’est la seule exception, et elle n’est pas désactivable.
        </Texte>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Pause</Texte>
        {enPause ? (
          <>
            <Texte variante="corps" style={styles.mention}>
              En pause. Tout est mis de côté et vous sera remis à la reprise.
            </Texte>
            <View style={styles.actions}>
              <Bouton
                libelle="Reprendre les notifications"
                onPress={() => reprendre(moi.id)}
              />
            </View>
          </>
        ) : (
          <View style={styles.puces}>
            {[
              { libelle: '1 heure', minutes: 60 },
              { libelle: '4 heures', minutes: 240 },
              { libelle: "Jusqu'à demain", minutes: 12 * 60 },
            ].map((choix) => (
              <Puce
                key={choix.libelle}
                libelle={choix.libelle}
                onPress={() => pauser(moi.id, choix.minutes)}
              />
            ))}
          </View>
        )}
      </Carte>

      <Carte>
        <Texte variante="surtitre">Fréquence par catégorie</Texte>
        <View style={styles.categories}>
          {categoriesReglables().map((categorie) => (
            <View key={categorie.code} style={styles.categorie}>
              <Texte variante="corps">{categorie.libelle}</Texte>
              <Texte variante="meta">{categorie.detail}</Texte>
              <View style={styles.puces}>
                {FREQUENCES.map((frequence) => (
                  <Puce
                    key={frequence.code}
                    libelle={frequence.libelle}
                    active={
                      preferences.parCategorie[categorie.code] === frequence.code
                    }
                    onPress={() =>
                      definirFrequence(
                        moi.id,
                        categorie.code,
                        frequence.code as Frequence,
                      )
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.heures}>
          <Champ
            etiquette="Heure du récapitulatif quotidien"
            value={preferences.heureRecapitulatif}
            onChangeText={(heure) => definirHeure(moi.id, heure)}
            placeholder="19:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <Texte variante="meta" style={styles.mention}>
          Deux catégories ne sont pas réglables :{' '}
          {definitionCategorie('sos').libelle} et{' '}
          {definitionCategorie('partage').libelle.toLowerCase()}. La seconde parce
          qu’un partage qui change en silence redeviendrait un mode furtif.
        </Texte>
      </Carte>
    </View>
  );
}

const styles = stylesDynamiques(() => ({
  section: { gap: espacements.md },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.md,
    marginTop: espacements.md,
  },
  texte: { flex: 1, gap: espacements.xxs },
  heures: { flexDirection: 'row', gap: espacements.md, marginTop: espacements.md },
  actions: { marginTop: espacements.md, gap: espacements.sm },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.sm,
  },
  categories: { marginTop: espacements.md, gap: espacements.lg },
  categorie: { gap: espacements.xxs },
  mention: { marginTop: espacements.md },
}));
