import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Suivi des plantages côté application.
 *
 * C'est le seul moyen de savoir qu'une erreur est survenue sur le téléphone de
 * quelqu'un. Une personne qui rencontre un écran blanc ferme l'app et n'en
 * reparle pas ; sans remontée, le défaut reste invisible jusqu'à ce qu'il fasse
 * abandonner.
 *
 * ## La contrainte propre à cette application
 *
 * Le projet promet que le serveur ne voit pas le contenu du chat et que les
 * données de cycle n'appartiennent qu'à la personne concernée. Envoyer ces
 * mêmes données à un service de suivi d'erreurs viderait ces promesses de leur
 * sens — le tiers changerait, pas la fuite.
 *
 * D'où une configuration volontairement pauvre : pas de captures d'écran, pas
 * de rejeu de session, pas de fils d'exécution réseau ou console, pas
 * d'identification de l'utilisateur. Il reste la pile d'appels et la version de
 * l'app. C'est ce qui sert à corriger ; le reste ne servirait qu'à profiler.
 */
export function demarrerLaSurveillance(): boolean {
  const dsn =
    (Constants.expoConfig?.extra?.['sentryDsn'] as string | undefined) ??
    process.env['EXPO_PUBLIC_SENTRY_DSN'];

  // Sans DSN — en développement, ou tant que le compte n'existe pas — on
  // n'initialise rien plutôt que d'accumuler des événements sans destination.
  //
  // Le test porte sur la forme et pas seulement sur la présence : EAS refuse
  // une variable vide, donc la clé est absente d'`eas.json` tant qu'il n'y a
  // pas de compte. Le jour où on l'ajoutera, une valeur d'attente du genre
  // « à-remplir » ne doit pas faire lever Sentry au lancement de l'app.
  if (!dsn?.trim() || !dsn.trim().startsWith('http')) return false;

  Sentry.init({
    dsn,
    environment: process.env['EXPO_PUBLIC_ENV'] ?? 'development',

    sendDefaultPii: false,
    // Ni capture d'écran ni vue de la hiérarchie : l'écran d'un couple montre
    // des messages, un cycle, des confidences.
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,

    tracesSampleRate: 0.1,

    beforeSend(evenement) {
      delete evenement.user;
      delete evenement.contexts?.device;
      if (evenement.request) {
        delete evenement.request.data;
        delete evenement.request.headers;
      }
      return evenement;
    },

    beforeBreadcrumb(fil) {
      // Les fils `http` portent les URL de l'API, identifiants de couple
      // compris. Les fils console porteraient ce qu'un `console.log` oublié
      // aurait écrit — y compris du texte déchiffré.
      if (fil.category === 'http' || fil.category === 'console') return null;
      // La navigation reste utile : savoir sur quel écran l'erreur est
      // survenue change tout, et un nom de route ne dit rien de personnel.
      return fil;
    },
  });

  return true;
}
