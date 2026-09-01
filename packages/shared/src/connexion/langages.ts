/**
 * Pôle ④ — Complicité & connexion : langages de l’amour (§8.14).
 *
 * « Questionnaire de langages de l’amour et de préférences relationnelles,
 * dont les résultats sont partagés et discutés en couple. »
 *
 * ## Ce que ce questionnaire est, et n’est pas
 *
 * C’est une préférence déclarée, pas une mesure. Personne n’est « un type ».
 * Les textes disent donc « ce qui vous touche le plus », jamais « vous êtes ».
 * La différence n’est pas cosmétique : un résultat présenté comme une nature
 * devient une excuse (« je suis comme ça »), un résultat présenté comme une
 * préférence reste discutable, et c’est tout l’intérêt du module.
 *
 * ## Le choix forcé, et pourquoi
 *
 * On ne note pas cinq propositions de 1 à 5 : tout le monde répond « c’est
 * important » à tout. Chaque question oppose deux formulations, ce qui force
 * un arbitrage et fait ressortir un ordre. C’est le format classique de ce
 * type de questionnaire, et la seule chose qui le rende exploitable.
 *
 * ## Le miroir, comme partout
 *
 * Le résultat de l’autre ne s’ouvre qu’une fois les deux questionnaires
 * terminés. Connaître ses réponses en répondant orienterait les siennes —
 * vers l’accord, ou vers le contraire, mais jamais vers le vrai.
 */

import type { PartenaireId } from '../types/couple';

export type LangageAmour =
  /** Ce qui se dit : compliments, encouragements, gratitude formulée. */
  | 'paroles'
  /** Le temps donné, sans écran ni autre chose en parallèle. */
  | 'moments'
  /** Ce qui se fait : prendre en charge, soulager, régler. */
  | 'services'
  /** Les petites attentions matérielles, quelle que soit leur valeur. */
  | 'attentions'
  /** Le contact : main, épaule, présence physique. */
  | 'contact';

export interface DefinitionLangage {
  code: LangageAmour;
  libelle: string;
  emoji: string;
  /** Ce que la personne reçoit le mieux. Jamais « ce qu’elle est ». */
  description: string;
  /** Ce que l’autre peut en faire, concrètement. */
  pistePourLautre: string;
}

export const LANGAGES: readonly DefinitionLangage[] = [
  {
    code: 'paroles',
    libelle: 'Les mots',
    emoji: '💬',
    description:
      'Ce qui se dit vous touche plus que ce qui se fait. Un compliment reste, un reproche aussi.',
    pistePourLautre:
      'Dites-lui ce que vous appréciez, à voix haute, même quand ça vous semble évident.',
  },
  {
    code: 'moments',
    libelle: 'Le temps',
    emoji: '⏳',
    description:
      'Ce qui compte est le temps donné pour de vrai : sans écran, sans autre chose en même temps.',
    pistePourLautre:
      'Un moment court et entier vaut mieux qu’une soirée entière à moitié présente.',
  },
  {
    code: 'services',
    libelle: 'Les gestes utiles',
    emoji: '🤲',
    description:
      'Vous vous sentez aimé quand on vous soulage : une tâche prise, un problème réglé sans le demander.',
    pistePourLautre:
      'Faites la chose avant qu’elle soit demandée. Le fait qu’elle n’ait pas eu à la demander est le cadeau.',
  },
  {
    code: 'attentions',
    libelle: 'Les attentions',
    emoji: '🎁',
    description:
      'Un objet rapporté, même minuscule, vous dit qu’on a pensé à vous en votre absence.',
    pistePourLautre:
      'La valeur ne compte pas. Ce qui compte est la preuve que vous y avez pensé.',
  },
  {
    code: 'contact',
    libelle: 'Le contact',
    emoji: '🫂',
    description:
      'Une main, une épaule, une présence physique vous rassurent plus que n’importe quelle phrase.',
    pistePourLautre:
      'Un geste bref et gratuit, hors des moments d’intimité, compte souvent le plus.',
  },
] as const;

export function definitionLangage(code: LangageAmour): DefinitionLangage {
  const trouve = LANGAGES.find((l) => l.code === code);
  if (!trouve) throw new Error(`Langage inconnu : ${code}`);
  return trouve;
}

export interface PropositionLangage {
  texte: string;
  langage: LangageAmour;
}

export interface QuestionLangage {
  id: string;
  a: PropositionLangage;
  b: PropositionLangage;
}

/**
 * Quinze questions, chaque paire de langages opposée une fois exactement.
 *
 * Cinq langages donnent dix paires ; on en pose quinze pour que les
 * comparaisons les plus discriminantes reviennent, sans que le questionnaire
 * devienne long au point qu’on l’abandonne au milieu.
 */
export const QUESTIONS_LANGAGES: readonly QuestionLangage[] = [
  {
    id: 'l01',
    a: { texte: 'Qu’on me dise ce qu’on apprécie chez moi', langage: 'paroles' },
    b: { texte: 'Qu’on me consacre une soirée entière', langage: 'moments' },
  },
  {
    id: 'l02',
    a: { texte: 'Qu’on s’occupe d’une corvée à ma place', langage: 'services' },
    b: { texte: 'Qu’on me rapporte quelque chose en pensant à moi', langage: 'attentions' },
  },
  {
    id: 'l03',
    a: { texte: 'Qu’on me prenne dans les bras sans raison', langage: 'contact' },
    b: { texte: 'Qu’on me dise merci pour ce que j’ai fait', langage: 'paroles' },
  },
  {
    id: 'l04',
    a: { texte: 'Une promenade à deux, sans téléphone', langage: 'moments' },
    b: { texte: 'Qu’on règle un problème qui me pesait', langage: 'services' },
  },
  {
    id: 'l05',
    a: { texte: 'Un petit cadeau inattendu', langage: 'attentions' },
    b: { texte: 'Qu’on me tienne la main en marchant', langage: 'contact' },
  },
  {
    id: 'l06',
    a: { texte: 'Qu’on me dise qu’on est fier de moi', langage: 'paroles' },
    b: { texte: 'Qu’on prenne en charge quelque chose sans que je demande', langage: 'services' },
  },
  {
    id: 'l07',
    a: { texte: 'Une soirée à deux, sans écran', langage: 'moments' },
    b: { texte: 'Qu’on me rapporte ce que j’aime du marché', langage: 'attentions' },
  },
  {
    id: 'l08',
    a: { texte: 'Qu’on s’assoie contre moi', langage: 'contact' },
    b: { texte: 'Qu’on me libère d’une tâche', langage: 'services' },
  },
  {
    id: 'l09',
    a: { texte: 'Qu’on m’écrive un mot doux', langage: 'paroles' },
    b: { texte: 'Un objet choisi pour moi, même minuscule', langage: 'attentions' },
  },
  {
    id: 'l10',
    a: { texte: 'Du temps ensemble, sans rien d’autre à faire', langage: 'moments' },
    b: { texte: 'Un geste affectueux au passage', langage: 'contact' },
  },
  {
    id: 'l11',
    a: { texte: 'Qu’on remarque à voix haute un effort que j’ai fait', langage: 'paroles' },
    b: { texte: 'Qu’on me garde une place contre soi', langage: 'contact' },
  },
  {
    id: 'l12',
    a: { texte: 'Qu’on m’écoute vraiment, longtemps', langage: 'moments' },
    b: { texte: 'Qu’on me dise que je compte', langage: 'paroles' },
  },
  {
    id: 'l13',
    a: { texte: 'Qu’on anticipe ce dont j’ai besoin', langage: 'services' },
    b: { texte: 'Qu’on m’enlace en rentrant', langage: 'contact' },
  },
  {
    id: 'l14',
    a: { texte: 'Une attention rapportée d’un déplacement', langage: 'attentions' },
    b: { texte: 'Un moment prévu rien que pour nous', langage: 'moments' },
  },
  {
    id: 'l15',
    a: { texte: 'Qu’on répare ce qui me compliquait la vie', langage: 'services' },
    b: { texte: 'Un mot laissé quelque part', langage: 'attentions' },
  },
] as const;

/** Un choix : `'a'` ou `'b'`, par identifiant de question. */
export type Choix = Readonly<Record<string, 'a' | 'b'>>;

export type Scores = Readonly<Record<LangageAmour, number>>;

export interface ResultatLangages {
  scores: Scores;
  /** Du plus au moins choisi. Départage stable, pour que l’ordre ne bouge pas. */
  ordre: readonly LangageAmour[];
  dominant: LangageAmour;
  /** Nombre de questions réellement répondues. */
  repondues: number;
}

const VIDE: Scores = {
  paroles: 0,
  moments: 0,
  services: 0,
  attentions: 0,
  contact: 0,
};

/** L’ordre du catalogue départage les égalités, pour que le résultat soit stable. */
const RANG = new Map(LANGAGES.map((l, i) => [l.code, i]));

export function questionnaireComplet(choix: Choix): boolean {
  return QUESTIONS_LANGAGES.every((q) => choix[q.id] === 'a' || choix[q.id] === 'b');
}

/**
 * Dépouille les choix.
 *
 * Tolère un questionnaire partiel : on rend un résultat sur ce qui a été
 * répondu plutôt que d’échouer. `repondues` dit alors sur quoi il repose, et
 * c’est à l’appelant de décider s’il l’affiche.
 */
export function depouiller(choix: Choix): ResultatLangages {
  const scores: Record<LangageAmour, number> = { ...VIDE };
  let repondues = 0;

  for (const question of QUESTIONS_LANGAGES) {
    const reponse = choix[question.id];
    if (reponse !== 'a' && reponse !== 'b') continue;
    repondues += 1;
    scores[question[reponse].langage] += 1;
  }

  const ordre = LANGAGES.map((l) => l.code).sort((x, y) => {
    const ecart = scores[y] - scores[x];
    return ecart !== 0 ? ecart : RANG.get(x)! - RANG.get(y)!;
  });

  return { scores, ordre, dominant: ordre[0]!, repondues };
}

export interface ReponsesLangages {
  partenaireId: PartenaireId;
  choix: Choix;
  majLe: string;
}

export type EtatLangages =
  | 'personne'
  | 'moi_seul'
  | 'lui_seul'
  | 'les_deux';

export interface VueLangages {
  etat: EtatLangages;
  /** Le mien, dès qu’il est complet : c’est le mien. */
  mien?: ResultatLangages;
  /** Celui de l’autre, **seulement** une fois les deux terminés. */
  sien?: ResultatLangages;
  /** Ce que chacun peut faire de l’autre. Vide tant que les deux ne sont pas là. */
  pistes: readonly string[];
  lecture: string;
}

/**
 * Ce qu’une personne voit des deux résultats.
 *
 * Le filtrage vit ici, dans le modèle partagé, pour que le serveur applique la
 * même règle et qu’aucun écran n’ait à se souvenir de masquer quoi que ce soit.
 */
export function vueLangages(
  reponses: readonly ReponsesLangages[],
  moiId: PartenaireId,
): VueLangages {
  const brutMien = reponses.find((r) => r.partenaireId === moiId);
  const brutSien = reponses.find((r) => r.partenaireId !== moiId);

  const mienComplet = brutMien && questionnaireComplet(brutMien.choix);
  const sienComplet = brutSien && questionnaireComplet(brutSien.choix);

  if (mienComplet && sienComplet) {
    const mien = depouiller(brutMien.choix);
    const sien = depouiller(brutSien.choix);
    return {
      etat: 'les_deux',
      mien,
      sien,
      // La piste porte sur ce que *l'autre* reçoit : c'est ce qui rend le
      // résultat utile plutôt que simplement descriptif.
      pistes: [definitionLangage(sien.dominant).pistePourLautre],
      lecture:
        'Vos deux résultats sont ouverts. Ils se discutent — ils ne se concluent pas.',
    };
  }
  if (mienComplet) {
    return {
      etat: 'moi_seul',
      mien: depouiller(brutMien.choix),
      pistes: [],
      lecture:
        'Votre résultat est gardé. Il s’ouvrira quand l’autre aura répondu de son côté.',
    };
  }
  if (sienComplet) {
    return {
      etat: 'lui_seul',
      // Volontairement absent : le connaître en répondant orienterait les
      // réponses, vers l'accord ou vers le contraire, jamais vers le vrai.
      pistes: [],
      lecture:
        'Un résultat vous attend. Il s’ouvrira quand vous aurez fait le vôtre.',
    };
  }
  return {
    etat: 'personne',
    pistes: [],
    lecture: `${QUESTIONS_LANGAGES.length} questions, deux minutes. Chacun de son côté.`,
  };
}
