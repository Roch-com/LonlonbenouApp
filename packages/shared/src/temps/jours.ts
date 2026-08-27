/** Arithmétique de jours civils, en UTC, partagée par le compteur et le score. */

export const MS_PAR_JOUR = 86_400_000;

/** Minuit UTC du jour civil d'une date ISO (YYYY-MM-DD ou datetime complet). */
export function jourUtc(iso: string): number {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number);
  if (!annee || !mois || !jour) throw new Error(`Date invalide : ${iso}`);
  return Date.UTC(annee, mois - 1, jour);
}

/** Nombre de jours civils entre deux dates. Même jour = 0. */
export function joursEntre(depuis: string, jusqua: string): number {
  return Math.floor((jourUtc(jusqua) - jourUtc(depuis)) / MS_PAR_JOUR);
}

/** Date ISO courte obtenue en décalant `depuis` de `jours`. */
export function ajouterJours(depuis: string, jours: number): string {
  return new Date(jourUtc(depuis) + jours * MS_PAR_JOUR).toISOString().slice(0, 10);
}
