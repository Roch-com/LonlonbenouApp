/**
 * Création de compte : les cas ordinaires qui ne doivent jamais ressembler à
 * une panne.
 */
import { describe, expect, it } from 'vitest';
import { creerServeur } from '../../serveur.ts';
import { creerDepotDeTest } from '../../tests/depotDeTest.ts';
import { creerTransportFactice } from '../notifications/transport.ts';

async function monter() {
  const depot = await creerDepotDeTest();
  const { app } = await creerServeur({
    depot,
    transport: creerTransportFactice(),
  });
  return app;
}

const IDENTIFIANTS = {
  courriel: 'gaelle@exemple.test',
  motDePasse: 'un-mot-de-passe-assez-long',
};

describe('création de compte', () => {
  it('crée le compte et rend son identifiant', async () => {
    const app = await monter();
    const reponse = await app.inject({
      method: 'POST',
      url: '/comptes',
      payload: IDENTIFIANTS,
    });

    expect(reponse.statusCode).toBe(201);
    expect(reponse.json().partenaireId).toBeTruthy();
  });

  it('refuse un courriel déjà pris par un 409, jamais par un 500', async () => {
    const app = await monter();
    await app.inject({ method: 'POST', url: '/comptes', payload: IDENTIFIANTS });

    const doublon = await app.inject({
      method: 'POST',
      url: '/comptes',
      payload: IDENTIFIANTS,
    });

    // Le cas le plus banal qui soit : il doit se dire, pas ressembler à une
    // panne. Un 500 laissait la personne devant « le serveur n'a pas pu
    // répondre », sans deviner qu'il lui suffisait de se connecter.
    expect(doublon.statusCode).toBe(409);
    expect(doublon.json().motif).toBe('courriel_deja_pris');
  });

  it('ne laisse échapper ni nom de table ni contrainte SQL', async () => {
    const app = await monter();
    await app.inject({ method: 'POST', url: '/comptes', payload: IDENTIFIANTS });

    const doublon = await app.inject({
      method: 'POST',
      url: '/comptes',
      payload: IDENTIFIANTS,
    });

    // La contrainte d'unicité remontait autrefois en clair, avec son nom :
    // illisible pour la personne, et une carte du schéma pour qui attaque.
    const corps = doublon.body;
    expect(corps).not.toContain('constraint');
    expect(corps).not.toContain('comptes_courriel_key');
    expect(corps).not.toContain('duplicate key');
  });

  it('reconnaît le même courriel malgré casse et espaces', async () => {
    const app = await monter();
    await app.inject({ method: 'POST', url: '/comptes', payload: IDENTIFIANTS });

    const variante = await app.inject({
      method: 'POST',
      url: '/comptes',
      payload: { ...IDENTIFIANTS, courriel: '  Gaelle@Exemple.TEST ' },
    });

    // Sans normalisation, la même personne se retrouverait avec deux comptes
    // et ne saurait plus lequel porte son couple.
    expect(variante.statusCode).toBe(409);
  });

  it('exige dix caractères de mot de passe', async () => {
    const app = await monter();
    const reponse = await app.inject({
      method: 'POST',
      url: '/comptes',
      payload: { courriel: 'court@exemple.test', motDePasse: 'court' },
    });

    expect(reponse.statusCode).toBe(400);
  });
});
