import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { Position } from '@lonlonbenu/shared';
import { definirPositionServeur, definirStatutServeur } from '../api/presence.api';
import { useLieux } from '../stores/lieuxStore';
import { cleDuCouple, scellerPosition } from './positionAppareil';
import { TACHE_GEOFENCING, TACHE_POSITION } from './suiviArrierePlan';

/**
 * Tâches d'arrière-plan, définies **au chargement du module**.
 *
 * Elles doivent être enregistrées hors de tout composant : le système peut
 * réveiller l'application sans monter le moindre écran, et une tâche déclarée
 * dans un `useEffect` n'existerait alors pas. C'est la raison d'être de ce
 * fichier, importé une fois depuis la disposition racine.
 *
 * ## Ce qu'elles ne savent pas faire
 *
 * Elles n'ont pas accès aux hooks, donc pas au store de session. L'identifiant
 * du couple est déposé ici par l'écran de présence quand il en connaît un —
 * sans lui, la tâche relève et jette. C'est volontaire : mieux vaut un relevé
 * perdu qu'une position envoyée sur un couple dont on n'est plus sûr.
 */

let coupleCourant: string | undefined;

/** Renseigné par l'app dès qu'une session de couple est établie. */
export function memoriserLeCouple(coupleId: string | undefined): void {
  coupleCourant = coupleId;
}

async function publier(position: Position): Promise<void> {
  if (!coupleCourant) return;
  const cle = await cleDuCouple();
  // Sans clé, rien ne part : la position en clair n'est jamais un repli.
  if (!cle) return;
  await definirPositionServeur(coupleCourant, scellerPosition(cle, position));
}

TaskManager.defineTask(TACHE_POSITION, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const derniere = locations?.at(-1);
  if (!derniere) return;

  try {
    await publier({
      latitude: derniere.coords.latitude,
      longitude: derniere.coords.longitude,
      precisionM: derniere.coords.accuracy ?? undefined,
      releveeLe: new Date(derniere.timestamp).toISOString(),
    });
  } catch {
    // Une tâche d'arrière-plan qui lève est tuée par le système et peut ne
    // plus être réveillée. Un relevé perdu ne vaut pas ce risque.
  }
});

TaskManager.defineTask(TACHE_GEOFENCING, async ({ data, error }) => {
  if (error || !data) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  if (!coupleCourant || !region.identifier) return;

  const lieu = useLieux
    .getState()
    .lieux.find((l) => l.id === region.identifier);
  if (!lieu?.statut) return;

  try {
    if (eventType === Location.GeofencingEventType.Enter) {
      useLieux.getState().noterLieu(lieu.id);
      // `annoncer` : c'est une arrivée détectée, le seul cas où le cahier
      // prévoit de prévenir l'autre. Le serveur compose le texte à partir du
      // statut — le nom du lieu ne sort pas de ce téléphone.
      await definirStatutServeur(coupleCourant, lieu.statut, undefined, true);
    } else if (useLieux.getState().dernierLieuId === lieu.id) {
      // En partant, on ne pose rien à la place de la personne : on oublie le
      // lieu, et le statut reste celui qu'elle avait choisi.
      useLieux.getState().noterLieu(undefined);
    }
  } catch {
    // Idem : ne jamais laisser lever une tâche d'arrière-plan.
  }
});
