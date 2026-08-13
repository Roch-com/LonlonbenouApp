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
  return new Date(iso).toLocaleTimeString('fr-FR', {
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
