import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

/**
 * Pôle ① — geofencing et relevé en arrière-plan (§8.2).
 *
 * ## La non-furtivité est structurelle, pas déclarative
 *
 * Le garde-fou n°3 interdit qu'une fonctionnalité permette d'observer sans que
 * l'autre le sache. Ici, la garantie ne repose pas sur une promesse d'interface
 * mais sur trois propriétés du mécanisme lui-même :
 *
 *   1. **Ce suivi ne renseigne que sur soi.** Il publie *ma* position ; il ne
 *      lit jamais celle de l'autre. Activer l'arrière-plan augmente ce que je
 *      montre, jamais ce que je vois.
 *   2. **Android l'affiche en permanence.** Un service de premier plan impose
 *      une notification persistante, impossible à masquer : le téléphone dit
 *      lui-même que l'app relève la position. C'est exactement l'inverse d'un
 *      mode furtif, et c'est le système qui le garantit.
 *   3. **La réciprocité tient toujours à la lecture.** Ce que l'autre voit
 *      dépend du partage, pas du mode de relevé. Relever plus souvent ne donne
 *      aucun accès supplémentaire.
 *
 * ## Le geofencing s'appuie sur des lieux locaux
 *
 * Les régions surveillées viennent des lieux favoris, qui ne quittent jamais
 * l'appareil. Le système d'exploitation est seul à connaître ces coordonnées ;
 * le serveur reçoit un statut, jamais une adresse.
 */

export const TACHE_GEOFENCING = 'lonlonbenu.geofencing';
export const TACHE_POSITION = 'lonlonbenu.position-arriere-plan';

export type EtatPermissionArrierePlan =
  | 'jamais_demandee'
  | 'accordee'
  | 'refusee';

/**
 * L'autorisation d'arrière-plan se demande **après** celle de premier plan :
 * Android refuse la seconde tant que la première n'est pas accordée, et la
 * demander d'emblée fait échouer les deux.
 */
export async function permissionArrierePlan(): Promise<EtatPermissionArrierePlan> {
  const premierPlan = await Location.getForegroundPermissionsAsync();
  if (!premierPlan.granted) return 'jamais_demandee';

  const etat = await Location.getBackgroundPermissionsAsync();
  if (etat.granted) return 'accordee';
  return etat.canAskAgain ? 'jamais_demandee' : 'refusee';
}

export async function demanderArrierePlan(): Promise<EtatPermissionArrierePlan> {
  const premierPlan = await Location.getForegroundPermissionsAsync();
  if (!premierPlan.granted) {
    const accorde = await Location.requestForegroundPermissionsAsync();
    if (!accorde.granted) return 'refusee';
  }

  const etat = await Location.requestBackgroundPermissionsAsync();
  if (etat.granted) return 'accordee';
  return etat.canAskAgain ? 'jamais_demandee' : 'refusee';
}

export interface RegionSurveillee {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/**
 * (Ré)arme la surveillance des lieux. Sans région, tout est arrêté : un
 * geofencing sans lieu ne ferait que consommer de la batterie.
 */
export async function armerLeGeofencing(
  regions: readonly RegionSurveillee[],
): Promise<void> {
  const dejaLa = await TaskManager.isTaskRegisteredAsync(TACHE_GEOFENCING);

  if (regions.length === 0) {
    if (dejaLa) await Location.stopGeofencingAsync(TACHE_GEOFENCING);
    return;
  }

  // `startGeofencingAsync` remplace les régions d'une tâche déjà armée : pas
  // besoin de l'arrêter d'abord, et l'arrêter créerait une fenêtre aveugle.
  await Location.startGeofencingAsync(TACHE_GEOFENCING, [...regions]);
}

export async function desarmerLeGeofencing(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TACHE_GEOFENCING)) {
    await Location.stopGeofencingAsync(TACHE_GEOFENCING);
  }
}

/**
 * Relevé de position en arrière-plan.
 *
 * `Balanced` et non `BestForNavigation` : on situe quelqu'un dans un quartier.
 * `distanceInterval` plutôt qu'un pur intervalle de temps — un téléphone posé
 * sur une table ne déclenche alors aucun relevé, ce qui est le vrai levier sur
 * la batterie (§9.6).
 */
export async function demarrerLeSuivi(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TACHE_POSITION)) return;

  await Location.startLocationUpdatesAsync(TACHE_POSITION, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 150,
    timeInterval: 5 * 60_000,
    pausesUpdatesAutomatically: true,
    foregroundService: {
      notificationTitle: 'LONLONBENU partage votre position',
      notificationBody:
        'Vous pouvez l’arrêter à tout moment dans Présence. Votre partenaire voit la même chose de vous que vous de lui.',
      notificationColor: '#1D4E89',
    },
  });
}

export async function arreterLeSuivi(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TACHE_POSITION)) {
    await Location.stopLocationUpdatesAsync(TACHE_POSITION);
  }
}

export async function suiviActif(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(TACHE_POSITION).catch(
    () => false,
  );
}
