import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { colors, espacements } from '@/design/theme';
import { DefinitionPin } from '../components/DefinitionPin';
import { ReglagesNotifications } from '../components/ReglagesNotifications';
import { DELAI_GRACE_MS, useVerrou } from '../stores/verrouStore';
import { useSessionServeur } from '../stores/sessionServeurStore';

/** Pôle ⑥ — Sécurité & confidentialité. */
export function ReglagesEcran() {
  const router = useRouter();

  const actif = useVerrou((e) => e.actif);
  const biometrie = useVerrou((e) => e.biometrie);
  const activerVerrou = useVerrou((e) => e.activerVerrou);
  const desactiverVerrou = useVerrou((e) => e.desactiverVerrou);
  const basculerBiometrie = useVerrou((e) => e.basculerBiometrie);
  const verrouiller = useVerrou((e) => e.verrouiller);

  const etatSession = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const seDeconnecter = useSessionServeur((e) => e.seDeconnecter);

  const [definitionEnCours, setDefinitionEnCours] = useState(false);
  const [changementEnCours, setChangementEnCours] = useState(false);
  const [biometrieDisponible, setBiometrieDisponible] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      const materiel = await LocalAuthentication.hasHardwareAsync();
      const enrole = await LocalAuthentication.isEnrolledAsync();
      setBiometrieDisponible(materiel && enrole);
    })();
  }, []);

  const enregistrerPin = async (pin: string) => {
    const resultat = await activerVerrou(pin);
    if (!resultat.ok)
      return resultat.message ?? 'Ce code n’a pas pu être enregistré.';
    setDefinitionEnCours(false);
    setChangementEnCours(false);
    return undefined;
  };

  return (
    <EcranModale section="Sécurité">
      <EnTete
        surtitre="Pôle ⑥"
        titre="Sécurité & réglages"
        sousTitre="Ce qui protège votre espace, ce qui vous prévient, et ce qui y met fin."
      />

      <Carte>
        <Texte variante="surtitre">Verrou de l’application</Texte>

        {definitionEnCours || changementEnCours ? (
          <View style={styles.definition}>
            <DefinitionPin
              titre={changementEnCours ? 'Nouveau code' : undefined}
              onValide={enregistrerPin}
              onAnnuler={() => {
                setDefinitionEnCours(false);
                setChangementEnCours(false);
              }}
            />
          </View>
        ) : (
          <>
            <View style={styles.ligne}>
              <View style={styles.texte}>
                <Texte variante="corps">Demander à l’ouverture</Texte>
                <Texte variante="petit">
                  {actif
                    ? 'Biométrie, avec votre code en secours.'
                    : 'L’app s’ouvre sans rien demander.'}
                </Texte>
              </View>
              <Switch
                value={actif}
                onValueChange={(valeur) => {
                  if (valeur) setDefinitionEnCours(true);
                  else void desactiverVerrou();
                }}
                trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
                thumbColor={actif ? colors.accent : undefined}
                accessibilityLabel="Verrou de l’application"
              />
            </View>

            {actif ? (
              <>
                <View style={styles.ligne}>
                  <View style={styles.texte}>
                    <Texte variante="corps">Biométrie</Texte>
                    <Texte variante="petit">
                      {biometrieDisponible === false
                        ? 'Aucun capteur configuré sur cet appareil — le code prend le relais.'
                        : 'Empreinte ou visage, selon votre appareil.'}
                    </Texte>
                  </View>
                  <Switch
                    value={biometrie && biometrieDisponible !== false}
                    disabled={biometrieDisponible === false}
                    onValueChange={(v) => void basculerBiometrie(v)}
                    trackColor={{
                      true: colors.accentDoux,
                      false: colors.fondNuance,
                    }}
                    thumbColor={biometrie ? colors.accent : undefined}
                    accessibilityLabel="Déverrouillage biométrique"
                  />
                </View>

                <View style={styles.actions}>
                  <Bouton
                    libelle="Changer mon code"
                    ton="secondaire"
                    onPress={() => setChangementEnCours(true)}
                  />
                  <Bouton
                    libelle="Verrouiller maintenant"
                    ton="discret"
                    onPress={verrouiller}
                  />
                </View>

                <Texte variante="meta" style={styles.mention}>
                  L’app se reverrouille au lancement, et après{' '}
                  {DELAI_GRACE_MS / 1000} secondes passées en arrière-plan — de quoi
                  aller chercher une information ailleurs sans avoir à ressaisir
                  votre code. Après plusieurs codes erronés, l’attente s’allonge,
                  mais rien n’est jamais effacé : personne ne doit pouvoir détruire
                  vos données en tapant de faux codes.
                </Texte>
              </>
            ) : null}
          </>
        )}
      </Carte>

      <ReglagesNotifications />

      <Carte>
        <Texte variante="surtitre">Compte</Texte>
        {etatSession === 'connecte' ? (
          <>
            <Texte variante="corps" style={styles.mention}>
              Connecté
              {coupleId
                ? ' et relié à votre partenaire.'
                : ', mais pas encore relié.'}
            </Texte>
            <Texte variante="meta">
              Ce qui passe par le serveur — pour l’instant les axes de croissance —
              se synchronise entre vos deux appareils.
            </Texte>
            <View style={styles.actions}>
              {!coupleId ? (
                <Bouton
                  libelle="Relier nos comptes"
                  ton="secondaire"
                  onPress={() => router.push('/appairage')}
                />
              ) : null}
              <Bouton
                libelle="Se déconnecter de cet appareil"
                ton="discret"
                onPress={() => void seDeconnecter()}
              />
            </View>
          </>
        ) : (
          <>
            <Texte variante="corps" style={styles.mention}>
              Aucun compte sur cet appareil. Tout reste local, et rien ne parvient à
              votre partenaire.
            </Texte>
            <View style={styles.actions}>
              <Bouton
                libelle="Se connecter"
                ton="secondaire"
                onPress={() => router.push('/connexion')}
              />
            </View>
          </>
        )}
      </Carte>

      <Carte>
        <Texte variante="surtitre">En cas de rupture</Texte>
        <Texte variante="corps" style={styles.mention}>
          La dissociation coupe tous les accès croisés, dans les deux sens et
          immédiatement, et rend les données de cet appareil illisibles.
        </Texte>
        <View style={styles.actions}>
          <Bouton
            libelle="Séparer nos comptes"
            ton="secondaire"
            onPress={() => router.push('/dissociation')}
          />
        </View>
      </Carte>
    </EcranModale>
  );
}

const styles = StyleSheet.create({
  definition: { marginTop: espacements.lg },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.md,
    marginTop: espacements.md,
  },
  texte: { flex: 1, gap: espacements.xxs },
  actions: { marginTop: espacements.md, gap: espacements.sm },
  mention: { marginTop: espacements.md },
});
