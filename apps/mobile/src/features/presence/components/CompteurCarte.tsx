import { StyleSheet, View } from 'react-native';
import { formaterJours, joursEnsemble, prochainJalon } from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSession } from '@/features/reglages/stores/sessionStore';

interface Props {
  compact?: boolean;
}

/** Pôle ① — Compteur du couple (P0). */
export function CompteurCarte({ compact }: Props) {
  const depuis = useSession((e) => e.couple.depuis);
  const maintenant = new Date().toISOString();

  const jours = joursEnsemble(depuis, maintenant);
  const jalon = prochainJalon(depuis, maintenant);

  return (
    <Carte>
      <Texte variante="surtitre">Ensemble depuis</Texte>
      <View style={styles.ligne}>
        <Texte variante="afficheXl">{formaterJours(jours)}</Texte>
        <Texte variante="sousTitre" style={styles.unite}>
          jours
        </Texte>
      </View>

      {!compact ? (
        <Texte variante="petit">Depuis le {dateLongue(depuis)}</Texte>
      ) : null}

      <View style={styles.jalon}>
        <Texte variante="corpsDoux">
          {jalon.libelle} · dans {jalon.joursRestants}{' '}
          {jalon.joursRestants > 1 ? 'jours' : 'jour'}
        </Texte>
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'baseline', gap: espacements.xs },
  unite: { color: colors.texteDoux },
  jalon: {
    marginTop: espacements.md,
    paddingTop: espacements.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
  },
});
