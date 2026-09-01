/**
 * Pôle ② — Parcours guidé du couple (§8.7 du cahier).
 *
 * ## Le créneau visé
 *
 * Le cahier situe ce module entre deux extrêmes : les applications « tout
 * léger » qui posent une question par jour sans jamais aller plus loin, et les
 * applications « tout thérapie » qui demandent une heure et un engagement que
 * personne ne tient un mardi soir. D’où le format retenu : des séances de cinq
 * minutes, en série courte, sur une thématique à la fois.
 *
 * ## Chacun d’abord, ensemble ensuite
 *
 * Chaque séance se fait **séparément** puis se compare. C’est la même règle du
 * miroir que les axes de croissance et les questions de complicité, et pour la
 * même raison : une réponse écrite après avoir lu celle de l’autre n’est plus
 * une réponse. Le modèle applique le masquage ici, une seule fois, pour que le
 * serveur rejoue la règle à l’identique.
 *
 * ## Ce que ce module n’est pas
 *
 * Ce n’est pas un accompagnement professionnel, et le cahier est explicite sur
 * ce point. Les textes ne diagnostiquent rien, ne concluent rien sur le couple,
 * et `AVERTISSEMENT` est affiché par les écrans qui présentent un parcours.
 * Un couple en crise a besoin d’un thérapeute, pas d’une application.
 */

export type ThemeParcours =
  | 'communication'
  | 'conflit'
  | 'argent'
  | 'desir_enfant'
  | 'charge_mentale';

export interface DefinitionThemeParcours {
  code: ThemeParcours;
  libelle: string;
  emoji: string;
}

export const THEMES_PARCOURS: readonly DefinitionThemeParcours[] = [
  { code: 'communication', libelle: 'Se parler', emoji: '💬' },
  { code: 'conflit', libelle: 'Les désaccords', emoji: '🌤️' },
  { code: 'argent', libelle: 'L’argent', emoji: '💶' },
  { code: 'desir_enfant', libelle: 'Désir d’enfant', emoji: '🌱' },
  { code: 'charge_mentale', libelle: 'La charge mentale', emoji: '🧠' },
] as const;

/**
 * Une séance : cinq minutes, deux temps.
 *
 * `chacun` se fait de son côté, `ensemble` est ce qu’on se dit une fois les
 * deux réponses ouvertes. Les deux sont écrits pour être lus tels quels à
 * l’écran, sans reformulation.
 */
export interface Seance {
  id: string;
  titre: string;
  /** Pourquoi cette séance existe. Une phrase, jamais un cours. */
  intention: string;
  /** L’exercice, fait séparément. */
  chacun: string;
  /** Ce qu’on se dit une fois les deux réponses ouvertes. */
  ensemble: string;
}

export interface Parcours {
  id: string;
  theme: ThemeParcours;
  titre: string;
  /** Ce que le parcours propose, sans promesse de résultat. */
  promesse: string;
  seances: readonly Seance[];
}

/**
 * Mention affichée par tout écran présentant un parcours.
 *
 * Exigée par le cahier : « jamais présenté comme un substitut à un
 * accompagnement professionnel en cas de crise ».
 */
export const AVERTISSEMENT =
  'Ces parcours sont des supports de conversation, pas un accompagnement thérapeutique. Si la situation est douloureuse ou bloquée, en parler à un professionnel reste la meilleure chose à faire.';

export const PARCOURS: readonly Parcours[] = [
  {
    id: 'communication-1',
    theme: 'communication',
    titre: 'Se dire les choses plus tôt',
    promesse:
      'Six séances pour repérer ce qu’on garde pour soi, et trouver le moment de le dire avant que ça pèse.',
    seances: [
      {
        id: 'communication-1-s1',
        titre: 'Ce que je garde pour moi',
        intention:
          'Commencer par le constat, sans encore chercher à le résoudre.',
        chacun:
          'Une chose que vous n’avez pas dite ces dernières semaines, et qui vous est restée. Écrivez-la simplement, sans l’expliquer ni la justifier.',
        ensemble:
          'Lisez-vous vos deux réponses à voix haute. Aucune réaction n’est attendue ce soir — juste les entendre.',
      },
      {
        id: 'communication-1-s2',
        titre: 'Ce qui m’a retenu',
        intention:
          'Le silence a presque toujours une raison. La nommer la rend discutable.',
        chacun:
          'Qu’est-ce qui vous a retenu de le dire ? La fatigue, le moment, la crainte de la réaction, l’impression que ce n’était pas assez important ?',
        ensemble:
          'Comparez : est-ce la même raison chez vous deux ? C’est souvent le cas, et c’est une bonne nouvelle — ça se travaille à deux.',
      },
      {
        id: 'communication-1-s3',
        titre: 'Le bon moment',
        intention:
          'Un sujet difficile lancé au mauvais moment devient une dispute.',
        chacun:
          'À quel moment de la journée êtes-vous le plus disponible pour une conversation qui compte ? Et à quel moment ne l’êtes-vous pas du tout ?',
        ensemble:
          'Cherchez un créneau qui convient aux deux. Un seul suffit. Notez-le.',
      },
      {
        id: 'communication-1-s4',
        titre: 'Dire sans accuser',
        intention:
          'La même chose se dit de deux façons : l’une ouvre, l’autre ferme.',
        chacun:
          'Reprenez ce que vous avez écrit à la première séance. Réécrivez-le en commençant par « je » et en décrivant ce que vous avez ressenti, pas ce que l’autre a fait.',
        ensemble:
          'Lisez la version réécrite. Demandez à l’autre comment il l’a reçue, cette fois.',
      },
      {
        id: 'communication-1-s5',
        titre: 'Écouter jusqu’au bout',
        intention:
          'On répond souvent à la première phrase, sans attendre la dernière.',
        chacun:
          'Une fois où vous avez eu l’impression de ne pas être écouté jusqu’au bout. Que vouliez-vous dire, que vous n’avez pas pu finir ?',
        ensemble:
          'Chacun raconte, l’autre ne répond rien avant la fin. Puis reformulez ce que vous avez compris, avant de donner votre avis.',
      },
      {
        id: 'communication-1-s6',
        titre: 'Ce qu’on garde',
        intention: 'Fixer une seule habitude, pas dix bonnes résolutions.',
        chacun:
          'De ces cinq séances, qu’est-ce que vous voudriez garder concrètement ? Une seule chose.',
        ensemble:
          'Mettez-vous d’accord sur une habitude commune. Vous pouvez en faire un axe de croissance pour la suivre dans la durée.',
      },
    ],
  },
  {
    id: 'conflit-1',
    theme: 'conflit',
    titre: 'Se disputer sans se blesser',
    promesse:
      'Cinq séances pour comprendre comment vos désaccords s’enclenchent, et où ils dérapent.',
    seances: [
      {
        id: 'conflit-1-s1',
        titre: 'Notre dispute la plus fréquente',
        intention:
          'La plupart des couples rejouent trois ou quatre disputes. Les nommer, c’est déjà en sortir un peu.',
        chacun:
          'Quel désaccord revient le plus souvent chez vous ? Décrivez-le en deux phrases, sans dire qui a raison.',
        ensemble:
          'Comparez vos deux descriptions. Décrivent-elles la même dispute ? La différence, s’il y en a une, est le vrai sujet.',
      },
      {
        id: 'conflit-1-s2',
        titre: 'Le moment où ça bascule',
        intention:
          'Un désaccord et une dispute sont deux choses distinctes. Entre les deux, il y a un instant précis.',
        chacun:
          'À quel moment une discussion cesse d’être une discussion, pour vous ? Un mot, un ton, un geste, un silence ?',
        ensemble:
          'Dites-vous ce qui fait basculer l’autre. C’est une information, pas un reproche.',
      },
      {
        id: 'conflit-1-s3',
        titre: 'Ce dont j’ai besoin quand ça monte',
        intention:
          'L’un a besoin de continuer à parler, l’autre de s’arrêter. Ce n’est pas de l’indifférence.',
        chacun:
          'Quand la tension monte, de quoi avez-vous besoin ? Qu’on continue, qu’on fasse une pause, qu’on vous prenne dans les bras, qu’on vous laisse seul un moment ?',
        ensemble:
          'Vos besoins sont peut-être opposés. Convenez d’un signal simple pour demander une pause, que l’autre s’engage à respecter sans le prendre pour un abandon.',
      },
      {
        id: 'conflit-1-s4',
        titre: 'La réparation',
        intention:
          'Ce qui compte n’est pas de ne jamais se disputer, mais de revenir.',
        chacun:
          'Après une dispute, qu’est-ce qui vous permet de revenir ? Des excuses, un geste, du temps, qu’on en reparle, qu’on n’en reparle pas ?',
        ensemble:
          'Comparez. Beaucoup de rancunes viennent d’une réparation faite dans la langue de l’autre, pas dans la sienne.',
      },
      {
        id: 'conflit-1-s5',
        titre: 'Notre règle à nous',
        intention:
          'Une seule règle, décidée à froid, tient mieux que dix promesses à chaud.',
        chacun:
          'Quelle règle aimeriez-vous que vous respectiez tous les deux, pendant un désaccord ?',
        ensemble:
          'Choisissez-en une, commune, et écrivez-la. Vous pourrez y revenir la prochaine fois.',
      },
    ],
  },
  {
    id: 'argent-1',
    theme: 'argent',
    titre: 'Parler d’argent sans tension',
    promesse:
      'Cinq séances pour comprendre ce que l’argent représente pour chacun, avant de parler de chiffres.',
    seances: [
      {
        id: 'argent-1-s1',
        titre: 'L’argent chez moi, enfant',
        intention:
          'Le rapport à l’argent se forme tôt et s’explique rarement. Il se raconte.',
        chacun:
          'Comment parlait-on d’argent dans votre famille ? En parlait-on seulement ? Était-ce une source d’inquiétude, de fierté, de silence ?',
        ensemble:
          'Racontez-vous vos deux histoires. Beaucoup de désaccords d’adultes commencent là.',
      },
      {
        id: 'argent-1-s2',
        titre: 'Sécurité ou plaisir',
        intention:
          'Épargner et dépenser ne sont pas des qualités et des défauts, mais deux façons de se rassurer.',
        chacun:
          'Qu’est-ce qui vous rassure le plus : de l’argent mis de côté, ou de l’argent qui sert à vivre maintenant ? Sans chercher la bonne réponse.',
        ensemble:
          'Si vous êtes différents, c’est fréquent, et souvent complémentaire. Nommez ce que l’équilibre de l’autre vous apporte.',
      },
      {
        id: 'argent-1-s3',
        titre: 'Ce qui me gêne, sans oser le dire',
        intention:
          'Les dépenses de l’autre sont le sujet le plus souvent tu dans les couples.',
        chacun:
          'Une dépense, une habitude ou un déséquilibre qui vous gêne. Décrivez la gêne, pas la personne.',
        ensemble:
          'Écoutez-vous sans vous justifier tout de suite. Justifier avant d’avoir entendu ferme la conversation.',
      },
      {
        id: 'argent-1-s4',
        titre: 'Ce qu’on partage, ce qu’on garde',
        intention: 'Un partage clair vaut mieux qu’un partage implicite.',
        chacun:
          'Qu’est-ce qui devrait être commun selon vous, et qu’est-ce qui devrait rester à chacun sans avoir à se justifier ?',
        ensemble:
          'Comparez, et posez une règle simple. Le module Finances peut ensuite porter la répartition que vous choisissez.',
      },
      {
        id: 'argent-1-s5',
        titre: 'Un projet chiffré',
        intention: 'Passer de la théorie à une décision concrète.',
        chacun:
          'Un projet à deux qui coûte de l’argent, et que vous aimeriez faire dans l’année.',
        ensemble:
          'Si vos deux réponses se rejoignent, ouvrez-le comme projet de couple, avec un montant et une échéance.',
      },
    ],
  },
  {
    id: 'desir-enfant-1',
    theme: 'desir_enfant',
    titre: 'En parler avant de décider',
    promesse:
      'Six séances pour poser la question à deux, sans que l’un porte seul le sujet.',
    seances: [
      {
        id: 'desir-enfant-1-s1',
        titre: 'Où j’en suis, aujourd’hui',
        intention:
          'Le sujet se pose souvent par allusions. Ici, chacun le dit une fois clairement.',
        chacun:
          'Où en êtes-vous, aujourd’hui, de l’envie d’un enfant ? Sans engager la suite, et sans avoir à être sûr.',
        ensemble:
          'Lisez-vous. Ne décidez rien ce soir : le but est que les deux positions soient dites.',
      },
      {
        id: 'desir-enfant-1-s2',
        titre: 'Ce qui m’attire',
        intention:
          'Nommer l’envie avant les craintes, pour ne pas parler que d’obstacles.',
        chacun:
          'Qu’est-ce qui vous attire dans l’idée de fonder une famille avec l’autre ?',
        ensemble:
          'Écoutez ce que l’autre attend. Ce n’est pas forcément la même chose que vous.',
      },
      {
        id: 'desir-enfant-1-s3',
        titre: 'Ce qui m’inquiète',
        intention:
          'Les craintes tues deviennent des reports répétés, sans explication.',
        chacun:
          'Qu’est-ce qui vous inquiète ? Le travail, l’argent, le corps, le couple, votre propre enfance, autre chose ?',
        ensemble:
          'Aucune inquiétude ne se réfute. Elles s’écoutent, et certaines se règlent à deux.',
      },
      {
        id: 'desir-enfant-1-s4',
        titre: 'Le calendrier',
        intention:
          'Le désaccord porte plus souvent sur le moment que sur le principe.',
        chacun:
          'Si c’était oui, ce serait quand ? Dans un an, dans trois, « quand ce sera possible » ?',
        ensemble:
          'Comparez les deux horizons. Un écart se discute mieux qu’il ne se devine.',
      },
      {
        id: 'desir-enfant-1-s5',
        titre: 'Comment on s’organiserait',
        intention:
          'La répartition se décide mieux avant qu’après, quand la fatigue décide à votre place.',
        chacun:
          'Concrètement, comment imaginez-vous la première année ? Qui s’arrête, qui s’adapte, qui aide ?',
        ensemble:
          'Repérez les points qui ne sont pas encore réglés. C’est normal — l’intérêt est de savoir lesquels.',
      },
      {
        id: 'desir-enfant-1-s6',
        titre: 'Notre prochaine étape',
        intention: 'Terminer sur une action, pas sur une conclusion.',
        chacun:
          'Quelle serait la prochaine étape raisonnable, quelle que soit votre position ?',
        ensemble:
          'Choisissez-en une seule, et fixez quand vous en reparlerez. Le module Cycle propose un mode « désir d’enfant » si vous décidez d’avancer.',
      },
    ],
  },
  {
    id: 'charge-mentale-1',
    theme: 'charge_mentale',
    titre: 'Rendre visible ce qui ne se voit pas',
    promesse:
      'Cinq séances pour faire apparaître le travail d’organisation invisible, et le répartir.',
    seances: [
      {
        id: 'charge-mentale-1-s1',
        titre: 'Ce à quoi je pense',
        intention:
          'La charge mentale n’est pas la tâche, c’est le fait d’y penser en premier.',
        chacun:
          'Listez cinq choses auxquelles vous pensez régulièrement pour que la maison, les proches ou le quotidien tiennent. Pas les tâches faites : celles auxquelles il faut penser.',
        ensemble:
          'Mettez vos deux listes côte à côte. La longueur compte moins que la nature de ce qui s’y trouve.',
      },
      {
        id: 'charge-mentale-1-s2',
        titre: 'Qui y pense en premier',
        intention:
          'Une tâche partagée à parts égales peut rester entièrement portée par un seul.',
        chacun:
          'Pour chaque élément de votre liste : qui y pense en premier, chez vous ? Et qui l’exécute ?',
        ensemble:
          'Cherchez les cas où l’un pense et l’autre exécute. Ce sont ceux qui fatiguent le plus.',
      },
      {
        id: 'charge-mentale-1-s3',
        titre: 'Ce que ça me fait',
        intention: 'Passer de l’organisation au ressenti, une fois seulement.',
        chacun:
          'Comment vous sentez-vous face à cette répartition ? Sans chiffrer, sans comparer.',
        ensemble:
          'Écoutez sans corriger. Le ressenti ne se discute pas, il s’entend.',
      },
      {
        id: 'charge-mentale-1-s4',
        titre: 'Transférer, vraiment',
        intention:
          'Transférer une tâche sans transférer la responsabilité ne soulage personne.',
        chacun:
          'Un domaine que vous pourriez prendre entièrement — décision comprise, sans qu’on ait à vous le rappeler.',
        ensemble:
          'Choisissez-en un chacun. Entier : celui qui le prend décide aussi comment le faire.',
      },
      {
        id: 'charge-mentale-1-s5',
        titre: 'Le point mensuel',
        intention:
          'Ce qui n’est pas revu régulièrement revient à l’ancien équilibre.',
        chacun:
          'À quelle fréquence accepteriez-vous de refaire ce point, honnêtement ?',
        ensemble:
          'Fixez une date dans le calendrier partagé. Un rendez-vous court, tenu, vaut mieux qu’un long jamais pris.',
      },
    ],
  },
] as const;

export function parcoursParId(id: string): Parcours | undefined {
  return PARCOURS.find((p) => p.id === id);
}

export function seanceParId(
  parcours: Parcours,
  seanceId: string,
): Seance | undefined {
  return parcours.seances.find((s) => s.id === seanceId);
}

export function definitionThemeParcours(
  code: ThemeParcours,
): DefinitionThemeParcours {
  const trouve = THEMES_PARCOURS.find((t) => t.code === code);
  if (!trouve) throw new Error(`Thème de parcours inconnu : ${code}`);
  return trouve;
}
