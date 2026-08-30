import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import type { MessageLisible } from '../hooks/useLecturesDechiffrees';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { heure } from '@/lib/temps';

interface Props {
  message: MessageLisible;
  deMoi: boolean;
  /** Vrai si le message précédent vient du même auteur, à peu d'intervalle. */
  suiteDuPrecedent?: boolean;
  /** Vrai si le suivant vient d'un autre auteur — ou s'il n'y en a plus. */
  dernierDuGroupe?: boolean;
  /** Message cité, déjà résolu par l'appelant. */
  cite?: { auteurEstMoi: boolean; texte: string };
  onAppuiLong?: () => void;
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
 */
export function BulleMessage({
  message,
  deMoi,
  suiteDuPrecedent,
  dernierDuGroupe = true,
  cite,
  onAppuiLong,
}: Props) {
  const colors = useCouleurs();
  const douce = message.type === 'note_douce';

  return (
    <View
      style={[
        styles.rangee,
        deMoi ? styles.aDroite : styles.aGauche,
        suiteDuPrecedent ? styles.serree : styles.espacee,
      ]}
    >
      <Pressable
        onLongPress={onAppuiLong}
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

        <Texte
          variante={douce ? 'sousTitre' : 'corps'}
          style={[
            deMoi && !douce ? styles.texteMien : undefined,
            message.illisible && styles.illisible,
          ]}
        >
          {message.illisible ? 'Message d’avant vos clés actuelles' : message.texte}
        </Texte>

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
      </Pressable>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  rangee: { flexDirection: 'row' },
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
