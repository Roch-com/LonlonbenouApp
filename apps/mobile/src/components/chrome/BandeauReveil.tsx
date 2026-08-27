import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Texte } from '@/components/ui';
import { colors, espacements, margeEcran } from '@/design/theme';
import { observerLeReveil, serveurSeReveille } from '@/lib/api/client';

/**
 * Bandeau affiché pendant qu'on attend un serveur endormi.
 *
 * L'API est hébergée sur un palier gratuit qui met le serveur en veille après
 * un quart d'heure d'inactivité : la première action de la journée peut
 * attendre près d'une minute. Sans ce bandeau, l'écran resterait figé sans
 * raison apparente — et une attente inexpliquée passe pour une panne.
 *
 * Il disparaît de lui-même dès la réponse. Rien à fermer, rien à faire.
 */
export function BandeauReveil() {
  const [visible, setVisible] = useState(serveurSeReveille());

  useEffect(() => observerLeReveil(setVisible), []);

  if (!visible) return null;

  return (
    <View style={styles.bandeau} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.accentFonce} />
      <Texte variante="meta" numberOfLines={2} style={styles.texte}>
        Le serveur se réveille — quelques secondes. Rien n’est perdu.
      </Texte>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
    paddingHorizontal: margeEcran,
    paddingVertical: espacements.xs,
    backgroundColor: colors.fondNuance,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bordure,
  },
  texte: { flex: 1, minWidth: 0, color: colors.accentFonce },
});
