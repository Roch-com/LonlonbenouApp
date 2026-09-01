/** Pôle ③ — Projets de couple (P0 : création, jalons, avancement). */

import type { PartenaireId } from './couple';

/**
 * Catégories de projet (§8.10).
 *
 * Volontairement peu nombreuses : une liste longue oblige à hésiter, et un
 * projet mal rangé ne se retrouve pas mieux qu'un projet non rangé.
 */
export type CategorieProjet =
  | 'voyage'
  | 'maison'
  | 'argent'
  | 'famille'
  | 'ensemble';

export interface DefinitionCategorieProjet {
  code: CategorieProjet;
  libelle: string;
  emoji: string;
}

export const CATEGORIES_PROJET: readonly DefinitionCategorieProjet[] = [
  { code: 'voyage', libelle: 'Partir', emoji: '✈️' },
  { code: 'maison', libelle: 'Chez nous', emoji: '🏠' },
  { code: 'argent', libelle: 'Mettre de côté', emoji: '💶' },
  { code: 'famille', libelle: 'Famille', emoji: '🫂' },
  { code: 'ensemble', libelle: 'À deux', emoji: '💛' },
] as const;

export function definitionCategorieProjet(
  code: CategorieProjet,
): DefinitionCategorieProjet {
  const trouve = CATEGORIES_PROJET.find((c) => c.code === code);
  if (!trouve) throw new Error(`Catégorie de projet inconnue : ${code}`);
  return trouve;
}

export interface Jalon {
  id: string;
  titre: string;
  /** `YYYY-MM-DD`. */
  echeance?: string;
  /**
   * À qui revient ce jalon (§8.10). Absent signifie « aux deux » — c'est le
   * cas le plus fréquent dans un projet de couple, et en faire le défaut
   * évite de demander un arbitrage à chaque ligne.
   *
   * Sert à savoir qui s'en occupe, **jamais** à compter : un projet de couple
   * avance ou n'avance pas, personne n'avance plus que l'autre.
   */
  assigneA?: PartenaireId;
  faitLe?: string;
  /**
   * Qui a coché. Conservé pour l'affichage d'un jalon précis — **jamais
   * agrégé** : voir la note de `avancement.ts` sur l'absence de décompte par
   * personne.
   */
  faitPar?: PartenaireId;
}

export interface Projet {
  id: string;
  titre: string;
  categorie?: CategorieProjet;
  /** Le « pourquoi » du projet, qui aide à s'y remettre des mois plus tard. */
  intention?: string;
  jalons: readonly Jalon[];
  echeance?: string;
  creePar: PartenaireId;
  creeLe: string;
  archiveLe?: string;
  /**
   * Projet surprise (§8.10) : visible du seul auteur jusqu'à cette date.
   *
   * C'est la **seule** asymétrie assumée de toute l'application, et elle ne
   * contredit pas le garde-fou n°1 : ce qui est caché n'est pas une
   * observation de l'autre, c'est un cadeau qu'on lui prépare. La réciprocité
   * interdit de regarder quelqu'un à son insu, pas de lui faire une surprise.
   *
   * Elle est bornée dans le temps par construction : une date de révélation
   * est obligatoire, et passée cette date le projet devient commun sans que
   * personne n'ait à le décider.
   */
  revelerLe?: string;
}

/**
 * Un projet surprise est-il encore caché au partenaire ?
 *
 * La date fait foi, pas un drapeau : un booléen « révélé » obligerait
 * quelqu'un à penser à le basculer, et un projet oublié resterait secret pour
 * toujours — ce que le module ne promet pas.
 */
export function encoreSecret(
  projet: Pick<Projet, 'revelerLe'>,
  maintenant: string = new Date().toISOString(),
): boolean {
  if (!projet.revelerLe) return false;
  return projet.revelerLe > maintenant.slice(0, 10);
}

/**
 * Projets visibles par un lecteur donné.
 *
 * Filtre unique : aucun écran ne lit la liste brute, et le serveur applique
 * cette même fonction avant de répondre.
 */
export function projetsVisiblesPar(
  projets: readonly Projet[],
  lecteurId: PartenaireId,
  maintenant: string = new Date().toISOString(),
): Projet[] {
  return projets.filter(
    (projet) => projet.creePar === lecteurId || !encoreSecret(projet, maintenant),
  );
}

export const PROJETS_SUGGERES: readonly { titre: string; intention: string }[] = [
  {
    titre: 'Partir quelque part tous les deux',
    intention: 'Se retrouver ailleurs que dans le quotidien.',
  },
  {
    titre: 'Réaménager un coin de la maison',
    intention: 'Se sentir mieux là où on vit.',
  },
  {
    titre: 'Mettre de l’argent de côté',
    intention: 'Avancer plus sereinement.',
  },
  {
    titre: 'Recevoir nos proches',
    intention: 'Ouvrir notre porte plus souvent.',
  },
] as const;
