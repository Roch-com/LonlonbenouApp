import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { durees, espacements, margeEcran, rayons } from '@/design/theme';

/** Intervalle entre deux cartes, quand personne n'a encore touché l'écran. */
const DEFILEMENT_MS = 6500;

export interface Diapositive {
  cle: string;
  contenu: ReactNode;
}

interface Props {
  diapositives: Diapositive[];
}

/**
 * Carrousel de l'accueil.
 *
 * ## Trois partis pris
 *
 * **Le défilement s'arrête au premier geste.** Il reprend l'initiative tant que
 * personne ne s'en occupe, et la rend définitivement dès qu'on y touche. Un
 * carrousel qui continue de bouger pendant qu'on lit une carte est une des
 * choses les plus agaçantes qu'une interface puisse faire.
 *
 * **Six secondes et demie entre deux cartes.** Assez pour lire trois lignes
 * sans se presser. Les carrousels publicitaires descendent à trois secondes
 * parce qu'ils cherchent à faire défiler, pas à faire lire.
 *
 * **Les points ne sont pas des pastilles identiques.** Celui de la carte
 * courante s'allonge au lieu de changer seulement de couleur : la position se
 * lit alors d'un coup d'œil, y compris pour qui distingue mal les nuances.
 */
export function Carrousel({ diapositives }: Props) {
  const defilement = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [manuel, setManuel] = useState(false);

  const largeur = useMemo(() => {
    const { width } = Dimensions.get('window');
    return width - margeEcran * 2;
  }, []);

  const pas = largeur + espacements.sm;

  useEffect(() => {
    if (manuel || diapositives.length < 2) return;

    const minuterie = setInterval(() => {
      setIndex((courant) => {
        const suivant = (courant + 1) % diapositives.length;
        defilement.current?.scrollTo({ x: suivant * pas, animated: true });
        return suivant;
      });
    }, DEFILEMENT_MS);

    return () => clearInterval(minuterie);
  }, [manuel, diapositives.length, pas]);

  const surDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const position = Math.round(e.nativeEvent.contentOffset.x / pas);
    if (position !== index) setIndex(position);
  };

  if (diapositives.length === 0) return null;

  return (
    <View style={styles.cadre}>
      <ScrollView
        ref={defilement}
        horizontal
        showsHorizontalScrollIndicator={false}
        // `snapToInterval` plutôt que `pagingEnabled` : les cartes sont plus
        // étroites que l'écran, et la pagination native s'arrêterait au bord de
        // l'écran plutôt qu'au bord de la carte.
        snapToInterval={pas}
        decelerationRate="fast"
        snapToAlignment="start"
        onScroll={surDefilement}
        scrollEventThrottle={32}
        onTouchStart={() => setManuel(true)}
        contentContainerStyle={styles.piste}
      >
        {diapositives.map((d) => (
          <View key={d.cle} style={{ width: largeur }}>
            {d.contenu}
          </View>
        ))}
      </ScrollView>

      {diapositives.length > 1 ? (
        <View style={styles.points}>
          {diapositives.map((d, i) => (
            <Point key={d.cle} actif={i === index} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Point de position. S'allonge quand il est actif, plutôt que de changer de teinte. */
function Point({ actif }: { actif: boolean }) {
  const progression = useRef(new Animated.Value(actif ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progression, {
      toValue: actif ? 1 : 0,
      duration: durees.normale,
      // `useNativeDriver` est impossible ici : la largeur n'est pas une
      // propriété que le fil natif sait animer.
      useNativeDriver: false,
    }).start();
  }, [actif, progression]);

  return (
    <Animated.View
      style={[
        styles.point,
        actif && styles.pointActif,
        {
          width: progression.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 20],
          }),
        },
      ]}
    />
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: { gap: espacements.sm },
  piste: { gap: espacements.sm },
  points: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacements.xxs,
  },
  point: {
    height: 6,
    borderRadius: rayons.rond,
    backgroundColor: colors.bordureNette,
  },
  pointActif: { backgroundColor: colors.accent },
}));

/** Petite carte de contenu, commune aux diapositives autres que le compteur. */
export function DiapoSimple({
  surtitre,
  titre,
  detail,
}: {
  surtitre: string;
  titre: string;
  detail?: string;
}) {
  return (
    <View style={styles.cadre}>
      <Texte variante="surtitre">{surtitre}</Texte>
      <Texte variante="titre">{titre}</Texte>
      {detail ? <Texte variante="corpsDoux">{detail}</Texte> : null}
    </View>
  );
}
