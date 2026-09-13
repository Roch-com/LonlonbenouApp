import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import {
  BLEU_DROITE,
  BLEU_GAUCHE,
  IVOIRE,
  JOINTURE,
  MONO_DROITE,
  MONO_GAUCHE,
  OR_JOINTURE,
  OR_JOINTURE_SOMBRE,
  SCEAU_DROITE,
  SCEAU_GAUCHE,
} from './traces';

/**
 * Les déclinaisons du sceau.
 *
 * - `couleur` — la marque complète : deux bleus, la jointure d'or, le creux.
 *   Partout où la couleur passe et où la marque a la place de se tenir.
 * - `monochrome` — une seule matière ; le creux **et** la jointure restent des
 *   vides. Pour la notification Android, un tampon, une gravure, ou la marque
 *   posée en filigrane sur une photographie. C'est aussi la seule qui survive
 *   à une télécopie ou à une sérigraphie une couleur.
 * - `inverse` — le sceau en ivoire sur un aplat bleu. Quand la marque doit se
 *   détacher d'un fond chargé sans qu'on puisse compter sur son contraste.
 */
export type TonMarque = 'couleur' | 'monochrome' | 'inverse';

interface SceauProps {
  taille: number;
  ton?: TonMarque;
  /** Vrai sur fond sombre : l'or s'éclaircit, sans quoi il vire au gris. */
  surFondSombre?: boolean;
  /** La matière du monochrome. Par défaut celle du thème appelant. */
  couleur?: string;
}

/**
 * Le sceau seul, sans le nom.
 *
 * Chaque moitié est un tracé complet, le creux déjà retiré : rien n'est rogné,
 * rien n'est masqué. Les deux se posent côte à côte dans le même repère de
 * 100 × 100, et c'est leur bord commun qui dessine la jointure.
 */
export function Sceau({
  taille,
  ton = 'couleur',
  surFondSombre = false,
  couleur,
}: SceauProps) {
  if (ton === 'monochrome') {
    const matiere = couleur ?? BLEU_GAUCHE;
    return (
      <Svg width={taille} height={taille} viewBox="0 0 100 100">
        <Path d={MONO_GAUCHE} fillRule="evenodd" fill={matiere} />
        <Path d={MONO_DROITE} fillRule="evenodd" fill={matiere} />
      </Svg>
    );
  }

  const gauche = ton === 'inverse' ? IVOIRE : BLEU_GAUCHE;
  const droite = ton === 'inverse' ? IVOIRE : BLEU_DROITE;
  const or = surFondSombre ? OR_JOINTURE_SOMBRE : OR_JOINTURE;

  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Path d={SCEAU_GAUCHE} fillRule="evenodd" fill={gauche} />
      <Path d={SCEAU_DROITE} fillRule="evenodd" fill={droite} />
      {ton === 'inverse' ? null : <Path d={JOINTURE} fill={or} />}
    </Svg>
  );
}

/**
 * Les assemblages du sceau et du nom.
 *
 * - `empilee` — le sceau au-dessus du nom. Ouverture, écran de verrou, accueil
 *   d'onboarding : partout où la marque est le sujet.
 * - `horizontale` — le sceau à gauche, le nom à sa droite. Pour les bandeaux,
 *   où la hauteur manque.
 * - `seule` — le sceau sans le nom, quand le contexte le dit déjà.
 *
 * La devise n'accompagne que la disposition empilée, et seulement si on la
 * demande : sur un bandeau elle se réduirait à une ligne illisible.
 */
export type DispositionMarque = 'empilee' | 'horizontale' | 'seule';

interface MarqueProps {
  taille: number;
  disposition?: DispositionMarque;
  ton?: TonMarque;
  surFondSombre?: boolean;
  avecDevise?: boolean;
  couleur?: string;
}

export function Marque({
  taille,
  disposition = 'empilee',
  ton = 'couleur',
  surFondSombre = false,
  avecDevise = false,
  couleur,
}: MarqueProps) {
  const sceau = (
    <Sceau taille={taille} ton={ton} surFondSombre={surFondSombre} couleur={couleur} />
  );

  if (disposition === 'seule') return sceau;

  const nom = (
    <Texte variante={disposition === 'horizontale' ? 'surtitre' : 'affiche'}>
      LONLONBENU
    </Texte>
  );

  if (disposition === 'horizontale') {
    return (
      <View style={styles.horizontale}>
        {sceau}
        {nom}
      </View>
    );
  }

  return (
    <View style={styles.empilee}>
      {sceau}
      <View style={styles.legende}>
        {nom}
        {avecDevise ? (
          <Texte variante="petit" style={styles.devise}>
            La chose de l’amour
          </Texte>
        ) : null}
      </View>
    </View>
  );
}

/**
 * L'air minimal autour du sceau, en fraction de son côté.
 *
 * C'est la hauteur du creux — 27,84 unités sur 100 dans le repère du dessin.
 * La règle se retient donc sans rien mesurer : on garde autour de la marque la
 * place d'un deuxième cœur.
 *
 * Un cinquième avait d'abord été écrit, avec la même justification. Le compte
 * n'y était pas : le creux fait plus du quart, pas le cinquième.
 */
export const AIR_MINIMAL = 0.2784;

const styles = {
  empilee: { alignItems: 'center' as const, gap: espacements.md },
  legende: { alignItems: 'center' as const, gap: espacements.xs },
  horizontale: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: espacements.sm,
  },
  devise: { fontStyle: 'italic' as const },
};
