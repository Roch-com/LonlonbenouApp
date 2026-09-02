import { memo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import type { MessageLisible } from '../hooks/useLecturesDechiffrees';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { heure } from '@/lib/temps';
import { LecteurVocal } from './LecteurVocal';

interface Props {
  message: MessageLisible;
  deMoi: boolean;
  /** Vrai si le message précédent vient du même auteur, à peu d'intervalle. */
  suiteDuPrecedent?: boolean;
  /** Vrai si le suivant vient d'un autre auteur — ou s'il n'y en a plus. */
  dernierDuGroupe?: boolean;
  /** Message cité, déjà résolu par l'appelant. */
  cite?: { auteurEstMoi: boolean; texte: string };
  /**
   * Rappels **stables** : ils reçoivent le message plutôt que de le capturer.
   *
   * Une fermeture recréée à chaque rendu annulerait la mémoïsation, et chaque
   * bulle se referait à chaque sondage — c'est ce qui alourdissait le fil.
   */
  onAppuiLong?: (message: MessageLisible) => void;
  /** Glissement vers la droite : le geste de réponse des messageries. */
  onGlisserPourRepondre?: (message: MessageLisible) => void;
}

/**
 * Bulle de message.
 *
 * ## Le groupage
 *
 * Des messages consécutifs du même auteur forment un bloc : espacement
 * resserré, coin arrondi partagé, et **une seule heure, sur le dernier**.
 * Répéter l'horodatage sur chaque ligne d'une rafale de trois mots encombre
 * sans rien apprendre — c'est le choix qu'ont fait toutes les messageries qui
 * se lisent bien.
 *
 * ## L'accusé de lecture
 *
 * Un chevron pour « parti », deux pour « lu ». Il n'apparaît que sur ses
 * propres messages : savoir que l'autre a lu est utile, savoir qu'on a lu
 * soi-même ne l'est pas.
 *
 * ## Le glissement pour répondre
 *
 * C'est le geste qu'on connaît des messageries, et le seul que les gens
 * essaient spontanément. L'appui long existait déjà mais personne ne le
 * trouvait : un geste sans indice visuel n'est pas une fonctionnalité.
 *
 * Il est fait avec `PanResponder`, du cœur de React Native, plutôt qu'avec
 * une bibliothèque de gestes : ajouter un module natif aurait interdit de
 * livrer cet écran par mise à jour à distance, et obligé à réinstaller
 * l'application pour un geste.
 */
/**
 * Mémoïsée : le fil se relit toutes les quatre secondes, et sans cela chaque
 * bulle se refaisait à chaque relecture. `useFilLisible` rend le même objet
 * pour un message inchangé, ce qui suffit à la comparaison par défaut.
 */
export const BulleMessage = memo(function BulleMessage({
  message,
  deMoi,
  suiteDuPrecedent,
  dernierDuGroupe = true,
  cite,
  onAppuiLong,
  onGlisserPourRepondre,
}: Props) {
  const colors = useCouleurs();
  const douce = message.type === 'note_douce';

  const glissement = useRef(new Animated.Value(0)).current;
  const declenche = useRef(false);

  const pan = useRef(
    PanResponder.create({
      // On ne prend la main qu'à partir d'un mouvement franchement
      // horizontal : sinon le moindre défilement vertical attraperait le
      // geste et la liste deviendrait impossible à parcourir.
      onMoveShouldSetPanResponder: (_e, g) =>
        !!onGlisserPourRepondre &&
        g.dx > 12 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_e, g) => {
        const x = Math.min(Math.max(g.dx, 0), SEUIL_REPONSE * 1.4);
        glissement.setValue(x);
        // Un retour tactile au franchissement du seuil, comme ailleurs : on
        // sait que le geste a pris avant même de relâcher.
        if (!declenche.current && x >= SEUIL_REPONSE) {
          declenche.current = true;
          void Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= SEUIL_REPONSE) onGlisserPourRepondre?.(message);
        declenche.current = false;
        Animated.spring(glissement, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        declenche.current = false;
        Animated.spring(glissement, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...(onGlisserPourRepondre ? pan.panHandlers : {})}
      style={[
        styles.rangee,
        deMoi ? styles.aDroite : styles.aGauche,
        suiteDuPrecedent ? styles.serree : styles.espacee,
        { transform: [{ translateX: glissement }] },
      ]}
    >
      {onGlisserPourRepondre ? (
        <Animated.View
          style={[styles.indiceReponse, { opacity: glissement.interpolate({
            inputRange: [0, SEUIL_REPONSE],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }) }]}
          pointerEvents="none"
        >
          <Feather name="corner-up-left" size={16} color={colors.texteDoux} />
        </Animated.View>
      ) : null}
      <Pressable
        onLongPress={() => onAppuiLong?.(message)}
        delayLongPress={280}
        disabled={!onAppuiLong}
        accessibilityRole={onAppuiLong ? 'button' : undefined}
        accessibilityLabel={onAppuiLong ? 'Actions sur ce message' : undefined}
        style={({ pressed }) => [
          styles.bulle,
          deMoi ? styles.mienne : styles.sienne,
          // Le coin pointu marque la fin du bloc, comme une signature.
          dernierDuGroupe && (deMoi ? styles.finMienne : styles.finSienne),
          douce && styles.douce,
          pressed && onAppuiLong ? styles.pressee : undefined,
        ]}
      >
        {cite ? (
          <View style={[styles.cite, deMoi && styles.citeMienne]}>
            <Texte
              variante="meta"
              numberOfLines={1}
              style={deMoi ? styles.metaMienne : undefined}
            >
              {cite.auteurEstMoi ? 'Vous' : 'En réponse'}
            </Texte>
            <Texte
              variante="petit"
              numberOfLines={2}
              style={deMoi ? styles.metaMienne : undefined}
            >
              {cite.texte}
            </Texte>
          </View>
        ) : null}

        {douce ? (
          <Texte variante="surtitre" style={styles.etiquetteDouce}>
            Note douce
          </Texte>
        ) : null}

        {message.retire ? (
          <View style={styles.retire}>
            <Feather
              name="slash"
              size={13}
              color={deMoi ? colors.texteInverse : colors.texteDoux}
            />
            <Texte
              variante="corps"
              style={[
                styles.illisible,
                deMoi ? styles.metaMienne : undefined,
              ]}
            >
              Ce message a été retiré
            </Texte>
          </View>
        ) : message.vocal ? (
          <LecteurVocal
            messageId={message.id}
            audioScelle={message.vocal.audioScelle}
            dureeS={message.vocal.dureeS}
            deMoi={deMoi}
          />
        ) : (
          <Texte
            variante={douce ? 'sousTitre' : 'corps'}
            style={[
              deMoi && !douce ? styles.texteMien : undefined,
              message.illisible && styles.illisible,
            ]}
          >
            {message.illisible
              ? 'Message d’avant vos clés actuelles'
              : message.texte}
          </Texte>
        )}

        {dernierDuGroupe ? (
          <View style={styles.pied}>
            <Texte
              variante="meta"
              style={deMoi && !douce ? styles.metaMienne : undefined}
            >
              {heure(message.envoyeLe)}
            </Texte>
            {deMoi && !douce ? (
              <Feather
                name={message.luLe ? 'check-circle' : 'check'}
                size={12}
                color={colors.texteInverse}
                style={styles.accuse}
              />
            ) : null}
          </View>
        ) : null}
        {message.reactions.length > 0 ? (
          <View style={styles.reactions}>
            {message.reactions.map((r) => (
              <Texte key={r.partenaireId} variante="petit">
                {r.emoji}
              </Texte>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

/** Distance à parcourir pour que le glissement compte comme une réponse. */
const SEUIL_REPONSE = 56;

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: { flexDirection: 'row', alignItems: 'center' },
  // Posé à gauche, hors du flux : il apparaît en glissant sans décaler la
  // bulle au repos.
  indiceReponse: { position: 'absolute', left: -28 },
  retire: { flexDirection: 'row', alignItems: 'center', gap: espacements.xs },
  // En bas de la bulle, légèrement débordantes : c'est ainsi qu'on les
  // reconnaît d'un coup d'œil comme un ajout et non comme du texte.
  reactions: {
    flexDirection: 'row',
    gap: espacements.xxs,
    marginTop: espacements.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: espacements.xs,
    paddingVertical: 2,
    borderRadius: rayons.lg,
    backgroundColor: colors.fondEleve,
  },
  aDroite: { justifyContent: 'flex-end' },
  aGauche: { justifyContent: 'flex-start' },
  // Deux messages d'affilée du même auteur se touchent presque ; un changement
  // d'auteur respire.
  serree: { marginTop: 2 },
  espacee: { marginTop: espacements.sm },
  bulle: {
    maxWidth: '82%',
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.lg,
    gap: espacements.xxs,
  },
  mienne: { backgroundColor: colors.accent },
  sienne: {
    backgroundColor: colors.fondEleve,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
  finMienne: { borderBottomRightRadius: rayons.sm },
  finSienne: { borderBottomLeftRadius: rayons.sm },
  douce: {
    backgroundColor: colors.tendresseDouce,
    borderColor: colors.tendresse,
    borderWidth: 1,
  },
  etiquetteDouce: { color: colors.tendresse },
  /**
   * Sur l'accent bleu, c'est `texteInverse` qui se lit : blanc en mode clair
   * sur le bleu foncé, encre en mode sombre sur le bleu clair. L'inverse
   * échouerait dans les deux cas — 8,4 et 6,8 de contraste contre 2,0 et 2,5.
   */
  texteMien: { color: colors.texteInverse },
  pied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacements.xxs,
  },
  metaMienne: { color: colors.texteInverse, opacity: 0.78 },
  /**
   * Un message qu'on ne peut plus ouvrir n'est pas une erreur à signaler en
   * rouge : c'est une conséquence normale du chiffrement de bout en bout, et
   * l'alarmer à chaque bulle laisserait croire à une panne. Il s'efface au
   * lieu de crier.
   */
  illisible: { fontStyle: 'italic', opacity: 0.55 },
  accuse: { marginBottom: 1 },
  pressee: { opacity: 0.72 },
  /**
   * Rappel du message cité, dans la bulle et au-dessus du texte.
   *
   * Le filet à gauche plutôt qu'un cadre complet : c'est la convention des
   * messageries, et un cadre fermé dans une bulle déjà arrondie fait deux
   * boîtes emboitées qui alourdissent la lecture.
   */
  cite: {
    gap: 1,
    marginBottom: espacements.xxs,
    paddingLeft: espacements.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accentDoux,
    opacity: 0.92,
  },
  citeMienne: { borderLeftColor: colors.texteInverse },
}));
