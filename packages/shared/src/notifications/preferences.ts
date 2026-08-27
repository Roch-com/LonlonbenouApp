/**
 * Pôle ⑥ — Socle de notifications.
 *
 * Un point de passage unique : toute notification, quel que soit le pôle qui
 * l'émet, traverse `deciderRemise`. C'est ce qui permet de garantir des règles
 * à l'échelle de l'app plutôt qu'au cas par cas.
 *
 * Deux garanties tenues ici et testées :
 *
 *   - **Le SOS passe toujours.** Ni le mode ne pas déranger, ni une pause, ni
 *     un réglage de fréquence ne peuvent le retenir. Une app de couple qui
 *     avale une alerte de détresse parce qu'il est 23 h a échoué à la seule
 *     chose qui comptait vraiment.
 *   - **Rien ne se perd silencieusement.** Une notification retenue est
 *     `groupee` ou `differee`, jamais supprimée — sauf si la personne a
 *     explicitement choisi « jamais » pour cette catégorie.
 */

export type CategorieNotification =
  | 'sos'
  | 'message'
  | 'presence'
  | 'confidence'
  | 'croissance'
  | 'partage'
  | 'rappel';

export interface DefinitionCategorie {
  code: CategorieNotification;
  libelle: string;
  detail: string;
  /** Catégories qu'on ne peut ni couper ni retarder. */
  imperative?: boolean;
}

export const CATEGORIES: readonly DefinitionCategorie[] = [
  {
    code: 'sos',
    libelle: 'SOS',
    detail: 'Toujours transmis, immédiatement, quels que soient les réglages.',
    imperative: true,
  },
  {
    code: 'message',
    libelle: 'Messages et notes douces',
    detail: 'La conversation du couple.',
  },
  {
    code: 'presence',
    libelle: 'Présence',
    detail: 'Statuts, check-ins et arrivées.',
  },
  {
    code: 'confidence',
    libelle: 'Confidences',
    detail: 'Gratitudes et lettres reçues.',
  },
  {
    code: 'croissance',
    libelle: 'Axes de croissance',
    detail: 'Quand une part a été déposée de l’autre côté.',
  },
  {
    code: 'partage',
    libelle: 'Changements de partage',
    detail:
      'Activation ou pause d’un partage. Toujours transmis aux deux, pour qu’aucun réglage ne change en silence.',
    imperative: true,
  },
  {
    code: 'rappel',
    libelle: 'Rappels',
    detail: 'Jalons du compteur, anniversaires, échéances.',
  },
] as const;

export function definitionCategorie(
  code: CategorieNotification,
): DefinitionCategorie {
  const trouve = CATEGORIES.find((c) => c.code === code);
  if (!trouve) throw new Error(`Catégorie inconnue : ${code}`);
  return trouve;
}

export type Frequence = 'immediate' | 'groupee' | 'quotidienne' | 'jamais';

export interface DefinitionFrequence {
  code: Frequence;
  libelle: string;
  detail: string;
}

export const FREQUENCES: readonly DefinitionFrequence[] = [
  { code: 'immediate', libelle: 'Tout de suite', detail: 'Dès que ça arrive.' },
  {
    code: 'groupee',
    libelle: 'Groupées',
    detail: 'Rassemblées en un seul rappel toutes les heures.',
  },
  {
    code: 'quotidienne',
    libelle: 'Une fois par jour',
    detail: 'Un seul récapitulatif, à l’heure de votre choix.',
  },
  { code: 'jamais', libelle: 'Jamais', detail: 'Rien ne sera envoyé.' },
] as const;

/** Plage « ne pas déranger ». Peut passer minuit (22:00 → 07:00). */
export interface PlageSilence {
  actif: boolean;
  /** « HH:MM ». */
  debut: string;
  fin: string;
}

export interface PreferencesNotifications {
  parCategorie: Record<CategorieNotification, Frequence>;
  silence: PlageSilence;
  /** Pause manuelle jusqu'à cette date ISO. */
  pauseJusqua?: string;
  /** Heure du récapitulatif quotidien, « HH:MM ». */
  heureRecapitulatif: string;
}

export const PREFERENCES_PAR_DEFAUT: PreferencesNotifications = {
  parCategorie: {
    sos: 'immediate',
    message: 'immediate',
    presence: 'groupee',
    confidence: 'immediate',
    croissance: 'groupee',
    partage: 'immediate',
    rappel: 'quotidienne',
  },
  silence: { actif: true, debut: '22:30', fin: '07:30' },
  heureRecapitulatif: '19:00',
};

function minutesDepuisMinuit(heure: string): number {
  const [h, m] = heure.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Heure invalide : ${heure}`);
  }
  return h * 60 + m;
}

/** Gère les plages qui passent minuit, cas normal pour une nuit. */
export function dansLaPlage(plage: PlageSilence, maintenant: Date): boolean {
  if (!plage.actif) return false;

  const instant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const debut = minutesDepuisMinuit(plage.debut);
  const fin = minutesDepuisMinuit(plage.fin);

  return debut <= fin
    ? instant >= debut && instant < fin
    : instant >= debut || instant < fin;
}

/**
 * Vrai quand rien de non impératif ne doit sonner : plage « ne pas déranger »
 * en cours, ou pause manuelle non expirée.
 *
 * Exporté parce que le serveur en a besoin pour savoir **quand vider la file**
 * des notifications différées — sans quoi il devrait redevenir la logique de
 * `deciderRemise`, et les deux finiraient par diverger.
 */
export function estEnSilence(
  preferences: PreferencesNotifications,
  maintenant: Date = new Date(),
): boolean {
  const enPause =
    preferences.pauseJusqua !== undefined &&
    maintenant.getTime() < Date.parse(preferences.pauseJusqua);

  return enPause || dansLaPlage(preferences.silence, maintenant);
}

export type Remise =
  /** Transmise tout de suite. */
  | 'envoyee'
  /** Mise de côté, remise avec les autres au prochain regroupement. */
  | 'groupee'
  /** Retenue jusqu'à la fin du silence ou de la pause. */
  | 'differee'
  /** Non transmise, à la demande explicite de la personne. */
  | 'ignoree';

export interface DecisionRemise {
  remise: Remise;
  /** Explication affichable, utile pour comprendre pourquoi rien n'a sonné. */
  raison: string;
}

/**
 * Décide du sort d'une notification. Point de passage unique de l'app.
 */
export function deciderRemise(
  categorie: CategorieNotification,
  preferences: PreferencesNotifications,
  maintenant: Date = new Date(),
): DecisionRemise {
  const definition = definitionCategorie(categorie);

  // Le SOS ne se négocie avec aucun réglage.
  if (categorie === 'sos') {
    return { remise: 'envoyee', raison: 'Un SOS est toujours transmis.' };
  }

  const frequence = definition.imperative
    ? 'immediate'
    : preferences.parCategorie[categorie];

  if (frequence === 'jamais') {
    return {
      remise: 'ignoree',
      raison: 'Vous avez choisi de ne pas être prévenu·e pour cette catégorie.',
    };
  }

  if (estEnSilence(preferences, maintenant)) {
    const enPause =
      preferences.pauseJusqua !== undefined &&
      maintenant.getTime() < Date.parse(preferences.pauseJusqua);
    return {
      remise: 'differee',
      raison: enPause
        ? 'Notifications en pause.'
        : `Ne pas déranger, de ${preferences.silence.debut} à ${preferences.silence.fin}.`,
    };
  }

  if (frequence === 'groupee') {
    return { remise: 'groupee', raison: 'Regroupée avec les suivantes.' };
  }
  if (frequence === 'quotidienne') {
    return {
      remise: 'groupee',
      raison: `Gardée pour le récapitulatif de ${preferences.heureRecapitulatif}.`,
    };
  }

  return { remise: 'envoyee', raison: 'Transmise tout de suite.' };
}

/** Les catégories dont la fréquence est modifiable par la personne. */
export function categoriesReglables(): DefinitionCategorie[] {
  return CATEGORIES.filter((c) => !c.imperative);
}
