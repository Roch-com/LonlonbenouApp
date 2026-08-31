/**
 * Pôle ② — assistant de reformulation (§8.5 du cahier).
 *
 * « Formulation guidée transformant une critique brute en besoin exprimable. »
 *
 * ## Ce que cet assistant est, et ce qu'il n'est pas
 *
 * Il ne réécrit rien à la place de personne. Il **repère** les tournures qui
 * font qu'une phrase se reçoit comme une accusation, explique en une ligne
 * pourquoi, et propose une manière de dire la même chose sans l'accusation.
 * La personne garde la main : c'est elle qui connaît son couple.
 *
 * Réécrire automatiquement serait pire que ne rien faire. Un axe de croissance
 * est déjà difficile à écrire ; recevoir une version lissée par une machine,
 * que l'autre lirait comme votre phrase, ferait de l'app un ventriloque.
 *
 * ## Pourquoi des règles et non un modèle de langue
 *
 * Ces phrases sont ce qu'un couple a de plus intime. Les envoyer à un service
 * tiers pour les faire reformuler contredirait tout le reste de
 * l'architecture — le chat, les confidences et le cycle sont chiffrés de bout
 * en bout précisément pour que personne d'autre ne les lise.
 *
 * Le prix : l'assistant est grossier. Il attrape les tournures les plus
 * fréquentes et rate le reste. C'est assumé — il vaut mieux un conseil rare et
 * juste qu'un conseil omniprésent et faux.
 */

export type SorteRemarque =
  /** « tu ne fais jamais », « tu es toujours » : l'absolu ferme la discussion. */
  | 'absolu'
  /** Une phrase qui parle de l'autre plutôt que de soi. */
  | 'accusation'
  /** « tu devrais », « il faut que tu » : l'injonction appelle la défense. */
  | 'injonction'
  /** Un jugement sur la personne, pas sur un fait. */
  | 'etiquette';

export interface Remarque {
  sorte: SorteRemarque;
  /** Le passage repéré, tel qu'il apparaît dans le texte. */
  extrait: string;
  /** Pourquoi cette tournure se reçoit mal. Jamais moralisateur. */
  pourquoi: string;
  /** Une manière de dire la même chose. Une piste, pas une correction. */
  piste: string;
}

interface Motif {
  sorte: SorteRemarque;
  expression: RegExp;
  pourquoi: string;
  piste: string;
}

/**
 * Les motifs, volontairement peu nombreux.
 *
 * Chacun correspond à une tournure dont l'effet est documenté en thérapie de
 * couple : l'absolu, le reproche en « tu », l'injonction et l'étiquette. En
 * ajouter davantage produirait des remarques sur des phrases parfaitement
 * dicibles, et l'assistant deviendrait un correcteur tatillon qu'on ignore.
 */
const MOTIFS: readonly Motif[] = [
  {
    sorte: 'absolu',
    expression: /\b(jamais|toujours|tout le temps|à chaque fois)\b/giu,
    pourquoi:
      'Un absolu se réfute par un seul contre-exemple : la discussion glisse sur « ce n’est pas vrai » au lieu de porter sur le fond.',
    piste:
      'Nommer une fois précise : « hier soir », « ces dernières semaines ». C’est plus difficile à balayer, et plus facile à entendre.',
  },
  {
    sorte: 'accusation',
    expression: /\btu (m'|me |te |ne |n')?(fais|laisses|oublies|ignores|dis)\b/giu,
    pourquoi:
      'Une phrase qui commence par « tu » décrit l’autre. Elle appelle une défense avant même d’être finie.',
    piste:
      'Partir de soi : « je me sens… quand… ». Ce n’est pas une politesse, c’est ce qui rend la phrase discutable au lieu de contestable.',
  },
  {
    sorte: 'injonction',
    expression: /\b(tu devrais|il faut que tu|tu dois|arrête de)\b/giu,
    pourquoi:
      'Une consigne place l’autre en exécutant. Même juste, elle se reçoit comme une mise au pas.',
    piste:
      'Formuler un besoin plutôt qu’un ordre : « j’aurais besoin que… », « ça m’aiderait si… ».',
  },
  {
    sorte: 'etiquette',
    expression:
      /\btu es (vraiment )?(égoïste|paresseux|paresseuse|nul|nulle|insupportable|froid|froide|distant|distante)\b/giu,
    pourquoi:
      'Un jugement sur la personne ne laisse rien à changer : on ne cesse pas d’être ce qu’on est parce qu’on nous le reproche.',
    piste:
      'Décrire le geste et son effet : « quand tu … , je me sens … ». Un geste peut changer ; une nature, non.',
  },
];

/**
 * Repère les tournures qui feront mal, sans rien réécrire.
 *
 * Une seule remarque par sorte : signaler cinq fois le même absolu donnerait
 * une liste décourageante là où le point est déjà compris.
 */
export function relire(texte: string): Remarque[] {
  const remarques: Remarque[] = [];

  for (const motif of MOTIFS) {
    // `lastIndex` d'un motif global persiste entre deux appels : sans copie,
    // la deuxième relecture d'un même texte manquerait des passages.
    const expression = new RegExp(motif.expression.source, motif.expression.flags);
    const trouve = expression.exec(texte);
    if (!trouve) continue;

    remarques.push({
      sorte: motif.sorte,
      extrait: trouve[0],
      pourquoi: motif.pourquoi,
      piste: motif.piste,
    });
  }

  return remarques;
}

/**
 * Ce que l'écran affiche quand rien n'est repéré.
 *
 * Pas de félicitations : écrire un axe de croissance n'est pas un exercice
 * qu'on réussit. On dit simplement qu'on n'a rien à ajouter.
 */
export const RIEN_A_SIGNALER =
  'Rien à signaler de ce côté. Cela ne veut pas dire que ce sera facile à entendre — seulement que la formulation ne se met pas en travers.';
