/**
 * Pôle ④ — Complicité & connexion : rituels de reconnexion (§8.14).
 *
 * « Suggestions de rituels de reconnexion (soirées sans écran, gestes
 * d’affection, moments à deux réguliers). »
 *
 * ## Pudique, comme le cahier le demande
 *
 * Le module vise « la proximité physique et émotionnelle », avec un contenu
 * « toujours pudique, orienté sur la communication des besoins ». Aucun rituel
 * ici n’est explicite ; tous se lisent à voix haute sans gêne, y compris par
 * quelqu’un qui n’a pas choisi de les lire.
 *
 * ## Suggéré, jamais assigné
 *
 * Rien n’est coché, rien ne se manque. Un rituel qu’on n’a pas fait ne laisse
 * aucune trace : la première chose qu’une application de couple peut abîmer,
 * c’est de transformer l’affection en devoir qu’on rate.
 */

import { joursEntre } from '../temps/jours';
import type { LangageAmour } from './langages';

export interface Rituel {
  id: string;
  titre: string;
  /** Comment le faire, concrètement. Une phrase, jamais un mode d’emploi. */
  comment: string;
  /** Le langage qu’il nourrit le mieux. Sert à ordonner les suggestions. */
  langage: LangageAmour;
  /** Ordre de grandeur, pour choisir selon la soirée qu’on a devant soi. */
  duree: 'un instant' | 'une heure' | 'une soirée';
}

export const RITUELS: readonly Rituel[] = [
  {
    id: 'r01',
    titre: 'Une soirée sans écran',
    comment:
      'Les deux téléphones dans une autre pièce, du début à la fin. C’est la seule règle.',
    langage: 'moments',
    duree: 'une soirée',
  },
  {
    id: 'r02',
    titre: 'Les six secondes',
    comment:
      'Une étreinte tenue six secondes, pas deux. C’est plus long qu’on croit, et c’est là que ça change.',
    langage: 'contact',
    duree: 'un instant',
  },
  {
    id: 'r03',
    titre: 'Trois questions au dîner',
    comment:
      'Le meilleur moment de ta journée, le plus dur, et ce dont tu as besoin demain.',
    langage: 'moments',
    duree: 'une heure',
  },
  {
    id: 'r04',
    titre: 'Le mot laissé',
    comment:
      'Une phrase sur un papier, quelque part où l’autre le trouvera sans vous.',
    langage: 'paroles',
    duree: 'un instant',
  },
  {
    id: 'r05',
    titre: 'La tâche prise',
    comment:
      'Faites en entier une chose dont l’autre s’occupe d’habitude, sans l’annoncer.',
    langage: 'services',
    duree: 'une heure',
  },
  {
    id: 'r06',
    titre: 'Le café rapporté',
    comment:
      'Quelque chose de minuscule, choisi pour l’autre, ramené sans occasion.',
    langage: 'attentions',
    duree: 'un instant',
  },
  {
    id: 'r07',
    titre: 'Le rendez-vous fixe',
    comment:
      'Un créneau dans la semaine, toujours le même, réservé à vous deux. Court, mais tenu.',
    langage: 'moments',
    duree: 'une soirée',
  },
  {
    id: 'r08',
    titre: 'Merci pour une chose précise',
    comment:
      'Pas « merci pour tout » : une chose, nommée, faite cette semaine.',
    langage: 'paroles',
    duree: 'un instant',
  },
  {
    id: 'r09',
    titre: 'La marche du soir',
    comment: 'Vingt minutes dehors, à deux, sans destination.',
    langage: 'moments',
    duree: 'une heure',
  },
  {
    id: 'r10',
    titre: 'Le geste au passage',
    comment:
      'Une main sur l’épaule en traversant la pièce. Rien de plus, et sans rien attendre.',
    langage: 'contact',
    duree: 'un instant',
  },
  {
    id: 'r11',
    titre: 'Le réveil sans téléphone',
    comment:
      'Dix minutes le matin avant de regarder l’écran. À deux, dans le silence.',
    langage: 'moments',
    duree: 'un instant',
  },
  {
    id: 'r12',
    titre: 'La chose réglée',
    comment:
      'Ce petit problème qui traîne et qui pèse à l’autre : réglez-le, et n’en parlez pas.',
    langage: 'services',
    duree: 'une heure',
  },
  {
    id: 'r13',
    titre: 'Le repas cuisiné ensemble',
    comment: 'À deux dans la cuisine, sans musique de fond ni écran.',
    langage: 'moments',
    duree: 'une soirée',
  },
  {
    id: 'r14',
    titre: 'Ce que j’ai remarqué',
    comment:
      'Dites une chose que l’autre a bien faite et qu’il n’a peut-être pas vue lui-même.',
    langage: 'paroles',
    duree: 'un instant',
  },
] as const;

export function rituelParId(id: string): Rituel | undefined {
  return RITUELS.find((r) => r.id === id);
}

/** Point de départ de la rotation. Une date fixe rend le choix reproductible. */
const ORIGINE = '2026-01-01';

/**
 * Le rituel du jour, le même pour les deux.
 *
 * Dérivé de la date et non tiré au sort : deux téléphones doivent tomber sur
 * le même, sinon chacun proposerait autre chose à l’autre le même soir.
 */
export function rituelDuJour(jour: string): Rituel {
  const index = Math.abs(joursEntre(ORIGINE, jour)) % RITUELS.length;
  return RITUELS[index]!;
}

/**
 * Les rituels remis dans l’ordre de ce qui touche le couple.
 *
 * `langages` est l’ordre de préférence connu — celui de l’autre en premier,
 * puisqu’un rituel se fait *pour* l’autre. Sans lui, on rend le catalogue tel
 * quel : c’est le cas tant que les deux questionnaires ne sont pas faits, et
 * ce n’est pas un état dégradé, juste un catalogue non trié.
 */
export function rituelsSuggeres(
  langages?: readonly LangageAmour[],
  duree?: Rituel['duree'],
): readonly Rituel[] {
  const filtres = duree ? RITUELS.filter((r) => r.duree === duree) : RITUELS;
  if (!langages || langages.length === 0) return filtres;

  const rang = new Map(langages.map((l, i) => [l, i]));
  const apres = langages.length;

  return [...filtres].sort(
    (a, b) => (rang.get(a.langage) ?? apres) - (rang.get(b.langage) ?? apres),
  );
}
