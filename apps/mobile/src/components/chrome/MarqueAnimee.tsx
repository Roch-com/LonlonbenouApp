import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BLEU_DROITE, BLEU_GAUCHE, COEUR, JOINTURE, OR_JOINTURE, SCEAU } from './traces';

interface Props {
  taille?: number;
  /** Appelé une fois le mouvement terminé. */
  onFini?: () => void;
}

/**
 * Durées du rapprochement et de la venue de l'or.
 *
 * L'or démarre un peu avant que les moitiés se touchent : les deux phases se
 * recouvrent, et l'ouverture tient en huit dixièmes de seconde. Les enchaîner
 * bout à bout ajoutait un demi-écran d'attente à chaque lancement — cher payé
 * pour une animation qu'on verra des centaines de fois.
 */
const RENCONTRE_MS = 520;
const OR_MS = 380;
const OR_AVANCE_MS = 120;

/**
 * La marque qui se construit — l'ouverture de l'application.
 *
 * ## Ce que le mouvement raconte
 *
 * Les deux moitiés arrivent de leurs bords opposés et se rejoignent ; **le cœur
 * naît de leur rencontre**, il n'apparaît pas par-dessus. Chaque moitié porte
 * déjà sa part du vide : séparées, ces deux entailles ne ressemblent à rien ;
 * ensemble, elles font un cœur. C'est exactement ce que dit la marque, et une
 * animation qui ferait surgir un cœur tout fait dirait le contraire.
 *
 * Elles avancent à la même vitesse, sur la même durée : aucune ne mène, aucune
 * ne rattrape l'autre. La réciprocité du produit se tient jusque-là.
 *
 * L'or n'entre qu'à la toute fin du rapprochement — il n'a rien à souligner
 * tant que les deux moitiés sont séparées. Les jetons le réservent « aux
 * moments rares » ; le voir venir sceller la jointure, et seulement là, lui
 * garde sa valeur. Il se contente d'apparaître : le faire jaillir du centre
 * aurait demandé de grandir la bande, ce qui aurait entraîné le creux avec elle
 * et laissé l'or déborder dans le cœur le temps du mouvement.
 *
 * ## Pourquoi deux vues plutôt qu'un seul SVG animé
 *
 * Chaque moitié est le sceau entier, décalé, que sa vue parente recadre. Le
 * pilote natif peut alors porter tout le mouvement — `useNativeDriver` n'accepte
 * que l'opacité et les transformations, jamais un attribut SVG. Animer le tracé
 * aurait fait passer chaque image par le fil JavaScript, au pire moment : le
 * démarrage, quand ce fil est déjà occupé à monter l'application.
 */
export function MarqueAnimee({ taille = 108, onFini }: Props) {
  const [sansMouvement, setSansMouvement] = useState<boolean | null>(null);

  const ecart = taille * 0.34;
  const gauche = useRef(new Animated.Value(-ecart)).current;
  const droite = useRef(new Animated.Value(ecart)).current;
  const or = useRef(new Animated.Value(0)).current;
  const pose = useRef(new Animated.Value(0.94)).current;

  // Certains utilisateurs désactivent les animations au niveau du système —
  // par confort visuel ou par sensibilité au mouvement. On respecte le réglage
  // plutôt que de le contourner : la marque s'affiche assemblée, tout de suite.
  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduit) => {
        if (vivant) setSansMouvement(reduit);
      })
      .catch(() => {
        if (vivant) setSansMouvement(false);
      });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (sansMouvement === null) return;

    if (sansMouvement) {
      gauche.setValue(0);
      droite.setValue(0);
      or.setValue(1);
      pose.setValue(1);
      onFini?.();
      return;
    }

    const rapprochement = (valeur: Animated.Value) =>
      Animated.timing(valeur, {
        toValue: 0,
        duration: RENCONTRE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const rencontre = Animated.parallel([rapprochement(gauche), rapprochement(droite)]);
    const finition = Animated.parallel([
      Animated.timing(pose, {
        toValue: 1,
        duration: RENCONTRE_MS + 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(or, {
        toValue: 1,
        delay: RENCONTRE_MS - OR_AVANCE_MS,
        duration: OR_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    finition.start();
    // On prévient dès que les moitiés se touchent : la marque est lisible à cet
    // instant. L'or et le repos du cadre finissent après, sans rien retenir.
    rencontre.start(({ finished }) => {
      if (finished) onFini?.();
    });
    return () => {
      rencontre.stop();
      finition.stop();
    };
  }, [sansMouvement, gauche, droite, or, pose, onFini]);

  // Tant que le réglage système n'a pas répondu, rien n'est peint : une marque
  // affichée assemblée puis redécoupée pour s'animer serait pire que l'attente
  // d'une image.
  // Le cadre est assez large pour contenir tout le déplacement : les moitiés
  // partent de ses bords au lieu d'en déborder. Android rogne les enfants qui
  // dépassent de leur parent dans des cas mal définis, et une moitié tronquée
  // au premier écran de l'application se verrait tout de suite.
  const largeur = taille + 2 * ecart;
  if (sansMouvement === null) return <View style={{ width: largeur, height: taille }} />;

  const fenetre = {
    width: taille / 2,
    height: taille,
    overflow: 'hidden' as const,
    position: 'absolute' as const,
    top: 0,
  };

  return (
    <Animated.View
      style={{ width: largeur, height: taille, transform: [{ scale: pose }] }}
      accessibilityRole="image"
      accessibilityLabel="LONLONBENU"
    >
      <Animated.View
        style={[fenetre, { left: ecart, transform: [{ translateX: gauche }] }]}
      >
        <Moitie taille={taille} cote="gauche" />
      </Animated.View>

      <Animated.View
        style={[
          fenetre,
          { left: ecart + taille / 2, transform: [{ translateX: droite }] },
        ]}
      >
        <Moitie taille={taille} cote="droite" />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          left: ecart,
          top: 0,
          width: taille,
          height: taille,
          opacity: or,
        }}
        pointerEvents="none"
      >
        <Jointure taille={taille} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Une moitié du sceau — le tracé entier, décalé, que la fenêtre parente recadre.
 *
 * Découper la superellipse en deux aurait demandé de recalculer le contour ;
 * décaler puis rogner donne la même image sans toucher au dessin.
 *
 * Le cœur est retiré par `fillRule="evenodd"` : le même tracé sert de contour
 * et de creux, ce qui rend impossible qu'ils se désalignent. Un masque SVG
 * aurait fait la même chose, mais les masques sont ce que `react-native-svg`
 * rend le plus inégalement d'une version d'Android à l'autre.
 */
function Moitie({ taille, cote }: { taille: number; cote: 'gauche' | 'droite' }) {
  return (
    <View style={{ marginLeft: cote === 'gauche' ? 0 : -taille / 2 }}>
      <Svg width={taille} height={taille} viewBox="0 0 100 100">
        <Path
          d={`${SCEAU} ${COEUR}`}
          fillRule="evenodd"
          fill={cote === 'gauche' ? BLEU_GAUCHE : BLEU_DROITE}
        />
      </Svg>
    </View>
  );
}

/**
 * La ligne d'or, interrompue par le creux.
 *
 * Le tracé arrive déjà percé, en deux morceaux : la soustraction est faite dans
 * le générateur. Elle ne pouvait pas l'être ici par « pair-impair » comme pour
 * le sceau — ce mode inverse ce qui est couvert deux fois, et le cœur étant
 * bien plus large que la bande, c'est le cœur entier qui se serait rempli d'or.
 */
function Jointure({ taille }: { taille: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Path d={JOINTURE} fill={OR_JOINTURE} />
    </Svg>
  );
}
