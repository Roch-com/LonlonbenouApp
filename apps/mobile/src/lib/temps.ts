/** Formatage temporel doux : on situe, on ne chronomètre pas. */

export function ilYA(iso: string, maintenant: Date = new Date()): string {
  const minutes = Math.floor((maintenant.getTime() - Date.parse(iso)) / 60_000);

  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;

  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

export function heure(iso: string): string {
  const instant = new Date(iso);
  // « Invalid Date » en toutes lettres au milieu d'un agenda ne dit rien à
  // personne. Des événements enregistrés avant la validation de l'heure
  // portent encore un horodatage illisible.
  if (Number.isNaN(instant.getTime())) return 'heure à préciser';

  return instant.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dateLongue(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Étiquette de séparation dans une conversation.
 *
 * « Aujourd'hui » et « Hier » plutôt que la date : dans un fil de discussion,
 * ce sont les deux seuls repères dont on a réellement besoin, et les lire en
 * toutes lettres évite de compter les jours de tête.
 */
export function jourLisible(iso: string, maintenant: Date = new Date()): string {
  const jour = new Date(iso);
  const memeJour = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (memeJour(jour, maintenant)) return "Aujourd'hui";

  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (memeJour(jour, hier)) return 'Hier';

  return jour.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Clé de regroupement par jour civil, indépendante du fuseau d'affichage. */
export function cleDuJour(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
