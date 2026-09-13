import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { Texte } from '@/components/ui';
import { MarqueAnimee } from './MarqueAnimee';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useTheme } from '@/design/ThemeProvider';
import { espacements } from '@/design/theme';

/**
 * Le temps que la marque entière reste immobile à l'écran, une fois l'app prête.
 *
 * Il se compte depuis la **fin** du mouvement, l'or scellé compris. Il partait
 * auparavant de la rencontre des deux moitiés, six dixièmes de seconde avant
 * que l'or ait fini de venir : le fondu s'enclenchait presque au moment où la
 * marque devenait complète, et on n'avait pas le temps de la voir entière.
 */
const REPOS_MS = 900;
const FONDU_MS = 560;

/** Taille de la marque à l'ouverture. */
const MARQUE_PX = 108;

interface Props {
  /** Vrai quand l'app peut prendre le relais — polices chargées, session lue. */
  prete: boolean;
  children: ReactNode;
}

/**
 * Ouverture de l'application.
 *
 * Une app qui s'ouvre d'un coup sur son tableau de bord paraît brutale ; une
 * qui fait patienter trop longtemps paraît lente. Le compromis retenu : la
 * marque apparaît, respire une demi-seconde, puis s'efface en laissant le
 * contenu monter d'en dessous.
 *
 * Le mouvement dure moins d'une seconde en tout, et **ne bloque rien** — le
 * contenu est monté derrière dès le premier instant. Si l'app est prête avant
 * la fin, on ne rallonge pas ; si elle traîne, l'ouverture attend sans à-coup.
 *
 * L'échelle de la marque se resserre vers 1 plutôt que de partir en dessous :
 * un motif qui rétrécit légèrement donne l'impression de se poser, là où un
 * motif qui grandit semble sauter vers l'avant. C'est `MarqueAnimee` qui la
 * porte désormais.
 *
 * La marque, elle, se construit — `MarqueAnimee` fait venir ses deux moitiés
 * l'une vers l'autre. Le nom et la devise n'arrivent qu'ensuite : les faire
 * monter pendant le rapprochement aurait mis deux mouvements en concurrence, et
 * c'est la marque qu'on doit regarder.
 *
 * Le repos ne commence qu'une fois ce mouvement **entièrement** terminé, or
 * compris. Sans quoi une application prête tout de suite — le cas ordinaire au
 * deuxième lancement — couperait l'ouverture en plein milieu.
 */
export function Ouverture({ prete, children }: Props) {
  const { degrades, mode } = useTheme();
  const [terminee, setTerminee] = useState(false);
  const [marqueFaite, setMarqueFaite] = useState(false);

  const opacite = useRef(new Animated.Value(1)).current;
  const opaciteMarque = useRef(new Animated.Value(0)).current;
  const opaciteNom = useRef(new Animated.Value(0)).current;
  const monteeNom = useRef(new Animated.Value(10)).current;
  const monteeContenu = useRef(new Animated.Value(16)).current;
  const opaciteContenu = useRef(new Animated.Value(0)).current;

  // Entrée du bloc : indépendante de l'état de chargement, elle démarre dès le
  // premier rendu. L'opacité monte vite — c'est le rapprochement des moitiés
  // qui doit se voir, pas l'apparition.
  //
  // Le bloc ne porte plus d'échelle : `MarqueAnimee` a la sienne, et les deux
  // se multipliaient. Le 1,08 d'ici et le 0,94 de là partaient de 1,015 pour
  // finir à 1 — un mouvement invisible, qui annulait l'effet de pose des deux.
  useEffect(() => {
    Animated.timing(opaciteMarque, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [opaciteMarque]);

  // Le nom vient après la marque, et de dessous : il la présente plutôt que de
  // lui disputer l'attention.
  const surRencontre = useCallback(() => {
    Animated.parallel([
      Animated.timing(opaciteNom, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(monteeNom, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opaciteNom, monteeNom]);

  const surMarqueFinie = useCallback(() => setMarqueFaite(true), []);

  useEffect(() => {
    if (!prete || !marqueFaite) return;

    const minuterie = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacite, {
          toValue: 0,
          duration: FONDU_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opaciteContenu, {
          toValue: 1,
          duration: FONDU_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(monteeContenu, {
          toValue: 0,
          duration: FONDU_MS + 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Le voile est retiré de l'arbre une fois invisible : le laisser
        // capterait les touchers et masquerait l'app sans qu'on voie pourquoi.
        if (finished) setTerminee(true);
      });
    }, REPOS_MS);

    return () => clearTimeout(minuterie);
  }, [prete, marqueFaite, opacite, opaciteContenu, monteeContenu]);

  return (
    <View style={styles.cadre}>
      <Animated.View
        style={[
          styles.contenu,
          { opacity: opaciteContenu, transform: [{ translateY: monteeContenu }] },
        ]}
      >
        {children}
      </Animated.View>

      {terminee ? null : (
        <Animated.View
          style={[styles.voile, { opacity: opacite }]}
          pointerEvents={prete ? 'none' : 'auto'}
        >
          <LinearGradient
            colors={[...degrades.fond]}
            locations={[0, 0.5, 1]}
            style={styles.remplissage}
          />
          <Animated.View
            style={[styles.marque, { opacity: opaciteMarque }]}
          >
            <View style={styles.embleme}>
              <MarqueAnimee
                taille={MARQUE_PX}
                surFondSombre={mode === 'sombre'}
                onRencontre={surRencontre}
                onFini={surMarqueFinie}
              />
            </View>
            <Animated.View
              style={{
                alignItems: 'center',
                gap: espacements.xs,
                opacity: opaciteNom,
                transform: [{ translateY: monteeNom }],
              }}
            >
              <Texte variante="affiche" style={styles.nom}>
                LONLONBENU
              </Texte>
              <Texte variante="petit" style={styles.devise}>
                La chose de l’amour
              </Texte>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: { flex: 1, backgroundColor: colors.fond },
  contenu: { flex: 1 },
  voile: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remplissage: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  marque: { alignItems: 'center', gap: espacements.xs },
  embleme: { marginBottom: espacements.md },
  nom: { letterSpacing: 2, color: colors.accentFonce },
  devise: { color: colors.texteDoux, fontStyle: 'italic' },
}));
