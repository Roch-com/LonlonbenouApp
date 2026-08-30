/**
 * Lecture d'une heure saisie à la main.
 *
 * Le formulaire de l'agenda fabriquait son horodatage ainsi :
 *
 *     `${date}T${(saisie || '19:00').padStart(5, '0')}:00`
 *
 * `padStart` complète à gauche sans rien vérifier : « 9 » devenait « 00009 »
 * et « 20h » devenait « 0020h ». L'horodatage était accepté par le serveur,
 * puis `new Date(...).toISOString()` levait à l'affichage — l'application se
 * fermait à chaque ouverture du calendrier, la donnée fautive étant déjà
 * enregistrée.
 *
 * D'où une lecture qui rend explicitement `undefined` plutôt qu'une chaîne
 * douteuse : l'appelant est obligé de traiter le cas.
 *
 * On accepte les formes qu'on tape vraiment — « 9 », « 9:30 », « 9h », « 20h30 »,
 * « 0930 » — parce que refuser « 9h » alors qu'on saisit une heure en français
 * est une brimade, pas une validation.
 */

/** Heure normalisée en `HH:MM`, ou `undefined` si elle est illisible. */
export function normaliserHeure(saisie: string): string | undefined {
  const propre = saisie.trim().toLowerCase().replace(/\s+/g, '');
  if (!propre) return undefined;

  const motif =
    // « 9 », « 09 », « 9h », « 9:30 », « 9h30 », « 0930 »
    /^(\d{1,2})(?:[:h.](\d{1,2})?|(\d{2}))?$/.exec(propre);
  if (!motif) return undefined;

  const heures = Number(motif[1]);
  // Le groupe 3 attrape le collé (« 0930 ») ; le groupe 2, le séparé.
  const minutes = Number(motif[2] ?? motif[3] ?? '0');

  if (!Number.isInteger(heures) || heures > 23) return undefined;
  if (!Number.isInteger(minutes) || minutes > 59) return undefined;

  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Horodatage local `YYYY-MM-DDTHH:MM:00` à partir d'un jour et d'une heure.
 * Rend `undefined` si l'un des deux est illisible — jamais une date bancale.
 */
export function horodatage(
  jour: string,
  heure?: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return undefined;
  if (heure === undefined) return undefined;
  return `${jour}T${heure}:00`;
}
