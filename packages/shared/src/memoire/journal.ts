/**
 * Pôle ⑤ — Journal du couple (§8.17).
 *
 * « Frise chronologique reprenant automatiquement les grands jalons de tous
 * les modules (projets terminés, progrès reconnus, initiatives marquantes,
 * anniversaires). »
 *
 * ## Un module qui ne stocke rien
 *
 * Tout ici se **dérive** de ce que les autres modules détiennent déjà. Rien
 * n’est écrit, aucune table n’est créée, et la dissociation n’a rien à effacer
 * de plus : ce qui disparaît ailleurs disparaît ici par construction. Le
 * cahier le classe P2 « module de synthèse » pour cette raison — il n’a de
 * valeur qu’une fois les autres alimentés.
 *
 * ## Ce que la frise ne dit jamais
 *
 * Qui a fait quoi. Une initiative n’indique pas qui l’a proposée, un jalon pas
 * qui l’a coché, un projet pas qui l’a créé. Ces champs existent en base et
 * s’affichent à leur place, sur l’élément lui-même ; agrégés dans une frise
 * ils deviendraient un décompte, et un décompte devient une comparaison — ce
 * que le cahier interdit au score et qui n’a pas plus sa place ici.
 *
 * ## Ce qui entre, et ce qui n’entre pas
 *
 * Seulement des faits **accomplis** et **datés** : un projet terminé, un axe
 * refermé, une sortie vécue, un souvenir, un parcours achevé, un anniversaire.
 * Pas d’échéance à venir, pas de retard, pas de projet en cours. Une frise qui
 * afficherait ce qui n’a pas encore été fait ne serait plus une mémoire, elle
 * serait un rappel de ce qu’on doit.
 */

import type { AxeCroissance } from '../types/croissance';
import type { Initiative } from '../types/initiatives';
import type { Projet } from '../types/projets';
import { avancementProjet } from '../projets/avancement';
import { estJourValide, libelleAnniversaire, type Souvenir } from './souvenirs';
import { definitionTheme } from '../types/croissance';

export type SorteEntree =
  | 'anniversaire'
  | 'projet'
  | 'progres'
  | 'initiative'
  | 'souvenir'
  | 'parcours';

export interface EntreeJournal {
  /** Stable : reconstruire la frise deux fois donne les mêmes clés. */
  id: string;
  sorte: SorteEntree;
  /** `YYYY-MM-DD`. */
  jour: string;
  titre: string;
  detail?: string;
  emoji: string;
}

/** Un parcours achevé, réduit à ce que la frise a besoin d’en savoir. */
export interface ParcoursAcheve {
  parcoursId: string;
  titre: string;
  termineLe: string;
}

export interface SourcesJournal {
  /** Date d’origine du couple, d’où se déduisent les anniversaires. */
  depuis?: string;
  projets?: readonly Projet[];
  axes?: readonly AxeCroissance[];
  initiatives?: readonly Initiative[];
  souvenirs?: readonly Souvenir[];
  parcours?: readonly ParcoursAcheve[];
}

const EMOJIS: Record<SorteEntree, string> = {
  anniversaire: '🎉',
  projet: '🏁',
  progres: '🌱',
  initiative: '✨',
  souvenir: '📷',
  parcours: '🧭',
};

/** Ne garde que la partie date : les sources mêlent jours et horodatages. */
const enJour = (valeur: string): string | undefined => {
  const jour = valeur.slice(0, 10);
  return estJourValide(jour) ? jour : undefined;
};

/**
 * Anniversaires révolus du couple.
 *
 * Le jour d’origine lui-même n’en est pas un — c’est le début, pas un
 * anniversaire. On s’arrête à `jusquA` : une frise ne montre pas l’avenir.
 */
function anniversaires(depuis: string, jusquA: string): EntreeJournal[] {
  const debut = enJour(depuis);
  const fin = enJour(jusquA);
  if (!debut || !fin) return [];

  const entrees: EntreeJournal[] = [];
  const anneeDebut = Number(debut.slice(0, 4));
  const anneeFin = Number(fin.slice(0, 4));

  for (let annee = anneeDebut + 1; annee <= anneeFin; annee += 1) {
    const jour = `${annee}${debut.slice(4)}`;
    // Un 29 février n'existe pas chaque année : `estJourValide` ne vérifie que
    // la forme, donc on écarte ici les dates que le calendrier ne porte pas.
    if (!estJourValide(jour) || jour > fin) continue;
    if (new Date(`${jour}T12:00:00.000Z`).toISOString().slice(0, 10) !== jour) {
      continue;
    }

    const ans = annee - anneeDebut;
    entrees.push({
      id: `anniversaire-${annee}`,
      sorte: 'anniversaire',
      jour,
      titre: libelleAnniversaire(ans),
      emoji: EMOJIS.anniversaire,
    });
  }
  return entrees;
}

/**
 * La frise, du plus récent au plus ancien.
 *
 * Chaque source est facultative : un module éteint ou vide ne doit pas
 * empêcher les autres d’apparaître. Une entrée dont la date est illisible est
 * écartée en silence plutôt que de faire échouer la frise entière — c’est une
 * synthèse, elle doit rendre ce qu’elle peut.
 */
export function construireJournal(
  sources: SourcesJournal,
  jusquA: string = new Date().toISOString(),
): EntreeJournal[] {
  const entrees: EntreeJournal[] = [];
  const fin = enJour(jusquA) ?? '9999-12-31';

  if (sources.depuis) entrees.push(...anniversaires(sources.depuis, fin));

  for (const projet of sources.projets ?? []) {
    const avancement = avancementProjet(projet, jusquA);
    if (avancement.etat !== 'termine' && avancement.etat !== 'archive') continue;

    // Le dernier jalon coché date la fin ; à défaut, l'archivage.
    const dernier = projet.jalons
      .map((j) => j.faitLe)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1);
    const jour = enJour(dernier ?? projet.archiveLe ?? '');
    if (!jour) continue;

    entrees.push({
      id: `projet-${projet.id}`,
      sorte: 'projet',
      jour,
      titre: projet.titre,
      // L'intention plutôt que le décompte : « pourquoi » vaut mieux que
      // « combien » des mois plus tard.
      ...(projet.intention ? { detail: projet.intention } : {}),
      emoji: EMOJIS.projet,
    });
  }

  for (const axe of sources.axes ?? []) {
    const jour = enJour(axe.clotureLe ?? '');
    if (!jour) continue;
    entrees.push({
      id: `progres-${axe.id}`,
      sorte: 'progres',
      jour,
      titre: axe.titre,
      detail: definitionTheme(axe.theme).libelle,
      emoji: EMOJIS.progres,
    });
  }

  for (const initiative of sources.initiatives ?? []) {
    const jour = enJour(initiative.vecueLe ?? '');
    if (!jour) continue;
    entrees.push({
      id: `initiative-${initiative.id}`,
      sorte: 'initiative',
      jour,
      titre: initiative.titre,
      // Le mot du journal porte sur le moment, jamais sur qui l'a proposé.
      ...(initiative.souvenir ? { detail: initiative.souvenir } : {}),
      emoji: EMOJIS.initiative,
    });
  }

  for (const souvenir of sources.souvenirs ?? []) {
    const jour = enJour(souvenir.jour);
    if (!jour) continue;
    entrees.push({
      id: `souvenir-${souvenir.id}`,
      sorte: 'souvenir',
      jour,
      titre: souvenir.contenu.titre,
      ...(souvenir.contenu.note ? { detail: souvenir.contenu.note } : {}),
      emoji: EMOJIS.souvenir,
    });
  }

  for (const parcours of sources.parcours ?? []) {
    const jour = enJour(parcours.termineLe);
    if (!jour) continue;
    entrees.push({
      id: `parcours-${parcours.parcoursId}`,
      sorte: 'parcours',
      jour,
      titre: parcours.titre,
      detail: 'Parcours terminé à deux',
      emoji: EMOJIS.parcours,
    });
  }

  return trierJournal(entrees.filter((e) => e.jour <= fin));
}

/**
 * Tri de la frise, du plus récent au plus ancien.
 *
 * Exposé parce que la frise se construit en deux endroits : le serveur compose
 * ce qu'il peut lire, le mobile y ajoute les souvenirs qu'il vient d'ouvrir —
 * ils sont scellés, le serveur n'en connaît que la date. Les deux moitiés
 * doivent se ranger selon la même règle, sinon la fusion produirait un ordre
 * qui dépend de qui a composé quoi.
 *
 * L'identifiant départage les entrées du même jour : sans lui, deux appels
 * successifs pourraient ne pas rendre le même ordre.
 */
export function trierJournal(
  entrees: readonly EntreeJournal[],
): EntreeJournal[] {
  return [...entrees].sort((a, b) =>
    a.jour === b.jour
      ? a.id.localeCompare(b.id)
      : b.jour.localeCompare(a.jour),
  );
}

export interface AnneeJournal {
  annee: string;
  entrees: readonly EntreeJournal[];
}

/**
 * La frise regroupée par année, la plus récente en premier.
 *
 * Le regroupement vit ici plutôt que dans l’écran : c’est la même découpe sur
 * mobile et partout ailleurs, et elle se teste.
 */
export function grouperParAnnee(
  entrees: readonly EntreeJournal[],
): AnneeJournal[] {
  const parAnnee = new Map<string, EntreeJournal[]>();
  for (const entree of entrees) {
    const annee = entree.jour.slice(0, 4);
    const liste = parAnnee.get(annee) ?? [];
    liste.push(entree);
    parAnnee.set(annee, liste);
  }

  return [...parAnnee.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([annee, liste]) => ({ annee, entrees: liste }));
}
