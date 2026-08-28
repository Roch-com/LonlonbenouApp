import { StyleSheet, View } from 'react-native';
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
      <View
        style={[
          styles.bulle,
          deMoi ? styles.mienne : styles.sienne,
          // Le coin pointu marque la fin du bloc, comme une signature.
          dernierDuGroupe && (deMoi ? styles.finMienne : styles.finSienne),
          douce && styles.douce,
        ]}
      >
        {douce ? (
          <Texte variante="surtitre" style={styles.etiquetteDouce}>
            Note douce
          </Texte>
        ) : null}

        <Texte
          variante={douce ? 'sousTitre' : 'corps'}
          style={deMoi && !douce ? styles.texteMien : undefined}
        >
          {message.illisible
            ? 'Message illisible sur cet appareil — la clé a changé.'
            : message.texte}
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
                color={colors.texteSurAccent}
                style={styles.accuse}
              />
            ) : null}
          </View>
        ) : null}
      </View>
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
  // Sur l'or, c'est l'encre qui se lit — pas la lumière. Même règle que la
  // carte du compteur.
  texteMien: { color: colors.texteSurAccent },
  pied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacements.xxs,
  },
  metaMienne: { color: colors.texteSurAccentDoux },
  accuse: { marginBottom: 1 },
}));
