import { useEffect, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ClavierPin } from './ClavierPin';
import {
  LIBELLES_VERROU,
  useModuleAccessible,
  useVerrouModules,
  type ModuleVerrouillable,
} from '../stores/verrouModulesStore';

interface Props {
  module: ModuleVerrouillable;
  children: ReactNode;
}

/**
 * Voile de déverrouillage devant un module protégé.
 *
 * Le contenu n'est pas monté derrière : un écran qu'on masque par-dessus reste
 * dans l'arbre, apparaît une fraction de seconde au montage et se retrouve
 * dans l'aperçu du sélecteur d'applications. Pour un module qu'on a
 * explicitement choisi de protéger, ce serait manquer le but.
 */
export function GardeModuleSensible({ module, children }: Props) {
  const colors = useCouleurs();
  const accessible = useModuleAccessible(module);
  const ouvrirParBiometrie = useVerrouModules((e) => e.ouvrirParBiometrie);
  const ouvrirParPin = useVerrouModules((e) => e.ouvrirParPin);
  const toutRefermer = useVerrouModules((e) => e.toutRefermer);

  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string>();
  const [clavierOuvert, setClavierOuvert] = useState(false);

  // Sans délai de grâce, à la différence du verrou général : c'est
  // précisément ce qu'on ne veut pas laisser ouvert en tendant son téléphone.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') toutRefermer();
    });
    return () => abonnement.remove();
  }, [toutRefermer]);

  // La biométrie se propose d'elle-même : c'est le geste attendu, et obliger
  // à toucher un bouton avant de poser son doigt n'ajoute rien.
  useEffect(() => {
    if (!accessible) void ouvrirParBiometrie(module);
  }, [accessible, module, ouvrirParBiometrie]);

  if (accessible) return <>{children}</>;

  const libelle = LIBELLES_VERROU[module];

  const essayer = async (code: string) => {
    const resultat = await ouvrirParPin(module, code);
    setPin('');
    setMessage(resultat.ok ? undefined : resultat.message);
  };

  return (
    <Carte>
      <View style={styles.entete}>
        <Feather name="lock" size={20} color={colors.accent} />
        <Texte variante="titre" style={styles.titre}>
          {libelle.titre}
        </Texte>
      </View>

      <Texte variante="corpsDoux" style={styles.intro}>
        Vous avez choisi de protéger cette partie par un code. Il est redemandé
        à chaque fois que l’application repasse au premier plan.
      </Texte>

      {clavierOuvert ? (
        <View style={styles.clavier}>
          <ClavierPin
            valeur={pin}
            onChange={(v) => {
              setPin(v);
              setMessage(undefined);
              // Le code fait quatre à six chiffres : on tente dès qu’il peut
              // être complet, plutôt que d’exiger un bouton « valider » de plus.
              if (v.length >= 4) void essayer(v);
            }}
          />
          {message ? (
            <Texte variante="petit" style={styles.erreur}>
              {message}
            </Texte>
          ) : null}
        </View>
      ) : (
        <View style={styles.actions}>
          <Bouton
            libelle="Déverrouiller"
            icone="unlock"
            onPress={() => void ouvrirParBiometrie(module)}
          />
          <Bouton
            libelle="Utiliser mon code"
            ton="discret"
            onPress={() => setClavierOuvert(true)}
          />
        </View>
      )}
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espacements.sm },
  titre: { flex: 1, minWidth: 0 },
  intro: { marginTop: espacements.sm },
  actions: { gap: espacements.sm, marginTop: espacements.lg },
  clavier: { marginTop: espacements.lg, gap: espacements.md },
  erreur: { color: colors.tendresse, textAlign: 'center' },
}));
