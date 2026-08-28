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
 * ensemble est ce qui mérite d'être vu en premier, le reste se lit ensuite.
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

  const surOr = enAvant ? styles.surOr : undefined;
  const surOrDoux = enAvant ? styles.surOrDoux : undefined;

  return (
    <Carte ton={enAvant ? 'or' : 'elevee'}>
      <Texte variante="surtitre" style={surOr}>
        Ensemble depuis
      </Texte>

      <View style={styles.ligne}>
        <Texte
          variante="afficheXl"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.nombre, surOr]}
        >
          {formaterJours(jours)}
        </Texte>
        <Texte variante="sousTitre" style={[styles.unite, surOrDoux]}>
          jours
        </Texte>
      </View>

      {!compact ? (
        <Texte variante="petit" style={surOrDoux}>
          Depuis le {dateLongue(depuis)}
        </Texte>
      ) : null}

      <View style={[styles.jalon, enAvant && styles.jalonSurOr]}>
        <Texte variante="meta" style={surOrDoux}>
          Prochain jalon
        </Texte>
        <Texte variante="corps" style={[styles.jalonTexte, surOr]}>
          {jalon.libelle}
          <Texte variante="corps" style={surOrDoux}>
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
  // Sur la carte dorée, l'unité suit `surOrDoux` ; ailleurs elle reste douce.
  unite: { color: colors.texteDoux },
  jalonTexte: { marginTop: espacements.xxs },
  jalon: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
  jalonSurOr: { borderTopColor: colors.bordureSurAccent },
  surOr: { color: colors.texteSurAccent },
  /**
   * Encre voilée, et non du blanc.
   *
   * Le blanc paraît le choix évident sur une couleur vive — il ne l'est pas
   * ici. Le dégradé d'or est clair, dans les deux thèmes : un blanc à 86 %
   * s'y délave et le texte se devine plus qu'il ne se lit. C'était le cas de
   * « jours » et de la ligne du prochain jalon.
   */
  surOrDoux: { color: colors.texteSurAccentDoux },
}));
