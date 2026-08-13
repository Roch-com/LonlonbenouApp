/**
 * Pôle ⑥ — obtention du jeton push natif de cet appareil.
 *
 * Le serveur parle directement à FCM et APNs (`apps/api/src/modules/notifications/`),
 * pas au service de push d'Expo : c'est donc le **jeton natif** qu'il attend —
 * jeton d'enregistrement FCM côté Android, jeton APNs en hexadécimal côté iOS —
 * et non un `ExpoPushToken`. `getDevicePushTokenAsync` rend exactement ça.
 *
 * ## Le repli de développement
 *
 * Tant que le projet Firebase et la clé Apple n'existent pas, aucun jeton natif
 * ne peut être délivré : la demande échoue en simulateur, dans Expo Go, et sur
 * un build sans `google-services.json`. On fabrique alors un **jeton factice**,
 * stable pour cette installation, qui permet de vérifier toute la chaîne
 * jusqu'au dépôt du serveur — l'inscription, la réciprocité, la dissociation qui
 * délie les appareils — sans qu'aucune notification n'arrive jamais.
 *
 * Un jeton factice est **toujours signalé comme tel** dans l'interface. Une
 * personne qui a accepté les notifications et n'en reçoit aucune doit savoir
 * pourquoi ; la laisser croire à une panne serait un mensonge par omission.
 *
 * Ce qu'il faudra pour passer au réel : voir `README.md` du pôle, section
 * « Ce qui reste à faire avec les vrais comptes ».
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

export type PlateformePush = 'ios' | 'android';

export interface JetonAppareil {
  jetonPush: string;
  plateforme: PlateformePush;
  /** Vrai quand le jeton ne vient pas d'Apple ou de Google. */
  factice: boolean;
}

const ENTREE_FACTICE = 'lonlonbenu.push.jetonFactice';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** iOS ou Android ; le web n'a pas de pôle notifications pour l'instant. */
export function plateformePush(): PlateformePush | undefined {
  return Platform.OS === 'ios' || Platform.OS === 'android'
    ? Platform.OS
    : undefined;
}

/**
 * Jeton factice stable : il doit survivre aux redémarrages, sinon chaque
 * lancement inscrirait une ligne de plus dans la table `appareils` du serveur
 * et le journal deviendrait illisible.
 */
async function jetonFacticeStable(plateforme: PlateformePush): Promise<string> {
  const existant = await SecureStore.getItemAsync(ENTREE_FACTICE, OPTIONS);
  if (existant) return existant;

  const alea = Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(16)),
    (octet) => octet.toString(16).padStart(2, '0'),
  ).join('');

  // Le préfixe rend le jeton reconnaissable au premier coup d'œil dans la base
  // : personne ne doit confondre une inscription de développement avec une
  // vraie.
  const jeton = `dev-${plateforme}-${alea}`;
  await SecureStore.setItemAsync(ENTREE_FACTICE, jeton, OPTIONS);
  return jeton;
}

export async function oublierLeJetonFactice(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTREE_FACTICE, OPTIONS);
}

/**
 * Demande le jeton natif, et retombe sur un factice si l'appareil ou la
 * configuration ne permet pas d'en obtenir un.
 *
 * N'est appelée qu'une fois la permission accordée : demander un jeton sans
 * permission échoue sur iOS.
 */
export async function obtenirLeJeton(): Promise<JetonAppareil | undefined> {
  const plateforme = plateformePush();
  if (!plateforme) return undefined;

  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    // Sur Android `data` est la chaîne FCM ; sur iOS, l'hexadécimal APNs.
    if (typeof data === 'string' && data.length > 0) {
      return { jetonPush: data, plateforme, factice: false };
    }
  } catch {
    // Simulateur, Expo Go, ou identifiants Firebase/Apple encore absents.
  }

  return {
    jetonPush: await jetonFacticeStable(plateforme),
    plateforme,
    factice: true,
  };
}
