import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import {
  DUREE_MAX_VOCAL_S,
  DUREE_MIN_VOCAL_S,
  dureeLisible,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';

interface Props {
  /** Rend vrai si la note est partie. */
  onEnvoyer: (uri: string, dureeS: number) => Promise<boolean>;
  onErreur: (message: string) => void;
  desactive?: boolean;
}

/**
 * Bouton d’enregistrement d’une note vocale (§8.3).
 *
 * ## Un appui pour démarrer, un appui pour envoyer
 *
 * Et non le maintien du doigt des messageries grand public. Le maintien
 * oblige à tenir le téléphone immobile pendant deux minutes, et une note
 * perdue parce que le doigt a glissé est une note qu’on ne réenregistre pas.
 * Deux appuis laissent aussi la place à un bouton d’annulation franc, là où
 * le maintien impose de deviner un geste de rejet.
 *
 * ## L’arrêt automatique
 *
 * À `DUREE_MAX_VOCAL_S`, l’enregistrement s’arrête et part. Le plafond existe
 * pour garder le poids en base prévisible ; le laisser courir jusqu’au refus
 * du serveur ferait perdre la note après coup, ce qui est la pire des façons
 * d’appliquer une limite.
 */
export function BoutonVocal({ onEnvoyer, onErreur, desactive }: Props) {
  const colors = useCouleurs();
  const enregistreur = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [enCours, setEnCours] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  /**
   * La durée, doublée dans une référence.
   *
   * L'arrêt automatique est déclenché depuis la fonction passée à
   * `setInterval`, qui a capturé l'état du rendu où l'enregistrement a
   * démarré — c'est-à-dire zéro. Lire `secondes` là ferait partir toute note
   * arrivée au plafond avec une durée nulle, aussitôt refusée comme « trop
   * courte ».
   */
  const secondesRef = useRef(0);

  const arreterLeCompteur = () => {
    if (minuterie.current) clearInterval(minuterie.current);
    minuterie.current = undefined;
  };

  useEffect(() => arreterLeCompteur, []);

  const demarrer = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      onErreur(
        'Sans accès au micro, les notes vocales ne peuvent pas être enregistrées. Vous pouvez l’autoriser dans les réglages du téléphone.',
      );
      return;
    }

    try {
      // `allowsRecording` bascule la sortie sur le mode enregistrement ; sans
      // lui, le micro reste muet sur iOS.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await enregistreur.prepareToRecordAsync();
      enregistreur.record();
    } catch {
      onErreur('L’enregistrement n’a pas pu démarrer. Réessayez.');
      return;
    }

    void Haptics.selectionAsync();
    secondesRef.current = 0;
    setSecondes(0);
    setEnCours(true);
    minuterie.current = setInterval(() => {
      secondesRef.current += 1;
      setSecondes(secondesRef.current);
      if (secondesRef.current >= DUREE_MAX_VOCAL_S) void terminer(true);
    }, 1000);
  };

  /** Arrête l’enregistrement. `envoyer` distingue l’envoi de l’abandon. */
  const terminer = async (envoyer: boolean) => {
    arreterLeCompteur();
    setEnCours(false);

    let uri: string | null = null;
    try {
      await enregistreur.stop();
      uri = enregistreur.uri;
    } catch {
      onErreur('L’enregistrement s’est interrompu. Rien n’a été envoyé.');
      return;
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }

    const duree = secondesRef.current;
    if (!envoyer || !uri) return;
    if (duree < DUREE_MIN_VOCAL_S) {
      onErreur('Trop court pour être entendu. Maintenez un instant de plus.');
      return;
    }

    setEnvoi(true);
    try {
      await onEnvoyer(uri, duree);
    } finally {
      setEnvoi(false);
    }
  };

  if (!enCours) {
    return (
      <Pressable
        onPress={() => void demarrer()}
        disabled={desactive || envoi}
        accessibilityRole="button"
        accessibilityLabel="Enregistrer une note vocale"
        hitSlop={8}
        style={({ pressed }) => [
          styles.micro,
          (desactive || envoi) && styles.eteint,
          pressed && styles.pressee,
        ]}
      >
        <Feather
          name="mic"
          size={20}
          color={desactive || envoi ? colors.texteDoux : colors.accent}
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.barre}>
      <View style={styles.point} />
      <Texte variante="meta">{dureeLisible(secondes)}</Texte>

      <Pressable
        onPress={() => void terminer(false)}
        accessibilityRole="button"
        accessibilityLabel="Annuler l’enregistrement"
        hitSlop={8}
        style={({ pressed }) => [styles.action, pressed && styles.pressee]}
      >
        <Feather name="trash-2" size={18} color={colors.texteDoux} />
      </Pressable>

      <Pressable
        onPress={() => void terminer(true)}
        accessibilityRole="button"
        accessibilityLabel="Envoyer la note vocale"
        hitSlop={8}
        style={({ pressed }) => [styles.action, pressed && styles.pressee]}
      >
        <Feather name="send" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  micro: { padding: espacements.sm },
  eteint: { opacity: 0.4 },
  pressee: { opacity: 0.6 },
  barre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
    paddingHorizontal: espacements.sm,
  },
  // Le point rouge dit qu'on enregistre, sans avoir à lire.
  point: {
    width: 8,
    height: 8,
    borderRadius: rayons.lg,
    backgroundColor: colors.tendresse,
  },
  action: { padding: espacements.xs },
}));
