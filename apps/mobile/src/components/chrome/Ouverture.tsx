import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useTheme } from '@/design/ThemeProvider';
import { espacements } from '@/design/theme';

/** Le temps que la marque reste seule à l'écran, une fois l'app prête. */
const REPOS_MS = 780;
const FONDU_MS = 560;

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
 * L'échelle part de 1,08 et se resserre vers 1 plutôt que l'inverse : un motif
 * qui rétrécit légèrement donne l'impression de se poser, là où un motif qui
 * grandit semble sauter vers l'avant.
 */
export function Ouverture({ prete, children }: Props) {
  const { degrades } = useTheme();
  const [terminee, setTerminee] = useState(false);

  const opacite = useRef(new Animated.Value(1)).current;
  const echelle = useRef(new Animated.Value(1.08)).current;
  const opaciteMarque = useRef(new Animated.Value(0)).current;
  const monteeContenu = useRef(new Animated.Value(16)).current;
  const opaciteContenu = useRef(new Animated.Value(0)).current;

  // Entrée de la marque : indépendante de l'état de chargement, elle démarre
  // dès le premier rendu.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opaciteMarque, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(echelle, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opaciteMarque, echelle]);

  useEffect(() => {
    if (!prete) return;

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
  }, [prete, opacite, opaciteContenu, monteeContenu]);

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
            style={[
              styles.marque,
              { opacity: opaciteMarque, transform: [{ scale: echelle }] },
            ]}
          >
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.embleme}
              resizeMode="contain"
            />
            <Texte variante="affiche" style={styles.nom}>
              LONLONBENU
            </Texte>
            <Texte variante="petit" style={styles.devise}>
              La chose de l’amour
            </Texte>
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
  embleme: { width: 96, height: 96, marginBottom: espacements.md },
  nom: { letterSpacing: 2, color: colors.accentFonce },
  devise: { color: colors.texteDoux, fontStyle: 'italic' },
}));
