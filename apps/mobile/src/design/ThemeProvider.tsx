import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type Theme } from '@lonlonbenu/shared';
import { appliquerLeTheme } from './stylesDynamiques';

/** Ce que la personne a choisi, par opposition à ce qui est appliqué. */
export type PreferenceTheme = 'systeme' | 'clair' | 'sombre';

const ENTREE = 'lonlonbenu.theme';

interface Contexte {
  theme: Theme;
  preference: PreferenceTheme;
  definirPreference: (valeur: PreferenceTheme) => void;
  /** Vrai tant que la préférence enregistrée n'a pas été relue. */
  enChargement: boolean;
}

const ContexteTheme = createContext<Contexte | undefined>(undefined);

/**
 * Fournit le thème à toute l'application.
 *
 * Trois états et non deux : « systéme » suit le réglage du téléphone, et c'est
 * le défaut. Forcer un mode dès la première ouverture reviendrait à décider à
 * la place de quelqu'un qui a déjà exprimé sa préférence ailleurs — et le mode
 * sombre est, pour beaucoup, un besoin de confort visuel avant d'être un goût.
 *
 * La préférence est lue au démarrage avant le premier rendu utile : appliquer
 * le clair puis basculer au sombre une fraction de seconde plus tard produit un
 * éclair blanc désagréable, surtout de nuit.
 */
export function FournisseurTheme({ children }: { children: ReactNode }) {
  const systeme = useColorScheme();
  const [preference, setPreference] = useState<PreferenceTheme>('systeme');
  const [enChargement, setEnChargement] = useState(true);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const enregistree = await AsyncStorage.getItem(ENTREE);
        if (vivant && estPreference(enregistree)) setPreference(enregistree);
      } catch {
        // Stockage indisponible : on reste sur le réglage du système, ce qui
        // est un repli sensé plutôt qu'une erreur à signaler.
      } finally {
        if (vivant) setEnChargement(false);
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const valeur = useMemo<Contexte>(() => {
    const mode =
      preference === 'systeme'
        ? systeme === 'dark'
          ? 'sombre'
          : 'clair'
        : preference;

    // Appliqué pendant le calcul, avant le rendu des enfants : les feuilles de
    // styles dynamiques lisent le thème courant à leur première résolution, et
    // le poser après coup les figerait sur l'ancien.
    appliquerLeTheme(themes[mode]);

    return {
      theme: themes[mode],
      preference,
      enChargement,
      definirPreference: (choix) => {
        setPreference(choix);
        void AsyncStorage.setItem(ENTREE, choix).catch(() => {});
      },
    };
  }, [preference, systeme, enChargement]);

  return (
    <ContexteTheme.Provider value={valeur}>
      {/* La clé remonte l'arbre au changement de thème. C'est ce qui permet aux
          composants de garder leurs feuilles de styles telles quelles : sans
          elle, ceux qui ne consomment pas ce contexte conserveraient leurs
          anciennes couleurs jusqu'à leur prochain rendu. Un remontage complet
          est instantané, et le geste reste rare. */}
      <Fragment key={valeur.theme.mode}>{children}</Fragment>
    </ContexteTheme.Provider>
  );
}

function estPreference(valeur: string | null): valeur is PreferenceTheme {
  return valeur === 'systeme' || valeur === 'clair' || valeur === 'sombre';
}

export function useTheme(): Theme {
  return useContexteTheme().theme;
}

export function useContexteTheme(): Contexte {
  const contexte = useContext(ContexteTheme);
  if (!contexte) {
    throw new Error('useTheme doit être appelé sous <FournisseurTheme>.');
  }
  return contexte;
}

/** Raccourci : la plupart des composants ne veulent que les couleurs. */
export function useCouleurs() {
  return useTheme().colors;
}
