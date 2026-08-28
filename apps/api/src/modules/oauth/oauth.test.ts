/** Authentification OAuth2 : les garanties 401/403, et le flux complet. */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { creerServeur } from '../../serveur.ts';
import { creerTransportFactice } from '../notifications/transport.ts';
import { defiDepuisVerificateur } from '../../securite/oauth/serveurAutorisation.ts';
import {
  creerDepotDeTest,
  creerDepotOAuthDeTest,
} from '../../tests/depotDeTest.ts';
import { CONFIG_OAUTH, COUPLE_ID, entete, ROCHAMBEAU } from '../../tests/aide.ts';
import {
  AUDIENCE,
  CLIENT_MOBILE,
  EMETTEUR,
  jetonDeTest,
} from '../../tests/clesDeTest.ts';

const COURRIEL = 'rochambeau@exemple.test';
const MOT_DE_PASSE = 'un-mot-de-passe-assez-long';

async function monter() {
  const depot = await creerDepotDeTest();
  const depotOAuth = await creerDepotOAuthDeTest();
  const { app } = await creerServeur({
    depot,
    depotOAuth,
    transport: creerTransportFactice(),
    oauth: CONFIG_OAUTH,
  });
  return { app, depot, depotOAuth };
}

function pkce() {
  const verificateur = randomBytes(32).toString('base64url');
  return { verificateur, defi: defiDepuisVerificateur(verificateur) };
}

async function creerCompte(app: Awaited<ReturnType<typeof monter>>['app']) {
  return app.inject({
    method: 'POST',
    url: '/comptes',
    payload: { courriel: COURRIEL, motDePasse: MOT_DE_PASSE },
  });
}

async function obtenirCode(
  app: Awaited<ReturnType<typeof monter>>['app'],
  defi: string,
  motDePasse = MOT_DE_PASSE,
) {
  return app.inject({
    method: 'POST',
    url: '/oauth/authorize',
    payload: {
      courriel: COURRIEL,
      motDePasse,
      client_id: CLIENT_MOBILE,
      code_challenge: defi,
      code_challenge_method: 'S256',
    },
  });
}

function echanger(
  app: Awaited<ReturnType<typeof monter>>['app'],
  code: string,
  verificateur: string,
) {
  return app.inject({
    method: 'POST',
    url: '/oauth/token',
    payload: {
      grant_type: 'authorization_code',
      code,
      code_verifier: verificateur,
      client_id: CLIENT_MOBILE,
    },
  });
}

describe('flux authorization code + PKCE', () => {
  it('délivre un jeton utilisable de bout en bout', async () => {
    const { app } = await monter();
    await creerCompte(app);

    const { verificateur, defi } = pkce();
    const autorisation = await obtenirCode(app, defi);
    expect(autorisation.statusCode).toBe(201);

    const jetons = await echanger(app, autorisation.json().code, verificateur);
    expect(jetons.statusCode).toBe(200);

    const corps = jetons.json();
    expect(corps.token_type).toBe('Bearer');
    expect(corps.access_token.split('.')).toHaveLength(3);
    expect(corps.refresh_token).toBeTruthy();
    expect(corps.expires_in).toBeGreaterThan(0);

    const moi = await app.inject({
      method: 'GET',
      url: '/moi',
      headers: { authorization: `Bearer ${corps.access_token}` },
    });
    expect(moi.statusCode).toBe(200);
    expect(moi.json().partenaireId).toBeTruthy();
  });

  it('refuse un vérificateur PKCE qui ne correspond pas au défi', async () => {
    const { app } = await monter();
    await creerCompte(app);

    const { defi } = pkce();
    const autre = pkce();
    const autorisation = await obtenirCode(app, defi);

    const jetons = await echanger(
      app,
      autorisation.json().code,
      autre.verificateur,
    );
    expect(jetons.statusCode).toBe(400);
    expect(jetons.json().motif).toBe('pkce_invalide');
  });

  it('refuse de rejouer un code déjà échangé', async () => {
    const { app } = await monter();
    await creerCompte(app);

    const { verificateur, defi } = pkce();
    const code = (await obtenirCode(app, defi)).json().code;

    expect((await echanger(app, code, verificateur)).statusCode).toBe(200);
    const rejeu = await echanger(app, code, verificateur);
    expect(rejeu.statusCode).toBe(400);
    expect(rejeu.json().motif).toBe('code_deja_utilise');
  });

  it('refuse un mauvais mot de passe et un client inconnu', async () => {
    const { app } = await monter();
    await creerCompte(app);
    const { defi } = pkce();

    expect((await obtenirCode(app, defi, 'mauvais-mot-de-passe')).statusCode).toBe(
      401,
    );

    const clientInconnu = await app.inject({
      method: 'POST',
      url: '/oauth/authorize',
      payload: {
        courriel: COURRIEL,
        motDePasse: MOT_DE_PASSE,
        client_id: 'client-pirate',
        code_challenge: defi,
      },
    });
    expect(clientInconnu.statusCode).toBe(401);
    expect(clientInconnu.json().erreur).toBe('invalid_client');
  });

  it('n’accepte que la méthode S256', async () => {
    const { app } = await monter();
    await creerCompte(app);

    const reponse = await app.inject({
      method: 'POST',
      url: '/oauth/authorize',
      payload: {
        courriel: COURRIEL,
        motDePasse: MOT_DE_PASSE,
        client_id: CLIENT_MOBILE,
        code_challenge: 'peu-importe',
        code_challenge_method: 'plain',
      },
    });
    expect(reponse.statusCode).toBe(400);
  });

  it('ne range jamais le mot de passe en clair', async () => {
    const { app, depotOAuth } = await monter();
    await creerCompte(app);

    const compte = await depotOAuth.comptes.parCourriel(COURRIEL);
    expect(JSON.stringify(compte)).not.toContain(MOT_DE_PASSE);
    expect(compte?.verificateur.empreinte).toBeTruthy();
  });
});

describe('rotation des jetons de rafraîchissement', () => {
  async function session(app: Awaited<ReturnType<typeof monter>>['app']) {
    await creerCompte(app);
    const { verificateur, defi } = pkce();
    const code = (await obtenirCode(app, defi)).json().code;
    return (await echanger(app, code, verificateur)).json();
  }

  const rafraichir = (
    app: Awaited<ReturnType<typeof monter>>['app'],
    refreshToken: string,
  ) =>
    app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_MOBILE,
      },
    });

  it('rend un nouveau couple de jetons', async () => {
    const { app } = await monter();
    const premiers = await session(app);

    const seconds = await rafraichir(app, premiers.refresh_token);
    expect(seconds.statusCode).toBe(200);
    expect(seconds.json().refresh_token).not.toBe(premiers.refresh_token);
  });

  it('révoque toute la famille quand un jeton déjà tourné est rejoué', async () => {
    const { app } = await monter();
    const premiers = await session(app);

    const seconds = (await rafraichir(app, premiers.refresh_token)).json();

    // Rejeu du premier : signe d'un vol.
    const rejeu = await rafraichir(app, premiers.refresh_token);
    expect(rejeu.statusCode).toBe(400);
    expect(rejeu.json().motif).toBe('rafraichissement_reutilise');

    // Et le jeton légitime tombe avec la famille : mieux vaut reconnecter tout
    // le monde que laisser un voleur poursuivre la rotation.
    const apres = await rafraichir(app, seconds.refresh_token);
    expect(apres.statusCode).toBe(400);
  });

  it('refuse un jeton de rafraîchissement inventé', async () => {
    const { app } = await monter();
    await session(app);
    expect((await rafraichir(app, 'jeton-invente')).statusCode).toBe(400);
  });
});

describe('révocation', () => {
  it('invalide immédiatement le jeton d’accès', async () => {
    const { app } = await monter();
    await creerCompte(app);
    const { verificateur, defi } = pkce();
    const code = (await obtenirCode(app, defi)).json().code;
    const jetons = (await echanger(app, code, verificateur)).json();

    const avant = await app.inject({
      method: 'GET',
      url: '/moi',
      headers: { authorization: `Bearer ${jetons.access_token}` },
    });
    expect(avant.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: '/oauth/revoke',
      headers: { authorization: `Bearer ${jetons.access_token}` },
      payload: { refresh_token: jetons.refresh_token },
    });

    const apres = await app.inject({
      method: 'GET',
      url: '/moi',
      headers: { authorization: `Bearer ${jetons.access_token}` },
    });
    expect(apres.statusCode).toBe(401);
  });
});

describe('401 : ce qui ne vaut pas jeton', () => {
  const cas: [string, () => Promise<string | undefined>][] = [
    ['aucun en-tête', async () => undefined],
    ['chaîne quelconque', async () => 'pas-un-jeton'],
    [
      'jeton expiré',
      async () => jetonDeTest(ROCHAMBEAU, { expireDansSecondes: -10 }),
    ],
    [
      'émetteur inattendu',
      async () => jetonDeTest(ROCHAMBEAU, { emetteur: 'https://ailleurs.test' }),
    ],
    [
      'audience inattendue',
      async () => jetonDeTest(ROCHAMBEAU, { audience: 'une-autre-api' }),
    ],
  ];

  for (const [libelle, produire] of cas) {
    it(`refuse : ${libelle}`, async () => {
      const { app } = await monter();
      const jeton = await produire();

      const reponse = await app.inject({
        method: 'GET',
        url: `/couples/${COUPLE_ID}/axes`,
        ...(jeton ? { headers: { authorization: `Bearer ${jeton}` } } : {}),
      });
      expect(reponse.statusCode).toBe(401);
    });
  }

  it('refuse un jeton signé par une autre clé', async () => {
    const { app } = await monter();

    // Un serveur monté sur sa propre paire éphémère : son jeton ne vaut rien ici.
    const etranger = await creerServeur({ transport: creerTransportFactice() });
    await etranger.app.inject({
      method: 'POST',
      url: '/comptes',
      payload: { courriel: COURRIEL, motDePasse: MOT_DE_PASSE },
    });
    const { verificateur, defi } = pkce();
    const code = (
      await etranger.app.inject({
        method: 'POST',
        url: '/oauth/authorize',
        payload: {
          courriel: COURRIEL,
          motDePasse: MOT_DE_PASSE,
          client_id: 'lonlonbenu-mobile',
          code_challenge: defi,
        },
      })
    ).json().code;
    const jetons = (
      await etranger.app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          code_verifier: verificateur,
          client_id: 'lonlonbenu-mobile',
        },
      })
    ).json();

    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: { authorization: `Bearer ${jetons.access_token}` },
    });
    expect(reponse.statusCode).toBe(401);
  });
});

describe('JWKS', () => {
  it('publie une clé publique de vérification, jamais la privée', async () => {
    const { app } = await monter();
    const reponse = await app.inject({
      method: 'GET',
      url: '/.well-known/jwks.json',
    });

    expect(reponse.statusCode).toBe(200);
    const cle = reponse.json().keys[0];
    expect(cle.kty).toBe('RSA');
    expect(cle.alg).toBe('RS256');
    // `d` est l'exposant privé : sa présence signifierait la fuite de la clé.
    expect(cle.d).toBeUndefined();
  });

  it('annonce l’émetteur et l’audience attendus', async () => {
    expect(CONFIG_OAUTH.emetteur).toBe(EMETTEUR);
    expect(CONFIG_OAUTH.audience).toBe(AUDIENCE);
  });
});

describe('403 : jeton valide, mais pas ce couple', () => {
  it('distingue bien 401 et 403', async () => {
    const { app } = await monter();

    const sansJeton = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
    });
    const avecJetonEtranger = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
    });

    expect(sansJeton.statusCode).toBe(401);
    // Rochambeau existe et son jeton est valide, mais aucun couple ne lui est
    // rattaché dans ce serveur-ci.
    expect(avecJetonEtranger.statusCode).toBe(403);
    expect(avecJetonEtranger.json().motif).toBe('non_membre');
  });
});
