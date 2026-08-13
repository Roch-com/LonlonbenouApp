/**
 * Comportement d'une notification reçue **app ouverte**.
 *
 * Par défaut, expo-notifications n'affiche rien au premier plan. On affiche
 * quand même le bandeau : la personne peut être sur l'onglet Pratique quand un
 * SOS arrive, et un SOS silencieux ne servirait à rien.
 *
 * Pas de son ni de vibration au premier plan en revanche — le téléphone est
 * déjà en main, et l'app va de toute façon montrer la chose.
 */
import * as Notifications from 'expo-notifications';

let configure = false;

export function configurerAffichagePush(): void {
  if (configure) return;
  configure = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
