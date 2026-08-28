import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { formaterJours, joursEnsemble, prochainJalon } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';

interface Props {
  compact?: boolean;
  /** Traitement de couverture : dégradé or, texte clair. */
  enAvant?: boolean;
}

/**
 * Pôle ① — Compteur du couple (P0).
 *
 * En mode `enAvant`, c'est la seule surface colorée de l'écran d'accueil. Un
 * écran où tout est mis en avant n'a plus de hiérarchie : le nombre de jours
 * ensemble mérite d'être vu en premier, le reste se lit ensuite.
 *
 * Cette surface porte l'accent **bleu** et non l'or. L'or en aplat, au milieu
 * d'une interface bleue, ne se lisait pas comme une mise en avant mais comme
 * une pièce rapportée. Il subsiste en filet, sur la ligne du prochain jalon :
 * un accent secondaire se remarque d'autant mieux qu'il reste mince.
 */
export function CompteurCarte({ compact, enAvant }: Props) {
  const depuisLocal = useSession((e) => e.couple.depuis);
  const depuisServeur = useSessionServeur((e) => e.depuis);

  // Le serveur fait autorité dès qu'il connaît le couple. La valeur locale
  // n'est qu'un repli d'amorçage : c'est elle qui affichait une date de
  // démonstration — et donc une durée fausse — une fois les comptes reliés.
  const depuis = depuisServeur ?? depuisLocal;
  const maintenant = new Date().toISOString();

  const jours = joursEnsemble(depuis, maintenant);
  const jalon = prochainJalon(depuis, maintenant);

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

      <View style={[styles.jalon, enAvant && styles.jalonSurAccent]}>
        <Texte variante="meta" style={surAccentDoux}>
          Prochain jalon
        </Texte>
        <Texte variante="corps" style={[styles.jalonTexte, surAccent]}>
          {jalon.libelle}
          <Texte variante="corps" style={surAccentDoux}>
            {' '}
            · dans {jalon.joursRestants}{' '}
            {jalon.joursRestants > 1 ? 'jours' : 'jour'}
          </Texte>
        </Texte>
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
  // `flexShrink` : au-delà de mille jours, le nombre doit se réduire plutôt
  // que pousser l'unité hors de la carte.
  nombre: { flexShrink: 1 },
  // Sur la carte dorée, l'unité suit `surAccentDoux` ; ailleurs elle reste douce.
  unite: { color: colors.texteDoux },
  jalonTexte: { marginTop: espacements.xxs },
  jalon: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
  // Le filet d'or : la seule trace de l'accent secondaire sur cette carte.
  jalonSurAccent: { borderTopColor: colors.or },
  surAccent: { color: colors.texteInverse },
  /**
   * Sur le bleu, c'est `texteInverse` qui se lit — blanc en mode clair, encre
   * en mode sombre. Le voile se fait à l'opacité plutôt qu'avec une couleur
   * fixe : une valeur en dur ne pourrait pas convenir aux deux thèmes.
   */
  surAccentDoux: { color: colors.texteInverse, opacity: 0.82 },
}));
