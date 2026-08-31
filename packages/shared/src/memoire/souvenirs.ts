/**
 * Pôle ⑤ — Souvenirs et Love Map (§8.15 et §8.16 du cahier).
 *
 * ## Un seul modèle pour deux modules
 *
 * L'album et la carte des lieux visités ne diffèrent que par une chose : le
 * second porte des coordonnées. Tout le reste — une date, un titre, un mot,
 * un rattachement à un projet ou une sortie — leur est commun. En faire deux
 * entités séparées aurait dupliqué le stockage, le contrôle d'accès et le
 * chiffrement pour distinguer ce qu'un champ facultatif distingue déjà.
 *
 * ## Ce que le serveur voit
 *
 * Le contenu part scellé : titre, note et coordonnées sont dans l'enveloppe.
 * **La date, elle, reste en clair.** C'est un choix, pas un oubli : « il y a
 * un an » suppose de retrouver les souvenirs d'une date donnée sans les
 * ouvrir, et le serveur n'a aucune clé pour le faire. Une date seule dit
 * qu'il s'est passé quelque chose ce jour-là, sans dire quoi ni où — le prix
 * paraît juste pour la fonctionnalité qui donne au module son sens.
 */

import type { PartenaireId } from '../types/couple';

export type SorteSouvenir = 'moment' | 'lieu';

/** Ce que le serveur détient : une enveloppe, une date, une origine. */
export interface SouvenirScelle {
  id: string;
  sorte: SorteSouvenir;
  /** `YYYY-MM-DD` — en clair, pour retrouver les anniversaires. */
  jour: string;
  /** `m1.<nonce>.<scellé>` : titre, note et coordonnées éventuelles. */
  contenuScelle: string;
  creePar: PartenaireId;
  creeLe: string;
}

/** Le clair, tel qu'il n'existe que sur les téléphones. */
export interface ContenuSouvenir {
  titre: string;
  note?: string;
  /** Renseignées pour un lieu, absentes pour un moment. */
  latitude?: number;
  longitude?: number;
  /** Rattachement facultatif à un projet ou une sortie. */
  origine?: { sorte: 'projet' | 'initiative'; id: string };
}

/** Souvenir ouvert, prêt à afficher. */
export interface Souvenir extends Omit<SouvenirScelle, 'contenuScelle'> {
  contenu: ContenuSouvenir;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function estJourValide(jour: string): boolean {
  return FORMAT_JOUR.test(jour);
}

/** Du plus récent au plus ancien : un album se parcourt à rebours. */
export function trierSouvenirs<T extends { jour: string; creeLe: string }>(
  souvenirs: readonly T[],
): T[] {
  return [...souvenirs].sort(
    (a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe),
  );
}

export interface Anniversaire<T> {
  /** Nombre d'années révolues. Toujours au moins 1. */
  ans: number;
  souvenir: T;
}

/**
 * « Il y a un an » (§8.15) — souvenirs tombant le même jour d'une année passée.
 *
 * Le 29 février est rattaché au 1er mars les années ordinaires : le laisser
 * disparaître trois années sur quatre ferait manquer les souvenirs qu'on a
 * justement le plus envie de revoir.
 */
export function souvenirsDuJour<T extends { jour: string }>(
  souvenirs: readonly T[],
  aujourdhui: string,
): Anniversaire<T>[] {
  if (!estJourValide(aujourdhui)) return [];

  const anneeCourante = Number(aujourdhui.slice(0, 4));
  const jourCourant = aujourdhui.slice(5);

  return souvenirs
    .filter((s) => estJourValide(s.jour))
    .map((souvenir) => ({
      ans: anneeCourante - Number(souvenir.jour.slice(0, 4)),
      souvenir,
      jourMois: souvenir.jour.slice(5),
    }))
    .filter(({ ans, jourMois }) => {
      if (ans < 1) return false;
      if (jourMois === jourCourant) return true;
      // Un souvenir du 29 février revient le 1er mars quand l'année n'est pas
      // bissextile ; sinon il ne reviendrait qu'une fois tous les quatre ans.
      return jourMois === '02-29' && jourCourant === '03-01' && !estBissextile(anneeCourante);
    })
    .map(({ ans, souvenir }) => ({ ans, souvenir }));
}

function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

/** Libellé d'anniversaire, sans fausse solennité. */
export function libelleAnniversaire(ans: number): string {
  return ans === 1 ? 'il y a un an' : `il y a ${ans} ans`;
}

/** Les lieux, pour la Love Map : ceux qui portent des coordonnées lisibles. */
export function lieuxVisites(souvenirs: readonly Souvenir[]): Souvenir[] {
  return souvenirs.filter(
    (s) =>
      s.sorte === 'lieu' &&
      typeof s.contenu.latitude === 'number' &&
      typeof s.contenu.longitude === 'number',
  );
}
