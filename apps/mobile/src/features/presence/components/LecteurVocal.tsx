import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  dureeLisible,
  progressionVocal,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useChat } from '../stores/chatStore';
import { cleDeMessages } from '../services/clesMessages';
import { ouvrirVocal } from '../services/enregistrementVocal';

interface Props {
  messageId: string;
  audioScelle: string;
  dureeS: number;
  /** Sur ses propres messages : les couleurs s'inversent. */
  deMoi: boolean;
}

/**
 * Lecture d’une note vocale.
 *
 * ## Le déchiffrement est différé
 *
 * L’audio n’est ouvert qu’au premier appui sur « écouter ». Déchiffrer à
 * l’affichage écrirait sur le disque autant de fichiers qu’il y a de notes
 * dans le fil, y compris celles qu’on ne va jamais écouter.
 *
 * ## Une note illisible le dit
 *
 * Une enveloppe qu’on ne sait plus ouvrir — après un changement de clés —
 * affiche un message plutôt qu’un bouton qui ne démarrerait jamais.
 */
export function LecteurVocal({ messageId, audioScelle, dureeS, deMoi }: Props) {
  const colors = useCouleurs();
  const clePubliqueAutre = useChat((e) => e.cles?.autre);

  const [chemin, setChemin] = useState<string>();
  const [ouverture, setOuverture] = useState(false);
  const [illisible, setIllisible] = useState(false);

  const lecteur = useAudioPlayer(chemin ?? null);
  const etat = useAudioPlayerStatus(lecteur);

  // Dès que le fichier est prêt, on enchaîne sur la lecture : l'appui qui a
  // déclenché l'ouverture valait aussi pour « écouter ».
  useEffect(() => {
    if (chemin && ouverture) {
      setOuverture(false);
      lecteur.play();
    }
  }, [chemin, ouverture, lecteur]);

  const basculer = async () => {
    if (illisible) return;

    if (chemin) {
      if (etat.playing) {
        lecteur.pause();
      } else {
        // Une note arrivée au bout se rejoue depuis le début plutôt que de
        // rester muette sur un appui.
        if (etat.currentTime >= etat.duration - 0.1) await lecteur.seekTo(0);
        lecteur.play();
      }
      return;
    }

    if (!clePubliqueAutre) return;
    setOuverture(true);
    const cle = await cleDeMessages(clePubliqueAutre);
    const pret = await ouvrirVocal(cle, messageId, audioScelle);
    if (pret) setChemin(pret);
    else {
      setOuverture(false);
      setIllisible(true);
    }
  };

  if (illisible) {
    return (
      <Texte variante="petit" style={styles.illisible}>
        Note vocale d’avant vos clés actuelles
      </Texte>
    );
  }

  const teinte = deMoi ? colors.texteInverse : colors.texte;
  // Tant que rien n'est ouvert, la barre reste vide et le compteur affiche la
  // durée totale — c'est ce qu'on veut savoir avant d'écouter.
  const progression = chemin ? progressionVocal(etat.currentTime, dureeS) : 0;
  const compteur = chemin && etat.playing ? etat.currentTime : dureeS;

  return (
    <View style={styles.ligne}>
      <Pressable
        onPress={() => void basculer()}
        accessibilityRole="button"
        accessibilityLabel={
          etat.playing ? 'Mettre en pause' : 'Écouter la note vocale'
        }
        hitSlop={8}
        style={({ pressed }) => [styles.bouton, pressed && styles.pressee]}
      >
        <Feather
          name={ouverture ? 'loader' : etat.playing ? 'pause' : 'play'}
          size={18}
          color={teinte}
        />
      </Pressable>

      <View style={styles.piste}>
        <View
          style={[
            styles.remplissage,
            { width: `${progression * 100}%`, backgroundColor: teinte },
          ]}
        />
      </View>

      <Texte
        variante="meta"
        style={deMoi ? { color: colors.texteInverse } : undefined}
      >
        {dureeLisible(compteur)}
      </Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
    minWidth: 180,
  },
  bouton: { padding: espacements.xxs },
  pressee: { opacity: 0.6 },
  piste: {
    flex: 1,
    height: 3,
    borderRadius: rayons.sm,
    backgroundColor: colors.bordure,
    overflow: 'hidden',
  },
  remplissage: { height: '100%', borderRadius: rayons.sm },
  illisible: { color: colors.texteDoux, fontStyle: 'italic' },
}));
