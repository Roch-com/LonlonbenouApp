import Constants from 'expo-constants';

/**
 * Adresse de l'API et identité du client OAuth2.
 *
 * `localhost` ne veut rien dire depuis un téléphone : sur un appareil réel il
 * faut l'adresse IP de la machine de développement. On la déduit de celle du
 * serveur Metro, qui est justement la bonne, plutôt que de la coder en dur et
 * de la voir se périmer à chaque changement de réseau.
 *
 * ## Pourquoi ce repli est réservé au développement
 *
 * `EXPO_PUBLIC_API_URL` est inséré dans le paquet **au moment de
 * l'empaquetage**. S'il manque alors, l'application part chercher son serveur
 * sur le téléphone lui-même et n'affiche qu'un « pas de connexion » : rien ne
 * dit que c'est un défaut de configuration, et on cherche la panne du côté du
 * réseau pendant des heures.
 *
 * C'est arrivé : une mise à jour à distance a été publiée sans cette
 * variable, parce que `eas update` ne lit pas le bloc `env` du profil de
 * build — celui-ci ne vaut que pour les builds. Les deux comptes se sont
 * retrouvés déconnectés.
 *
 * D'où `URL_ABSENTE` : dans un paquet livré, l'absence d'adresse est une
 * erreur de configuration, et elle doit se voir à l'écran plutôt que se
 * déguiser en panne de réseau.
 */
function adresseParDefaut(): string {
  const hote = Constants.expoConfig?.hostUri?.split(':')[0];
  return hote ? `http://${hote}:3000` : 'http://127.0.0.1:3000';
}

/**
 * Sentinelle posée quand aucune adresse n'est configurée hors développement.
 *
 * Ce n'est pas une adresse joignable, volontairement : toute requête échoue
 * tout de suite, et `estConfigurationManquante` permet aux écrans de le dire.
 */
export const URL_ABSENTE = 'configuration-absente://api';

/** Un paquet de développement se reconnaît à la présence du serveur Metro. */
const enDeveloppement = !!Constants.expoConfig?.hostUri;

function adresseApi(): string {
  const configuree =
    (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
    process.env['EXPO_PUBLIC_API_URL'];
  if (configuree) return configuree;
  return enDeveloppement ? adresseParDefaut() : URL_ABSENTE;
}

/**
 * L'application a-t-elle été empaquetée sans adresse de serveur ?
 *
 * Les écrans s'en servent pour afficher la cause réelle au lieu d'un message
 * de réseau qui enverrait chercher au mauvais endroit.
 */
export function estConfigurationManquante(): boolean {
  return CONFIGURATION_API.base === URL_ABSENTE;
}

export const CONFIGURATION_API = {
  base: adresseApi(),
  clientId:
    (Constants.expoConfig?.extra?.['oauthClientId'] as string | undefined) ??
    'lonlonbenu-mobile',
} as const;
