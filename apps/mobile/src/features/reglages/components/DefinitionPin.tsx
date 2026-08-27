import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { controlerPin, LONGUEUR_PIN_MIN } from '@lonlonbenu/shared';
import { Bouton, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ClavierPin } from './ClavierPin';

interface Props {
  onValide: (pin: string) => Promise<string | undefined>;
  onAnnuler: () => void;
  titre?: string;
}

/** Saisie d'un nouveau code, en deux temps : on le choisit, on le confirme. */
export function DefinitionPin({ onValide, onAnnuler, titre }: Props) {
  const [etape, setEtape] = useState<'choix' | 'confirmation'>('choix');
  const [premier, setPremier] = useState('');
  const [second, setSecond] = useState('');
  const [message, setMessage] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const pin = etape === 'choix' ? premier : second;
  const setPin = etape === 'choix' ? setPremier : setSecond;

  const suivant = async () => {
    if (etape === 'choix') {
      const controle = controlerPin(premier);
      if (!controle.valide) {
        setMessage(controle.message);
        setPremier('');
        return;
      }
      setMessage(undefined);
      setEtape('confirmation');
      return;
    }

    if (second !== premier) {
      setMessage('Les deux saisies diffèrent. Reprenons depuis le début.');
      setPremier('');
      setSecond('');
      setEtape('choix');
      return;
    }

    setEnCours(true);
    const erreur = await onValide(premier);
    setEnCours(false);
    if (erreur) {
      setMessage(erreur);
      setPremier('');
      setSecond('');
      setEtape('choix');
    }
  };

  return (
    <View style={styles.bloc}>
      <Texte variante="sousTitre" style={styles.titre}>
        {titre ??
          (etape === 'choix' ? 'Choisissez un code' : 'Saisissez-le à nouveau')}
      </Texte>

      <ClavierPin
        valeur={pin}
        onChange={(v) => {
          setMessage(undefined);
          setPin(v);
        }}
        desactive={enCours}
      />

      <Texte variante="petit" style={styles.message}>
        {message ??
          `Entre ${LONGUEUR_PIN_MIN} et 6 chiffres. Il vous servira si la biométrie n’est pas disponible.`}
      </Texte>

      <Bouton
        libelle={etape === 'choix' ? 'Continuer' : 'Enregistrer le code'}
        onPress={() => void suivant()}
        enCours={enCours}
        disabled={pin.length < LONGUEUR_PIN_MIN}
      />
      <Bouton libelle="Annuler" ton="discret" onPress={onAnnuler} />
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espacements.md, alignItems: 'stretch' },
  titre: { textAlign: 'center' },
  message: { textAlign: 'center', minHeight: 36 },
});
