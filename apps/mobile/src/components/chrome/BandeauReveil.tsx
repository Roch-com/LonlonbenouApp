import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, margeEcran } from '@/design/theme';
import { observerLeReveil, serveurSeReveille } from '@/lib/api/client';

/**
 * Bandeau affiché pendant une première requête qui tarde.
 *
 * ## Ce qu'il dit, et ce qu'il tait
 *
 * Il disait « le serveur se réveille ». C'est vrai — l'API dort après un quart
 * d'heure d'inactivité — mais ça n'a rien à faire sous les yeux d'un couple :
 * personne n'a à connaître l'hébergement de l'application pour s'en servir, et
 * nommer le serveur transforme une lenteur en panne annoncée.
 *
 * Il dit maintenant ce que la personne peut constater : la synchronisation est
 * en cours, et rien n'est perdu. C'est vrai dans tous les cas — serveur
 * endormi, réseau lent, requête simplement longue — là où l'ancienne
 * formulation ne l'était que dans un seul.
 *
 * Il disparaît de lui-même dès la réponse. Rien à fermer, rien à faire.
 */
export function BandeauReveil() {
  const colors = useCouleurs();
  const [visible, setVisible] = useState(serveurSeReveille());

  useEffect(() => observerLeReveil(setVisible), []);

  if (!visible) return null;

  return (
    <View style={styles.bandeau} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.accentFonce} />
      <Texte variante="meta" numberOfLines={2} style={styles.texte}>
        Synchronisation en cours…
      </Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
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
}));
