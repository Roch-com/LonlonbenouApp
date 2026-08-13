import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  controlerNomEspace,
  propositionsNomEspace,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Ecran, EnTete, Puce, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';
import { EtapeAppairage } from '../components/EtapeAppairage';
import { EtapePartagesInitiaux } from '../components/EtapePartagesInitiaux';
import { useSession } from '../stores/sessionStore';

type Etape = 'prenoms' | 'invitation' | 'espace' | 'partages' | 'fin';

const ORDRE: Etape[] = ['prenoms', 'invitation', 'espace', 'partages', 'fin'];

/**
 * Pôle ⑥ — Onboarding conjoint.
 *
 * L'ordre n'est pas arbitraire : on se nomme, on se relie, on nomme l'espace,
 * **puis** on règle les partages. Demander les partages avant que le couple
 * existe reviendrait à faire consentir dans le vide.
 */
export function OnboardingEcran() {
  const couple = useSession((e) => e.couple);
  const definirPrenoms = useSession((e) => e.definirPrenoms);
  const definirNomEspace = useSession((e) => e.definirNomEspace);
  const terminerOnboarding = useSession((e) => e.terminerOnboarding);

  const [etape, setEtape] = useState<Etape>('prenoms');
  const [prenomA, setPrenomA] = useState(couple.partenaires[0].prenom);
  const [prenomB, setPrenomB] = useState(couple.partenaires[1].prenom);
  const [nom, setNom] = useState('');
  const [messageNom, setMessageNom] = useState<string>();

  const avancer = () => {
    const suivante = ORDRE[ORDRE.indexOf(etape) + 1];
    if (suivante) setEtape(suivante);
  };

  const validerPrenoms = () => {
    definirPrenoms(prenomA, prenomB);
    avancer();
  };

  const validerNom = () => {
    const controle = controlerNomEspace(nom);
    if (!controle.valide) {
      setMessageNom(controle.message);
      return;
    }
    definirNomEspace(nom);
    avancer();
  };

  return (
    <Ecran>
      <Progression etape={etape} />

      {etape === 'prenoms' ? (
        <>
          <EnTete
            surtitre="Bienvenue"
            titre="LONLONBENU"
            sousTitre="Commençons par vos deux prénoms."
          />
          <Carte>
            <View style={styles.champs}>
              <Champ etiquette="Vous" value={prenomA} onChangeText={setPrenomA} />
              <Champ
                etiquette="Votre partenaire"
                value={prenomB}
                onChangeText={setPrenomB}
              />
            </View>
          </Carte>
          <Bouton
            libelle="Continuer"
            onPress={validerPrenoms}
            disabled={!prenomA.trim() || !prenomB.trim()}
          />
        </>
      ) : null}

      {etape === 'invitation' ? (
        <>
          <EnTete surtitre="Étape 2" titre="Vous relier" />
          <EtapeAppairage onAppaire={avancer} />
          <Bouton libelle="Retour" ton="discret" onPress={() => setEtape('prenoms')} />
        </>
      ) : null}

      {etape === 'espace' ? (
        <>
          <EnTete
            surtitre="Étape 3"
            titre="Nommer votre espace"
            sousTitre="C’est le nom que vous verrez partout dans l’app."
          />
          <Carte>
            <Texte variante="surtitre">Quelques idées</Texte>
            <View style={styles.puces}>
              {propositionsNomEspace(prenomA, prenomB).map((proposition) => (
                <Puce
                  key={proposition}
                  libelle={proposition}
                  active={nom === proposition}
                  onPress={() => {
                    setMessageNom(undefined);
                    setNom(proposition);
                  }}
                />
              ))}
            </View>
            <View style={styles.champs}>
              <Champ
                etiquette="Ou le vôtre"
                value={nom}
                onChangeText={(v) => {
                  setMessageNom(undefined);
                  setNom(v);
                }}
              />
              {messageNom ? (
                <Texte variante="petit">{messageNom}</Texte>
              ) : null}
            </View>
          </Carte>
          <Bouton libelle="Continuer" onPress={validerNom} disabled={!nom.trim()} />
        </>
      ) : null}

      {etape === 'partages' ? (
        <>
          <EnTete
            surtitre="Étape 4"
            titre="Ce que vous partagez"
            sousTitre="Rien n’est activé par défaut. Tout est réversible."
          />
          <EtapePartagesInitiaux />
          <Bouton libelle="Continuer" onPress={avancer} />
        </>
      ) : null}

      {etape === 'fin' ? (
        <>
          <EnTete surtitre="C’est prêt" titre="Bonne route à vous deux" />
          <Carte>
            <Texte variante="corps">
              Vous pourrez revenir sur chaque réglage à tout moment, depuis
              l’onglet « Notre espace ». Rien de ce que vous avez choisi ici
              n’est définitif.
            </Texte>
            <Texte variante="corpsDoux" style={styles.mention}>
              Un dernier point : chaque fois qu’un partage change, vous serez
              prévenus tous les deux. Il n’y a pas de réglage silencieux dans
              cette app.
            </Texte>
          </Carte>
          <Bouton libelle="Entrer" onPress={terminerOnboarding} />
        </>
      ) : null}
    </Ecran>
  );
}

function Progression({ etape }: { etape: Etape }) {
  const index = ORDRE.indexOf(etape);
  return (
    <View style={styles.progression} accessibilityLabel={`Étape ${index + 1} sur ${ORDRE.length}`}>
      {ORDRE.map((e, i) => (
        <View key={e} style={[styles.jalon, i <= index && styles.jalonFait]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  progression: {
    flexDirection: 'row',
    gap: espacements.xs,
    marginBottom: espacements.md,
  },
  jalon: {
    flex: 1,
    height: 3,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
  },
  jalonFait: { backgroundColor: colors.accent },
  champs: { gap: espacements.md, marginTop: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs, marginTop: espacements.sm },
  mention: { marginTop: espacements.md },
});
