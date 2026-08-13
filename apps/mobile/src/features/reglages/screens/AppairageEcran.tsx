import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formaterCode } from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Ecran, EnTete, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { messageLisible } from '@/lib/api/erreurs';
import {
  accepterInvitation,
  emettreInvitation,
  type InvitationEmise,
} from '../api/appairage.api';
import { useSessionServeur } from '../stores/sessionServeurStore';

type Role = 'choix' | 'emetteur' | 'invite';

/**
 * Appairage réel, arbitré par le serveur. L'un émet un code, l'autre le saisit
 * sur son propre appareil — le code se transmet de vive voix ou par un canal
 * que vous choisissez, jamais par l'app.
 */
export function AppairageEcran() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('choix');
  const [prenom, setPrenom] = useState('');
  const [code, setCode] = useState('');
  const [invitationId, setInvitationId] = useState('');
  const [emise, setEmise] = useState<InvitationEmise>();
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const rafraichirLeCouple = useSessionServeur((e) => e.rafraichirLeCouple);

  const emettre = async () => {
    setEnCours(true);
    setErreur(undefined);
    try {
      setEmise(await emettreInvitation(prenom.trim()));
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(false);
    }
  };

  const accepter = async () => {
    setEnCours(true);
    setErreur(undefined);
    try {
      await accepterInvitation(invitationId.trim(), code.trim(), prenom.trim());
      await rafraichirLeCouple();
      router.back();
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Ecran>
      <EnTete
        surtitre="Appairage"
        titre="Relier vos deux comptes"
        sousTitre="Une seule fois, avec un code que l’un transmet à l’autre."
      />

      {role === 'choix' ? (
        <Carte>
          <Texte variante="corps">
            L’un de vous crée le code, l’autre le saisit. Peu importe lequel.
          </Texte>
          <View style={styles.actions}>
            <Bouton libelle="Je crée le code" onPress={() => setRole('emetteur')} />
            <Bouton
              libelle="J’ai un code à saisir"
              ton="secondaire"
              onPress={() => setRole('invite')}
            />
          </View>
        </Carte>
      ) : null}

      {role === 'emetteur' ? (
        <Carte>
          <Texte variante="surtitre">Créer le code</Texte>
          {emise ? (
            <View style={styles.resultat}>
              <Texte variante="afficheXl" style={styles.code}>
                {emise.codeFormate}
              </Texte>
              <Texte variante="corpsDoux">
                Transmettez-le de vive voix. Il vaut{' '}
                {Math.round(emise.expireDansSecondes / 60)} minutes, ne sert
                qu’une fois, et se bloque après cinq erreurs.
              </Texte>
              <Texte variante="meta" style={styles.identifiant}>
                Identifiant à saisir avec le code : {emise.invitationId}
              </Texte>
              <Bouton
                libelle="C’est fait, fermer"
                ton="secondaire"
                onPress={() => {
                  void rafraichirLeCouple();
                  router.back();
                }}
              />
            </View>
          ) : (
            <View style={styles.champs}>
              <Champ
                etiquette="Votre prénom"
                value={prenom}
                onChangeText={setPrenom}
              />
              <Bouton
                libelle="Créer le code"
                onPress={() => void emettre()}
                enCours={enCours}
                disabled={!prenom.trim()}
              />
            </View>
          )}
        </Carte>
      ) : null}

      {role === 'invite' ? (
        <Carte>
          <Texte variante="surtitre">Saisir le code</Texte>
          <View style={styles.champs}>
            <Champ
              etiquette="Votre prénom"
              value={prenom}
              onChangeText={setPrenom}
            />
            <Champ
              etiquette="Identifiant de l’invitation"
              value={invitationId}
              onChangeText={setInvitationId}
              autoCapitalize="none"
            />
            <Champ
              etiquette="Code"
              placeholder="ABCD-EFGH"
              value={code}
              onChangeText={(v) => setCode(formaterCode(v))}
              autoCapitalize="characters"
            />
            <Bouton
              libelle="Relier nos comptes"
              onPress={() => void accepter()}
              enCours={enCours}
              disabled={!prenom.trim() || !code.trim() || !invitationId.trim()}
            />
          </View>
        </Carte>
      ) : null}

      {erreur ? (
        <Carte discrete>
          <Texte variante="petit" style={styles.erreur}>
            {erreur}
          </Texte>
        </Carte>
      ) : null}

      {role !== 'choix' ? (
        <Bouton libelle="Revenir" ton="discret" onPress={() => setRole('choix')} />
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  actions: { gap: espacements.sm, marginTop: espacements.lg },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  resultat: { gap: espacements.md, marginTop: espacements.md },
  code: { textAlign: 'center', letterSpacing: 4 },
  identifiant: { color: colors.texteDoux },
  erreur: { color: colors.tendresse },
});
