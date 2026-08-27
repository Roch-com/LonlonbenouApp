/**
 * Serveur d'autorisation OAuth2.
 *
 * Flux implémenté : **Authorization Code + PKCE (S256)**, celui que le RFC 8252
 * impose aux applications mobiles — un client public ne peut pas garder de
 * secret, donc l'échange du code doit être lié à un vérificateur que seul
 * l'appareil qui a demandé le code connaît.
 *
 * Jetons d'accès : JWT signés en **RS256**, courts (10 min), porteurs de `iss`,
 * `aud`, `sub`, `exp`, `jti` et du couple. Vérifiés par signature, émetteur,
 * audience, expiration **et** liste de révocation.
 *
 * Jetons de rafraîchissement : opaques, stockés **hachés**, à usage unique et
 * **rotatifs**. Rejouer un jeton déjà tourné est le signe d'un vol : toute la
 * famille est alors révoquée d'un coup. C'est la recommandation du BCP OAuth2
 * pour les clients publics, et c'est ce qui évite qu'un jeton volé serve
 * indéfiniment.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { scrypt } from '@noble/hashes/scrypt.js';
import { SignJWT, jwtVerify, exportJWK, type JWK } from 'jose';
import type { KeyObject } from 'node:crypto';
import {
  decoderBase64,
  defiDepuisVerificateur,
  encoderBase64,
} from '@lonlonbenu/shared';
import type { Compte, DepotOAuth } from './depotOAuth.ts';

export const DUREE_CODE_MS = 60_000;
export const DUREE_ACCES_MS = 10 * 60_000;
export const DUREE_RAFRAICHISSEMENT_MS = 30 * 24 * 3_600_000;

const SCRYPT = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 };

export interface ConfigurationOAuth {
  emetteur: string;
  audience: string;
  clientsAutorises: readonly string[];
  clePrivee: KeyObject;
  clePublique: KeyObject;
}

export interface ChargeAcces {
  partenaireId: string;
  coupleId?: string;
  jti: string;
  portee: string;
}

export type MotifOAuth =
  | 'identifiants_invalides'
  | 'client_inconnu'
  | 'code_invalide'
  | 'code_expire'
  | 'code_deja_utilise'
  | 'pkce_invalide'
  | 'rafraichissement_invalide'
  | 'rafraichissement_reutilise'
  | 'rafraichissement_expire';

export interface Jetons {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ServeurAutorisation {
  creerCompte(courriel: string, motDePasse: string): Promise<Compte>;
  /** Étape 1 : authentifier, puis rendre un code lié au défi PKCE. */
  autoriser(demande: {
    courriel: string;
    motDePasse: string;
    clientId: string;
    defiPkce: string;
    portee?: string;
  }): Promise<{ ok: true; code: string } | { ok: false; motif: MotifOAuth }>;
  /** Étape 2 : échanger le code contre des jetons, vérificateur PKCE à l'appui. */
  echangerLeCode(demande: {
    code: string;
    verificateurPkce: string;
    clientId: string;
    coupleId?: string;
  }): Promise<{ ok: true; jetons: Jetons } | { ok: false; motif: MotifOAuth }>;
  rafraichir(demande: {
    refreshToken: string;
    clientId: string;
    coupleId?: string;
  }): Promise<{ ok: true; jetons: Jetons } | { ok: false; motif: MotifOAuth }>;
  /** Révoque le jeton d'accès courant et la famille de rafraîchissement. */
  revoquer(jti: string, refreshToken?: string): Promise<void>;
  verifierAcces(jeton: string): Promise<ChargeAcces | undefined>;
  jwks(): Promise<{ keys: JWK[] }>;
}

function empreinte(valeur: string): string {
  return createHash('sha256').update(valeur).digest('base64url');
}

// Le calcul du défi vient de `@lonlonbenu/shared` : le mobile et le serveur
// exécutent la même fonction, vérifiée par le vecteur du RFC 7636.
export { defiDepuisVerificateur };

function memeChaine(a: string, b: string): boolean {
  const ta = Buffer.from(a);
  const tb = Buffer.from(b);
  return ta.length === tb.length && timingSafeEqual(ta, tb);
}

export function creerServeurAutorisation(
  depot: DepotOAuth,
  config: ConfigurationOAuth,
): ServeurAutorisation {
  const clientConnu = (clientId: string) =>
    config.clientsAutorises.includes(clientId);

  async function emettreJetons(
    compte: Compte,
    clientId: string,
    portee: string,
    coupleId: string | undefined,
    famille: string,
  ): Promise<Jetons> {
    const maintenant = Date.now();
    const jti = randomUUID();

    const access = await new SignJWT({ portee, ...(coupleId ? { coupleId } : {}) })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(config.emetteur)
      .setAudience(config.audience)
      .setSubject(compte.id)
      .setJti(jti)
      .setIssuedAt(Math.floor(maintenant / 1000))
      .setExpirationTime(Math.floor((maintenant + DUREE_ACCES_MS) / 1000))
      .sign(config.clePrivee);

    const refresh = randomBytes(32).toString('base64url');
    await depot.rafraichissements.enregistrer({
      empreinte: empreinte(refresh),
      famille,
      compteId: compte.id,
      clientId,
      portee,
      emisLe: new Date(maintenant).toISOString(),
      expireLe: new Date(maintenant + DUREE_RAFRAICHISSEMENT_MS).toISOString(),
    });

    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: Math.floor(DUREE_ACCES_MS / 1000),
      refresh_token: refresh,
      scope: portee,
    };
  }

  return {
    async creerCompte(courriel, motDePasse) {
      const sel = randomBytes(16);
      const derive = scrypt(motDePasse, sel, SCRYPT);
      const compte: Compte = {
        id: randomUUID(),
        courriel: courriel.trim().toLowerCase(),
        verificateur: {
          sel: encoderBase64(sel),
          empreinte: encoderBase64(derive),
          n: SCRYPT.N,
          r: SCRYPT.r,
          p: SCRYPT.p,
        },
      };
      await depot.comptes.enregistrer(compte);
      return compte;
    },

    async autoriser({
      courriel,
      motDePasse,
      clientId,
      defiPkce,
      portee = 'couple',
    }) {
      if (!clientConnu(clientId)) return { ok: false, motif: 'client_inconnu' };

      const compte = await depot.comptes.parCourriel(courriel.trim().toLowerCase());
      if (!compte) {
        // Dérivation malgré tout : sans elle, l'écart de durée révélerait
        // quels courriels existent.
        scrypt(motDePasse, randomBytes(16), SCRYPT);
        return { ok: false, motif: 'identifiants_invalides' };
      }

      const derive = scrypt(motDePasse, decoderBase64(compte.verificateur.sel), {
        N: compte.verificateur.n,
        r: compte.verificateur.r,
        p: compte.verificateur.p,
        dkLen: 32,
      });
      if (!memeChaine(encoderBase64(derive), compte.verificateur.empreinte)) {
        return { ok: false, motif: 'identifiants_invalides' };
      }

      const code = randomBytes(32).toString('base64url');
      await depot.codes.enregistrer({
        code,
        compteId: compte.id,
        clientId,
        defiPkce,
        portee,
        expireLe: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
      });
      return { ok: true, code };
    },

    async echangerLeCode({ code, verificateurPkce, clientId, coupleId }) {
      const enregistre = await depot.codes.parCode(code);
      if (!enregistre || enregistre.clientId !== clientId) {
        return { ok: false, motif: 'code_invalide' };
      }
      if (enregistre.consommeLe) return { ok: false, motif: 'code_deja_utilise' };
      if (Date.now() > Date.parse(enregistre.expireLe)) {
        return { ok: false, motif: 'code_expire' };
      }
      if (
        !memeChaine(defiDepuisVerificateur(verificateurPkce), enregistre.defiPkce)
      ) {
        return { ok: false, motif: 'pkce_invalide' };
      }

      await depot.codes.enregistrer({
        ...enregistre,
        consommeLe: new Date().toISOString(),
      });

      const compte = await depot.comptes.parId(enregistre.compteId);
      if (!compte) return { ok: false, motif: 'code_invalide' };

      return {
        ok: true,
        jetons: await emettreJetons(
          compte,
          clientId,
          enregistre.portee,
          coupleId,
          randomUUID(),
        ),
      };
    },

    async rafraichir({ refreshToken, clientId, coupleId }) {
      const enregistre = await depot.rafraichissements.parEmpreinte(
        empreinte(refreshToken),
      );
      if (!enregistre || enregistre.clientId !== clientId) {
        return { ok: false, motif: 'rafraichissement_invalide' };
      }
      if (enregistre.revoqueLe) {
        return { ok: false, motif: 'rafraichissement_invalide' };
      }

      if (enregistre.utiliseLe) {
        // Rejeu d'un maillon déjà tourné : on considère la famille compromise.
        await depot.rafraichissements.revoquerLaFamille(
          enregistre.famille,
          new Date().toISOString(),
        );
        return { ok: false, motif: 'rafraichissement_reutilise' };
      }
      if (Date.now() > Date.parse(enregistre.expireLe)) {
        return { ok: false, motif: 'rafraichissement_expire' };
      }

      await depot.rafraichissements.enregistrer({
        ...enregistre,
        utiliseLe: new Date().toISOString(),
      });

      const compte = await depot.comptes.parId(enregistre.compteId);
      if (!compte) return { ok: false, motif: 'rafraichissement_invalide' };

      return {
        ok: true,
        jetons: await emettreJetons(
          compte,
          clientId,
          enregistre.portee,
          coupleId,
          enregistre.famille,
        ),
      };
    },

    async revoquer(jti, refreshToken) {
      await depot.revocations.revoquer(
        jti,
        new Date(Date.now() + DUREE_ACCES_MS).toISOString(),
      );
      if (!refreshToken) return;

      const enregistre = await depot.rafraichissements.parEmpreinte(
        empreinte(refreshToken),
      );
      if (enregistre) {
        await depot.rafraichissements.revoquerLaFamille(
          enregistre.famille,
          new Date().toISOString(),
        );
      }
    },

    async verifierAcces(jeton) {
      try {
        const { payload } = await jwtVerify(jeton, config.clePublique, {
          issuer: config.emetteur,
          audience: config.audience,
          algorithms: ['RS256'],
        });

        const jti = payload.jti;
        if (!jti || (await depot.revocations.estRevoque(jti))) return undefined;

        return {
          partenaireId: String(payload.sub),
          coupleId: payload['coupleId'] as string | undefined,
          jti,
          portee: String(payload['portee'] ?? ''),
        };
      } catch {
        return undefined;
      }
    },

    async jwks() {
      const cle = await exportJWK(config.clePublique);
      return { keys: [{ ...cle, use: 'sig', alg: 'RS256' }] };
    },
  };
}
