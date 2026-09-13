import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  BLEU_DROITE,
  BLEU_GAUCHE,
  JOINTURE,
  OR_JOINTURE,
  OR_JOINTURE_SOMBRE,
  SCEAU_DROITE,
  SCEAU_GAUCHE,
} from './traces';

interface Props {
  taille?: number;
  /** Vrai sur fond sombre : l'or s'éclaircit, sans quoi il vire au gris. */
  surFondSombre?: boolean;
  /** Appelé quand les deux moitiés se touchent : la marque est lisible. */
  onRencontre?: () => void;
  /** Appelé quand tout est fini, l'or scellé compris. */
  onFini?: () => void;
}

/**
 * Durées du rapprochement et de la venue de l'or.
 *
 * Une première version tenait en huit dixièmes de seconde : trop vif, on n'avait
 * pas le temps de voir les deux moitiés arriver — donc pas le temps de
 * comprendre d'où vient le cœur, qui est tout le propos. Une deuxième à une
 * seconde et demie restait pressée. Le rapprochement prend maintenant 1,7 s,
 * et l'or 0,9 s de plus : on voit les moitiés venir, se toucher, puis la
 * jointure se sceller.
 *
 * L'or démarre avant que les moitiés se touchent : les phases se recouvrent
 * plutôt que de s'enchaîner bout à bout, ce qui garde l'ouverture sous deux
 * secondes et demie malgré son nouveau tempo.
 */
const RENCONTRE_MS = 1700;
const OR_MS = 900;
const OR_AVANCE_MS = 300;

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
export function MarqueAnimee({
  taille = 108,
  surFondSombre = false,
  onRencontre,
  onFini,
}: Props) {

  const ecart = taille * 0.34;
  const gauche = useRef(new Animated.Value(-ecart)).current;
  const droite = useRef(new Animated.Value(ecart)).current;
  const or = useRef(new Animated.Value(0)).current;
  const pose = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
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
        duration: RENCONTRE_MS + 320,
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

    // Deux rendez-vous distincts : la rencontre, où la marque devient lisible
    // et où le nom peut s'inscrire ; et la fin, l'or scellé, à partir de
    // laquelle seulement il est temps de compter le repos. Les confondre
    // faisait commencer le repos six dixièmes de seconde avant que l'or ait
    // fini de venir — la marque entière ne tenait l'écran qu'un instant.
    rencontre.start(({ finished }) => {
      if (finished) onRencontre?.();
    });
    finition.start(({ finished }) => {
      if (finished) onFini?.();
    });

    // Certains désactivent les animations au niveau du système — par confort
    // visuel ou par sensibilité au mouvement. On respecte le réglage, mais
    // sans **attendre** sa réponse pour peindre : la version précédente ne
    // rendait qu'une vue vide tant qu'elle n'était pas arrivée, et cette
    // requête native est lente au démarrage à froid, précisément au moment où
    // l'on regarde l'écran. C'était là le trou avant l'animation.
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduit) => {
        if (!vivant || !reduit) return;
        rencontre.stop();
        finition.stop();
        gauche.setValue(0);
        droite.setValue(0);
        or.setValue(1);
        pose.setValue(1);
        onRencontre?.();
        onFini?.();
      })
      .catch(() => undefined);

    return () => {
      vivant = false;
      rencontre.stop();
      finition.stop();
    };
  }, [gauche, droite, or, pose, onRencontre, onFini]);

  // Le cadre est assez large pour contenir tout le déplacement : les moitiés
  // partent de ses bords au lieu d'en déborder. Android rogne les enfants qui
  // dépassent de leur parent dans des cas mal définis, et une moitié tronquée
  // au premier écran de l'application se verrait tout de suite.
  const largeur = taille + 2 * ecart;

  const couche = {
    position: 'absolute' as const,
    left: ecart,
    top: 0,
    width: taille,
    height: taille,
  };

  return (
    <Animated.View
      style={{ width: largeur, height: taille, transform: [{ scale: pose }] }}
      accessibilityRole="image"
      accessibilityLabel="LONLONBENU"
    >
      <Animated.View style={[couche, { transform: [{ translateX: gauche }] }]}>
        <Moitie taille={taille} cote="gauche" />
      </Animated.View>

      <Animated.View style={[couche, { transform: [{ translateX: droite }] }]}>
        <Moitie taille={taille} cote="droite" />
      </Animated.View>

      <Animated.View style={[couche, { opacity: or }]} pointerEvents="none">
        <Jointure taille={taille} surFondSombre={surFondSombre} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Une moitié du sceau, sa part de creux déjà retirée.
 *
 * Le tracé arrive découpé du générateur, dans le repère plein de 100 × 100 : il
 * suffit de le déplacer. La première version dessinait le sceau entier dans une
 * fenêtre qui le rognait — ce qui marchait, mais demandait un `overflow` caché
 * par moitié, là où Android rogne déjà les enfants débordants de son propre
 * chef. Moins de couches, moins de façons que cela tourne mal.
 *
 * Le creux est retiré par « pair-impair » : le même tracé porte le contour et
 * son vide, ils ne peuvent pas se désaligner.
 */
function Moitie({ taille, cote }: { taille: number; cote: 'gauche' | 'droite' }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Path
        d={cote === 'gauche' ? SCEAU_GAUCHE : SCEAU_DROITE}
        fillRule="evenodd"
        fill={cote === 'gauche' ? BLEU_GAUCHE : BLEU_DROITE}
      />
    </Svg>
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
function Jointure({
  taille,
  surFondSombre,
}: {
  taille: number;
  surFondSombre: boolean;
}) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Path d={JOINTURE} fill={surFondSombre ? OR_JOINTURE_SOMBRE : OR_JOINTURE} />
    </Svg>
  );
}
