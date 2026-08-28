import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Theme } from '@lonlonbenu/shared';
import { formaterCode } from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements } from '@/design/theme';
import { messageLisible } from '@/lib/api/erreurs';
import { demanderUnCode, reinitialiserLeMotDePasse } from '../api/motDePasse.api';

type Etape = 'courriel' | 'code';

/**
 * Réinitialisation de mot de passe, en deux temps.
 *
 * L'écran ne dit jamais si l'adresse saisie correspond à un compte : le serveur
 * répond identiquement dans les deux cas, et l'afficher autrement en ferait un
 * moyen de savoir qui possède un compte. Sur une application de couple, cette
 * seule information en dit déjà trop.
 */
export function MotDePasseOublieEcran() {
  const router = useRouter();

  const [etape, setEtape] = useState<Etape>('courriel');
  const [courriel, setCourriel] = useState('');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [avis, setAvis] = useState<string>();

  const demander = async () => {
    setEnCours(true);
    setErreur(undefined);
    try {
      setAvis(await demanderUnCode(courriel.trim()));
      setEtape('code');
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(false);
    }
  };

  const confirmer = async () => {
    setEnCours(true);
    setErreur(undefined);
    try {
      await reinitialiserLeMotDePasse(code, motDePasse);
      router.replace('/connexion');
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <EcranModale section="Mot de passe">
      <EnTete
        titre="Mot de passe oublié"
        sousTitre={
          etape === 'courriel'
            ? 'Nous vous envoyons un code à usage unique.'
            : 'Saisissez le code reçu, puis choisissez un nouveau mot de passe.'
        }
      />

      {etape === 'courriel' ? (
        <Carte>
          <Champ
            etiquette="Votre adresse"
            value={courriel}
            onChangeText={setCourriel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="vous@exemple.com"
          />
          <View style={styles.actions}>
            <Bouton
              libelle="Recevoir un code"
              enCours={enCours}
              disabled={!courriel.trim()}
              onPress={() => void demander()}
            />
          </View>
        </Carte>
      ) : (
        <Carte>
          {avis ? (
            <Texte variante="corpsDoux" style={styles.avis}>
              {avis}
            </Texte>
          ) : null}

          <View style={styles.champs}>
            <Champ
              etiquette="Code reçu"
              value={code}
              onChangeText={(saisi) => setCode(formaterCode(saisi))}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABCD-2345"
              maxLength={9}
            />
            <Champ
              etiquette="Nouveau mot de passe"
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Dix caractères au minimum"
            />
          </View>

          <View style={styles.actions}>
            <Bouton
              libelle="Changer mon mot de passe"
              enCours={enCours}
              disabled={code.length < 8 || motDePasse.length < 10}
              onPress={() => void confirmer()}
            />
            <Bouton
              libelle="Recevoir un autre code"
              ton="discret"
              onPress={() => {
                setEtape('courriel');
                setCode('');
              }}
            />
          </View>

          <Texte variante="meta" style={styles.mention}>
            Le code est valable trente minutes et ne sert qu’une fois. Après cinq
            tentatives, il faut en demander un nouveau.
          </Texte>
        </Carte>
      )}

      {erreur ? (
        <Carte discrete>
          <Texte variante="petit">{erreur}</Texte>
        </Carte>
      ) : null}
    </EcranModale>
  );
}

const styles = stylesDynamiques((_theme: Theme) => ({
  actions: { marginTop: espacements.md, gap: espacements.sm },
  champs: { marginTop: espacements.md, gap: espacements.md },
  avis: { marginTop: espacements.xs },
  mention: { marginTop: espacements.md },
}));
