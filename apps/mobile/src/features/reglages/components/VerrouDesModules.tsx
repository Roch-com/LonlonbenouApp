import { Switch, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import {
  LIBELLES_VERROU,
  useVerrouModules,
  type ModuleVerrouillable,
} from '../stores/verrouModulesStore';
import { useVerrou } from '../stores/verrouStore';

const MODULES: ModuleVerrouillable[] = ['confidences', 'presence'];

/**
 * Pôle ⑥ — réglage du verrou renforcé (§8.20 du cahier).
 *
 * Il exige qu'un code existe déjà : le verrou renforcé réutilise celui de
 * l'application plutôt que d'en inventer un second. Deux codes à retenir pour
 * une app ouverte tous les jours et un module ouvert une fois par mois, c'est
 * la garantie d'oublier le second — et un verrou dont on se retrouve exclu
 * n'est pas une protection.
 */
export function VerrouDesModules() {
  const colors = useCouleurs();
  const codeDefini = useVerrou((e) => e.actif);
  const proteges = useVerrouModules((e) => e.proteges);
  const basculer = useVerrouModules((e) => e.basculerProtection);

  return (
    <Carte>
      <Texte variante="surtitre">Verrou renforcé</Texte>
      <Texte variante="corps" style={styles.mention}>
        Redemander le code avant d’ouvrir les parties les plus intimes, même
        quand l’application est déjà déverrouillée.
      </Texte>

      {!codeDefini ? (
        <Texte variante="meta" style={styles.mention}>
          Définissez d’abord un code pour l’application, plus haut : c’est celui
          qui sera demandé ici.
        </Texte>
      ) : null}

      <View style={styles.liste}>
        {MODULES.map((module) => {
          const libelle = LIBELLES_VERROU[module];
          const actif = proteges.includes(module);
          return (
            <View key={module} style={styles.ligne}>
              <View style={styles.texte}>
                <Texte variante="corps">{libelle.titre}</Texte>
                <Texte variante="petit">{libelle.detail}</Texte>
              </View>
              <Switch
                value={actif}
                disabled={!codeDefini}
                onValueChange={(v) => basculer(module, v)}
                trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
                thumbColor={actif ? colors.accent : undefined}
                accessibilityLabel={libelle.titre}
              />
            </View>
          );
        })}
      </View>

      <Texte variante="meta" style={styles.mention}>
        Ce verrou se referme dès que l’application passe en arrière-plan, sans
        délai — c’est ce qui le distingue du verrou général.
      </Texte>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  mention: { marginTop: espacements.xs },
  liste: { marginTop: espacements.lg, gap: espacements.lg },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  texte: { flex: 1, minWidth: 0, gap: espacements.xxs },
  fond: { backgroundColor: colors.fond },
}));
