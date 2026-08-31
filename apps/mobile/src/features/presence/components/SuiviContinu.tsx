import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useLieux } from '../stores/lieuxStore';
import { usePosition } from '../stores/positionStore';
import { memoriserLeCouple } from '../services/tachesPosition';
import {
  armerLeGeofencing,
  arreterLeSuivi,
  demanderArrierePlan,
  demarrerLeSuivi,
  desarmerLeGeofencing,
  permissionArrierePlan,
  suiviActif,
  type EtatPermissionArrierePlan,
} from '../services/suiviArrierePlan';

/**
 * Pôle ① — réglage du suivi continu (§8.2).
 *
 * ## Ce que ce réglage change, et ce qu'il ne change pas
 *
 * Il augmente **ce que je montre**, jamais ce que je vois. L'activer ne donne
 * aucun accès supplémentaire à la position de l'autre : celle-ci dépend du
 * partage réciproque, pas du mode de relevé. C'est pour cette raison qu'il est
 * ici, réglable par chacun pour soi, et non dans les consentements partagés.
 *
 * ## Pourquoi il est éteint par défaut
 *
 * Le cahier signale la batterie comme point de vigilance connu, et un relevé
 * continu reste un relevé continu. On l'allume en connaissance de cause ou pas
 * du tout — jamais par défaut.
 */
export function SuiviContinu() {
  const colors = useCouleurs();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const permissionPremierPlan = usePosition((e) => e.permission);
  const lieux = useLieux((e) => e.lieux);

  const [permission, setPermission] = useState<EtatPermissionArrierePlan>(
    'jamais_demandee',
  );
  const [actif, setActif] = useState(false);
  const [enCours, setEnCours] = useState(false);

  // Les tâches d'arrière-plan n'ont pas accès aux hooks : l'identifiant du
  // couple leur est déposé ici, tant qu'une session existe.
  useEffect(() => {
    memoriserLeCouple(coupleId);
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void (async () => {
        const [p, a] = await Promise.all([permissionArrierePlan(), suiviActif()]);
        if (!vivant) return;
        setPermission(p);
        setActif(a);
      })();
      return () => {
        vivant = false;
      };
    }, []),
  );

  /**
   * Les régions surveillées suivent les lieux favoris.
   *
   * Réarmées à chaque changement : un lieu ajouté puis jamais surveillé
   * donnerait un réglage qui ment sur ce qu'il fait.
   */
  useEffect(() => {
    if (!actif) return;
    void armerLeGeofencing(
      lieux
        .filter((l) => l.statut)
        .map((l) => ({
          identifier: l.id,
          latitude: l.latitude,
          longitude: l.longitude,
          radius: l.rayonM,
        })),
    );
  }, [actif, lieux]);

  if (permissionPremierPlan !== 'accordee') return null;

  const basculer = async (vers: boolean) => {
    setEnCours(true);
    try {
      if (!vers) {
        await arreterLeSuivi();
        await desarmerLeGeofencing();
        setActif(false);
        return;
      }

      const accord = permission === 'accordee' ? permission : await demanderArrierePlan();
      setPermission(accord);
      if (accord !== 'accordee') return;

      await demarrerLeSuivi();
      setActif(true);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte>
      <View style={styles.ligne}>
        <View style={styles.texte}>
          <Texte variante="corps">Continuer quand l’app est fermée</Texte>
          <Texte variante="petit">
            Votre position se met à jour même sans ouvrir l’application, et vos
            lieux posent leur statut à votre arrivée.
          </Texte>
        </View>
        <Switch
          value={actif}
          disabled={enCours || permission === 'refusee'}
          onValueChange={(v) => void basculer(v)}
          trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
          thumbColor={actif ? colors.accent : undefined}
          accessibilityLabel="Continuer quand l’application est fermée"
        />
      </View>

      <Texte variante="meta" style={styles.mention}>
        Cela change ce que vous montrez, jamais ce que vous voyez : la position
        de votre partenaire dépend de votre partage à tous les deux, pas de ce
        réglage.
      </Texte>

      {actif ? (
        <Texte variante="meta" style={styles.mention}>
          Android affiche une notification permanente pendant ce suivi. Elle ne
          peut pas être masquée, et c’est voulu : rien ici ne se fait en
          silence.
        </Texte>
      ) : null}

      {permission === 'refusee' ? (
        <Texte variante="meta" style={styles.mention}>
          L’autorisation d’arrière-plan a été refusée pour cette application.
          Elle se redonne dans les réglages du téléphone, si vous le souhaitez.
        </Texte>
      ) : null}

      {actif && lieux.filter((l) => l.statut).length === 0 ? (
        <Texte variante="meta" style={styles.mention}>
          Aucun de vos lieux ne porte de statut : le suivi publie votre position
          mais ne posera rien automatiquement.
        </Texte>
      ) : null}
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  texte: { flex: 1, minWidth: 0, gap: espacements.xxs },
  mention: { marginTop: espacements.sm },
  fond: { backgroundColor: colors.fond },
}));
