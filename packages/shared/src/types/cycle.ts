/**
 * Pôle ④ — Cycle & fertilité : modèle de données et niveaux de partage.
 *
 * Règle non négociable : le niveau est **contrôlé exclusivement par la personne
 * concernée**. Ce n'est donc pas un consentement réciproque et cela ne passe
 * surtout pas par `basculerConsentement` — un partage mutuel se négocie à deux,
 * celui-ci ne se négocie pas du tout.
 *
 * Conséquence assumée sur les notifications : baisser son niveau **ne prévient
 * pas l'autre**. Annoncer « elle en partage moins » transformerait un droit en
 * dette. En revanche le niveau **courant** est toujours lisible par les deux :
 * personne ne doit croire qu'il voit tout alors qu'il ne voit qu'une partie.
 * On ne cache pas l'état, on ne commente pas les changements.
 */

import type { PartenaireId } from './couple';

export type NiveauCycle = 'aucun' | 'discret' | 'phases' | 'complet';

export interface DefinitionNiveauCycle {
  code: NiveauCycle;
  /** Rang au cahier des charges : 0 = ne rien partager. */
  rang: 0 | 1 | 2 | 3;
  libelle: string;
  /** Ce que l'autre voit, dit sans détour. */
  ceQueLautreVoit: string;
  /** `true` tant que le niveau n'est pas disponible en P0. */
  aVenir?: boolean;
}

export const NIVEAUX_CYCLE: readonly DefinitionNiveauCycle[] = [
  {
    code: 'aucun',
    rang: 0,
    libelle: 'Rien du tout',
    ceQueLautreVoit: 'Rien. Le module reste entièrement privé.',
  },
  {
    code: 'discret',
    rang: 1,
    libelle: 'Discret',
    ceQueLautreVoit:
      'Une indication générale les jours plus sensibles, sans aucun détail ni date.',
  },
  {
    code: 'phases',
    rang: 2,
    libelle: 'Les phases',
    ceQueLautreVoit:
      'La phase en cours du cycle, sans les symptômes ni les notes personnelles.',
  },
  {
    code: 'complet',
    rang: 3,
    libelle: 'Complet',
    ceQueLautreVoit:
      'Le cycle détaillé, la fertilité et les symptômes partagés.',
    aVenir: true,
  },
] as const;

export function definitionNiveauCycle(code: NiveauCycle): DefinitionNiveauCycle {
  const trouve = NIVEAUX_CYCLE.find((n) => n.code === code);
  if (!trouve) throw new Error(`Niveau de cycle inconnu : ${code}`);
  return trouve;
}

/** Niveaux proposables aujourd'hui. Le niveau 3 arrivera avec le module complet. */
export function niveauxDisponibles(): DefinitionNiveauCycle[] {
  return NIVEAUX_CYCLE.filter((n) => !n.aVenir);
}

// ------------------------------------------------------------ saisie manuelle

export interface Regles {
  id: string;
  /** `YYYY-MM-DD`. */
  debutLe: string;
  finLe?: string;
  saisiLe: string;
}

export type TypeSymptome =
  | 'crampes'
  | 'fatigue'
  | 'maux_de_tete'
  | 'sensibilite'
  | 'ballonnements'
  | 'sommeil_difficile'
  | 'energie'
  | 'envies';

export interface DefinitionSymptome {
  code: TypeSymptome;
  libelle: string;
  emoji: string;
}

/**
 * Vocabulaire de la personne concernée, pour elle-même. Ces libellés ne sont
 * **jamais** montrés au partenaire en P0 : le partage des symptômes relève du
 * niveau 3, qui n'est pas ouvert.
 */
export const SYMPTOMES: readonly DefinitionSymptome[] = [
  { code: 'crampes', libelle: 'Crampes', emoji: '🌊' },
  { code: 'fatigue', libelle: 'Fatigue', emoji: '🌙' },
  { code: 'maux_de_tete', libelle: 'Maux de tête', emoji: '💫' },
  { code: 'sensibilite', libelle: 'Sensibilité', emoji: '🌸' },
  { code: 'ballonnements', libelle: 'Ballonnements', emoji: '🫧' },
  { code: 'sommeil_difficile', libelle: 'Sommeil difficile', emoji: '🌘' },
  { code: 'energie', libelle: 'Beaucoup d’énergie', emoji: '✨' },
  { code: 'envies', libelle: 'Envies', emoji: '🍫' },
] as const;

export function definitionSymptome(code: TypeSymptome): DefinitionSymptome {
  const trouve = SYMPTOMES.find((s) => s.code === code);
  if (!trouve) throw new Error(`Symptôme inconnu : ${code}`);
  return trouve;
}

export type Intensite = 1 | 2 | 3;

export const INTENSITES: readonly { valeur: Intensite; libelle: string }[] = [
  { valeur: 1, libelle: 'Léger' },
  { valeur: 2, libelle: 'Moyen' },
  { valeur: 3, libelle: 'Fort' },
] as const;

export interface Symptome {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  type: TypeSymptome;
  intensite: Intensite;
  note?: string;
}

// -------------------------------------------------------------------- phases

export type CodePhase =
  | 'menstruelle'
  | 'folliculaire'
  | 'ovulatoire'
  | 'luteale'
  | 'spm';

export interface DefinitionPhase {
  code: CodePhase;
  /** Pour la personne concernée : son propre vocabulaire, sans détour. */
  libelle: string;
  /**
   * Pour le partenaire. Deux règles tenues par les tests :
   *   - **parle des jours, jamais de la personne** — d'où l'absence du mot
   *     « elle » : aucune phrase ne prétend dire comment elle va ;
   *   - **aucun vocabulaire clinique**, aucune interprétation de son
   *     comportement. « C'est tes hormones » est exactement ce que cette app ne
   *     doit jamais permettre de dire.
   */
  lecturePartenaire: string;
  /** Gestes concrets proposés au partenaire. Des actions, pas des explications. */
  attentions: readonly string[];
}

export const PHASES: readonly DefinitionPhase[] = [
  {
    code: 'menstruelle',
    libelle: 'Règles',
    lecturePartenaire: 'Ces jours-ci demandent souvent un peu plus de douceur.',
    attentions: [
      'Proposer quelque chose de calme, sans en faire un événement.',
      'Prendre une corvée sans qu’on ait eu à la demander.',
    ],
  },
  {
    code: 'folliculaire',
    libelle: 'Phase folliculaire',
    lecturePartenaire: 'Une période où l’élan revient souvent.',
    attentions: [
      'Bon moment pour proposer une sortie ou relancer un projet à deux.',
    ],
  },
  {
    code: 'ovulatoire',
    libelle: 'Ovulation',
    lecturePartenaire: 'Une période souvent plus lumineuse.',
    attentions: ['Prévoir quelque chose ensemble, si l’envie est partagée.'],
  },
  {
    code: 'luteale',
    libelle: 'Phase lutéale',
    lecturePartenaire: 'Le rythme redescend doucement sur ces jours-là.',
    attentions: ['Rien de particulier à faire, juste rester disponible.'],
  },
  {
    code: 'spm',
    libelle: 'Avant les règles',
    lecturePartenaire: 'La fin de cycle peut être plus rude à traverser.',
    attentions: [
      'Alléger ce qui peut l’être dans la semaine.',
      'Demander comment ça va, simplement, sans chercher de cause.',
    ],
  },
] as const;

export function definitionPhase(code: CodePhase): DefinitionPhase {
  const trouve = PHASES.find((p) => p.code === code);
  if (!trouve) throw new Error(`Phase inconnue : ${code}`);
  return trouve;
}

/**
 * Affiché en permanence au partenaire, au-dessus de tout le reste.
 * C'est la phrase la plus importante du module.
 */
export const RAPPEL_AU_PARTENAIRE =
  'Ce que vous lisez ici ne dit pas comment elle va aujourd’hui. Si vous voulez ' +
  'le savoir, demandez-lui — et n’attribuez jamais ce qu’elle ressent à son cycle.';

/**
 * Affiché en permanence à la personne concernée.
 * Le module prévoit ; il ne diagnostique pas et ne protège de rien.
 */
export const AVERTISSEMENT_MEDICAL =
  'Ces repères sont des estimations calculées à partir de ce que vous saisissez. ' +
  'Ce n’est ni un avis médical, ni un moyen de contraception, ni une méthode ' +
  'fiable pour éviter ou obtenir une grossesse.';

export interface PartageCycle {
  /** La personne concernée, seule à pouvoir écrire ce réglage. */
  porteuseId: PartenaireId;
  niveau: NiveauCycle;
  majLe: string;
}

/**
 * Seule la personne concernée peut saisir des données ou changer le niveau.
 * Cette fonction est le point de contrôle unique — toute écriture passe par là.
 */
export function estLaPorteuse(
  partage: PartageCycle | undefined,
  auteurId: PartenaireId | undefined,
): boolean {
  return partage !== undefined && auteurId !== undefined && partage.porteuseId === auteurId;
}

/**
 * Change le niveau. Lève si quelqu'un d'autre que la personne concernée
 * l'essaie : la règle est dans le code, pas seulement dans l'interface.
 */
export function definirNiveauCycle(
  partage: PartageCycle,
  auteurId: PartenaireId,
  niveau: NiveauCycle,
  maintenant: string = new Date().toISOString(),
): PartageCycle {
  if (auteurId !== partage.porteuseId) {
    throw new Error(
      'Seule la personne concernée peut changer le niveau de partage du cycle',
    );
  }
  return { ...partage, niveau, majLe: maintenant };
}
