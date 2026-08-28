import { Pressable, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Texte } from '@/components/ui';
import { espacements, ombres, rayons } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { usePresenceLisible } from '../hooks/useLecturesDechiffrees';
import { usePresence } from '../stores/presenceStore';

/**
 * Bandeau d'alerte SOS. Visible des deux côtés, **quel que soit l'état du
 * partage de position** : le serveur laisse toujours passer une alerte. Une
 * détresse ne se négocie pas.
 */
export function BandeauSos() {
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const { alertes } = usePresenceLisible();
  const changerEtat = usePresence((e) => e.changerEtatAlerte);

  const alerte = alertes.find((a) => a.etat === 'actif');
  if (!alerte || !coupleId || !partenaireId) return null;

  const cEstMoi = alerte.partenaireId === partenaireId;

  return (
    <View style={styles.bandeau}>
      <Texte variante="sousTitre" style={styles.titre}>
        {cEstMoi ? 'Ton SOS a été envoyé' : `${autre.prenom} a déclenché un SOS`}
      </Texte>

      <Texte variante="petit" style={styles.detail}>
        {ilYA(alerte.emiseLe)}
        {alerte.lieu ? ` · ${alerte.lieu}` : ''}
        {alerte.vueLe && cEstMoi ? ' · vu' : ''}
      </Texte>

      {alerte.message ? (
        <Texte variante="corps" style={styles.message}>
          {alerte.message}
        </Texte>
      ) : null}

      <View style={styles.actions}>
        {!cEstMoi && !alerte.vueLe ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void changerEtat(coupleId, partenaireId, alerte.id, 'vue')
            }
            style={styles.action}
          >
            <Texte variante="petit" style={styles.actionTexte}>
              J’ai vu, j’arrive
            </Texte>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void changerEtat(coupleId, partenaireId, alerte.id, 'resolue')
          }
          style={styles.action}
        >
          <Texte variante="petit" style={styles.actionTexte}>
            Tout va bien maintenant
          </Texte>
        </Pressable>
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bandeau: {
    backgroundColor: colors.urgence,
    borderRadius: rayons.lg,
    padding: espacements.lg,
    gap: espacements.xxs,
    ...ombres.flottant,
  },
  titre: { color: colors.texteInverse },
  detail: { color: colors.texteInverse, opacity: 0.85 },
  message: { color: colors.texteInverse, marginTop: espacements.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.md,
  },
  action: {
    paddingVertical: espacements.xs,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.rond,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  actionTexte: { color: colors.texteInverse },
}));
