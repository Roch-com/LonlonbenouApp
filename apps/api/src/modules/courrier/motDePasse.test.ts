/**
 * Réinitialisation de mot de passe, de bout en bout.
 *
 * Le point le plus délicat n'est pas le code lui-même mais ce que les réponses
 * laissent deviner : sur une application de couple, savoir qu'une adresse a un
 * compte est déjà une information de trop.
 */
import { describe, expect, it } from 'vitest';
import { normaliserCode } from '@lonlonbenu/shared';
import { creerServeur } from '../../serveur.ts';
import { creerDepotDeTest } from '../../tests/depotDeTest.ts';
import { creerTransportFactice } from '../notifications/transport.ts';
import { creerCourrierFactice } from './courrier.ts';

const COURRIEL = 'gaelle@exemple.test';
const ANCIEN = 'ancien-mot-de-passe';
const NOUVEAU = 'nouveau-mot-de-passe';
const DEFI = 'x'.repeat(43);

async function monter() {
  const depot = await creerDepotDeTest();
  const courrier = creerCourrierFactice();
  const { app } = await creerServeur({
    depot,
    transport: creerTransportFactice(),
    courrier,
  });
  await app.inject({
    method: 'POST',
    url: '/comptes',
    payload: { courriel: COURRIEL, motDePasse: ANCIEN },
  });
  return { app, courrier };
}

/** Récupère le code depuis le courriel factice. */
function codeDuDernierCourriel(
  courrier: ReturnType<typeof creerCourrierFactice>,
): string | undefined {
  const dernier = courrier.messages.at(-1);
  const trouve = dernier?.corps.match(/Votre code : ([A-Z0-9 -]+)/);
  return trouve ? normaliserCode(trouve[1]!) : undefined;
}

async function demander(app: Awaited<ReturnType<typeof monter>>['app']) {
  return app.inject({
    method: 'POST',
    url: '/mot-de-passe/demandes',
    payload: { courriel: COURRIEL },
  });
}

async function seConnecter(
  app: Awaited<ReturnType<typeof monter>>['app'],
  motDePasse: string,
) {
  return app.inject({
    method: 'POST',
    url: '/oauth/authorize',
    payload: {
      courriel: COURRIEL,
      motDePasse,
      client_id: 'lonlonbenu-mobile',
      code_challenge: DEFI,
      code_challenge_method: 'S256',
    },
  });
}

describe('demande de réinitialisation', () => {
  it('envoie un code au compte existant', async () => {
    const { app, courrier } = await monter();

    const reponse = await demander(app);

    expect(reponse.statusCode).toBe(202);
    expect(courrier.messages).toHaveLength(1);
    expect(codeDuDernierCourriel(courrier)).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('répond exactement pareil pour une adresse inconnue', async () => {
    const { app, courrier } = await monter();

    const connue = await demander(app);
    const inconnue = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/demandes',
      payload: { courriel: 'personne@exemple.test' },
    });

    // Distinguer les deux ferait de cette route un moyen de savoir qui a un
    // compte — sur une app de couple, l'information est déjà de trop.
    expect(inconnue.statusCode).toBe(connue.statusCode);
    expect(inconnue.body).toBe(connue.body);
    expect(courrier.messages).toHaveLength(1);
  });

  it('ne laisse qu’une demande valable à la fois', async () => {
    const { app, courrier } = await monter();

    await demander(app);
    const premier = codeDuDernierCourriel(courrier)!;
    await demander(app);

    // Le premier code doit être mort : sinon plusieurs codes circuleraient en
    // parallèle, et le plus ancien resterait ouvert indéfiniment.
    const avecLAncien = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code: premier, motDePasse: NOUVEAU },
    });
    expect(avecLAncien.statusCode).toBe(400);
  });
});

describe('confirmation', () => {
  it('change le mot de passe et laisse entrer avec le nouveau', async () => {
    const { app, courrier } = await monter();
    await demander(app);

    const confirmation = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code: codeDuDernierCourriel(courrier), motDePasse: NOUVEAU },
    });
    expect(confirmation.statusCode).toBe(200);
    expect((await seConnecter(app, NOUVEAU)).statusCode).toBe(201);
  });

  it('rend l’ancien mot de passe inopérant', async () => {
    const { app, courrier } = await monter();
    await demander(app);
    await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code: codeDuDernierCourriel(courrier), motDePasse: NOUVEAU },
    });

    expect((await seConnecter(app, ANCIEN)).statusCode).toBe(401);
  });

  it('ne se rejoue pas', async () => {
    const { app, courrier } = await monter();
    await demander(app);
    const code = codeDuDernierCourriel(courrier);

    await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code, motDePasse: NOUVEAU },
    });
    const rejeu = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code, motDePasse: 'encore-un-autre-mot' },
    });

    // Un code intercepté ne doit pas rester utilisable après coup.
    expect(rejeu.statusCode).toBe(400);
    expect(rejeu.json().motif).toBe('deja_utilisee');
  });

  it('tolère la casse et les espaces à la recopie', async () => {
    const { app, courrier } = await monter();
    await demander(app);
    const code = codeDuDernierCourriel(courrier)!;

    const reponse = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: {
        code: ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `,
        motDePasse: NOUVEAU,
      },
    });
    expect(reponse.statusCode).toBe(200);
  });

  it('refuse un mot de passe trop court', async () => {
    const { app, courrier } = await monter();
    await demander(app);

    const reponse = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code: codeDuDernierCourriel(courrier), motDePasse: 'court' },
    });
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('mot_de_passe_trop_court');
  });

  it('refuse un code inventé', async () => {
    const { app } = await monter();
    const reponse = await app.inject({
      method: 'POST',
      url: '/mot-de-passe/reinitialisations',
      payload: { code: 'AAAA2222', motDePasse: NOUVEAU },
    });
    expect(reponse.statusCode).toBe(400);
  });
});
