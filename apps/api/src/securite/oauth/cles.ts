import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

export interface PaireDeCles {
  clePrivee: KeyObject;
  clePublique: KeyObject;
}

/**
 * Paire RSA de signature. À générer une fois et à conserver hors du dépôt :
 * la clé privée dans un gestionnaire de secrets, la publique exposée en JWKS.
 * Régénérer la paire invalide tous les jetons d'accès en circulation — ce qui
 * est précisément l'effet recherché en cas de compromission.
 */
export function genererPaire(): PaireDeCles {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return { clePrivee: privateKey, clePublique: publicKey };
}

export function chargerPaire(pemPrivee: string): PaireDeCles {
  const clePrivee = createPrivateKey(pemPrivee);
  return { clePrivee, clePublique: createPublicKey(clePrivee) };
}
