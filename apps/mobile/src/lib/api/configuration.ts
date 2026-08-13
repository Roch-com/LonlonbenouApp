import Constants from 'expo-constants';

/**
 * Adresse de l'API et identité du client OAuth2.
 *
 * `localhost` ne veut rien dire depuis un téléphone : sur un appareil réel il
 * faut l'adresse IP de la machine de développement. On la déduit de celle du
 * serveur Metro, qui est justement la bonne, plutôt que de la coder en dur et
 * de la voir se périmer à chaque changement de réseau.
 */
function adresseParDefaut(): string {
  const hote = Constants.expoConfig?.hostUri?.split(':')[0];
  return hote ? `http://${hote}:3000` : 'http://127.0.0.1:3000';
}

export const CONFIGURATION_API = {
  base:
    (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
    process.env['EXPO_PUBLIC_API_URL'] ??
    adresseParDefaut(),
  clientId:
    (Constants.expoConfig?.extra?.['oauthClientId'] as string | undefined) ??
    'lonlonbenu-mobile',
} as const;
