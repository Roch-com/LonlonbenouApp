import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { formaterJours, joursEnsemble, prochainJalon } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { espacements, rayons } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';

interface Props {
  compact?: boolean;
  /** Traitement de couverture : surface colorée, texte inverse. */
  enAvant?: boolean;
}

/**
 * Pôle ① — Compteur du couple (P0).
 *
 * ## Ce que la version précédente ratait
 *
 * Un aplat coloré avec du texte posé dessus, sans hiérarchie : le nombre, son
 * unité, la date et le jalon avaient tous à peu près le même poids visuel, et
 * l'œil ne savait pas où se poser. Une couleur vive ne fait pas une belle
 * carte — elle rend seulement plus visible l'absence de structure.
 *
 * ## Ce qui la remplace
 *
 * Trois niveaux, franchement séparés. Le nombre domine, seul, en très grand.
 * La barre de progression donne d'un coup d'œil ce qu'aucun chiffre ne dit :
 * **où l'on en est du prochain jalon**. Le reste passe en retrait.
 *
 * La barre est le vrai apport. « 2 470 jours » est une information close ;
 * « 2 470, et la barre aux neuf dixièmes » raconte quelque chose en cours.
 */
export function CompteurCarte({ compact, enAvant }: Props) {
  const colors = useCouleurs();
  const depuisLocal = useSession((e) => e.couple.depuis);
  const depuisServeur = useSessionServeur((e) => e.depuis);

  // Le serveur fait autorité dès qu'il connaît le couple ; la valeur locale
  // n'est qu'un repli d'amorçage.
  const depuis = depuisServeur ?? depuisLocal;
  const maintenant = new Date().toISOString();

  const jours = joursEnsemble(depuis, maintenant);
  const jalon = prochainJalon(depuis, maintenant);

  // Part du chemin parcourue depuis le jalon précédent. Bornée : un jalon qui
  // vient d'être franchi donnerait sinon une barre vide ou débordante.
  const avancement = Math.min(1, Math.max(0.02, jours / jalon.jour));

  const surAccent = enAvant ? styles.surAccent : undefined;
  const surAccentDoux = enAvant ? styles.surAccentDoux : undefined;

  return (
    <Carte ton={enAvant ? 'accent' : 'elevee'}>
      <Texte variante="surtitre" style={surAccent}>
        Ensemble depuis
      </Texte>

      <View style={styles.ligne}>
        <Texte
          variante="afficheXl"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.nombre, surAccent]}
        >
          {formaterJours(jours)}
        </Texte>
        <Texte variante="sousTitre" style={[styles.unite, surAccentDoux]}>
          jours
        </Texte>
      </View>

      {!compact ? (
        <Texte variante="petit" style={surAccentDoux}>
          Depuis le {dateLongue(depuis)}
        </Texte>
      ) : null}

      <View style={styles.progression}>
        <View
          style={[
            styles.rail,
            {
              backgroundColor: enAvant
                ? colors.bordureSurAccent
                : colors.fondNuance,
            },
          ]}
        >
          <View
            style={[
              styles.jauge,
              {
                width: `${avancement * 100}%`,
                backgroundColor: enAvant ? colors.texteInverse : colors.accent,
              },
            ]}
          />
        </View>

        <View style={styles.legende}>
          <Texte variante="meta" style={surAccentDoux} numberOfLines={1}>
            {jalon.libelle}
          </Texte>
          <Texte variante="meta" style={surAccentDoux} numberOfLines={1}>
            dans {jalon.joursRestants} {jalon.joursRestants > 1 ? 'jours' : 'jour'}
          </Texte>
        </View>
      </View>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  ligne: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacements.xs,
    marginTop: espacements.xxs,
  },
  // `flexShrink` sur le nombre seulement : au-delà de mille jours, c'est lui
  // qui se réduit, jamais l'unité — « 2 470 jour » se lisait comme une faute.
  nombre: { flexShrink: 1 },
  unite: { color: colors.texteDoux, flexShrink: 0 },

  progression: { marginTop: espacements.md, gap: espacements.xs },
  rail: {
    height: 4,
    borderRadius: rayons.rond,
    overflow: 'hidden',
  },
  jauge: { height: '100%', borderRadius: rayons.rond },
  legende: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },

  surAccent: { color: colors.texteInverse },
  // Le voile se fait à l'opacité : une couleur fixe ne conviendrait pas aux
  // deux thèmes, puisque `texteInverse` bascule du blanc à l'encre.
  surAccentDoux: { color: colors.texteInverse, opacity: 0.82 },
}));
