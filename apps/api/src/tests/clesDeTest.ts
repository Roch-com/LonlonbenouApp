import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { genererPaire } from '../securite/oauth/cles.ts';

/** Une seule paire pour tout le processus de test : jetons et serveur concordent. */
export const CLES = genererPaire();

export const EMETTEUR = 'https://auth.lonlonbenu.test';
export const AUDIENCE = 'lonlonbenu-api';
export const CLIENT_MOBILE = 'lonlonbenu-mobile';

export interface OptionsJetonDeTest {
  expireDansSecondes?: number;
  emetteur?: string;
  audience?: string;
  jti?: string;
}

/**
 * Forge un jeton d'accès valide pour les tests. Il est signé par la même clé
 * que celle du serveur et vérifié par le vrai `jwtVerify` — ce n'est pas une
 * simulation d'authentification, c'est la vraie.
 */
export async function jetonDeTest(
  sub: string,
  options: OptionsJetonDeTest = {},
): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  return new SignJWT({ portee: 'couple' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(options.emetteur ?? EMETTEUR)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(sub)
    .setJti(options.jti ?? randomUUID())
    .setIssuedAt(maintenant)
    .setExpirationTime(maintenant + (options.expireDansSecondes ?? 3600))
    .sign(CLES.clePrivee);
}
