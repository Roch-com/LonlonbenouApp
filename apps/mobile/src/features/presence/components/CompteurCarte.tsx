import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { formaterJours, joursEnsemble, prochainJalon } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSession } from '@/features/reglages/stores/sessionStore';

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
  const depuis = useSession((e) => e.couple.depuis);
  const maintenant = new Date().toISOString();

  const jours = joursEnsemble(depuis, maintenant);
  const jalon = prochainJalon(depuis, maintenant);

  const surOr = enAvant ? styles.surOr : undefined;
  const surOrDoux = enAvant ? styles.surOrDoux : undefined;

  return (
    <Carte ton={enAvant ? 'accent' : 'elevee'}>
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
        <Texte variante="corpsDoux" style={surOrDoux}>
          {jalon.libelle} · dans {jalon.joursRestants}{' '}
          {jalon.joursRestants > 1 ? 'jours' : 'jour'}
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
  unite: { color: colors.texteDoux },
  jalon: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
  jalonSurOr: { borderTopColor: 'rgba(255, 255, 255, 0.32)' },
  surOr: { color: colors.texteInverse },
  // Blanc voilé plutôt qu'un gris : sur un fond or, un gris devient sale.
  surOrDoux: { color: 'rgba(255, 255, 255, 0.86)' },
}));
