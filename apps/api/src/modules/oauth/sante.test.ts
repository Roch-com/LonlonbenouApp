/**
 * La santé de la base, séparée de celle du processus.
 *
 * Écrit après une panne où `/sante` répondait « ok » pendant que la base
 * refusait toute connexion : l'hébergeur croyait tout normal, et le seul
 * symptôme était un 500 sur les routes qui s'en servent.
 */
import { describe, expect, it } from 'vitest';
import { monterServeur } from '../../tests/aide.ts';

describe('la santé', () => {
  it('sépare le processus de la base', async () => {
    const { app } = await monterServeur();

    const processus = await app.inject({ method: 'GET', url: '/sante' });
    expect(processus.statusCode).toBe(200);
    expect(processus.json()).toEqual({ etat: 'ok' });
  });

  it('dit la base injoignable, et nomme la cause', async () => {
    const { app } = await monterServeur({
      verifierLaBase: async () => {
        throw Object.assign(new Error('password authentication failed'), {
          code: '28P01',
        });
      },
    });

    const reponse = await app.inject({ method: 'GET', url: '/sante/base' });
    expect(reponse.statusCode).toBe(503);
    expect(reponse.json()).toEqual({
      base: 'injoignable',
      cause: 'mot_de_passe_refuse',
    });
  });

  it('ne laisse jamais filer la chaîne de connexion', async () => {
    const { app } = await monterServeur({
      verifierLaBase: async () => {
        throw Object.assign(
          new Error('connect ECONNREFUSED ep-secret-1234.eu-central-1.aws.neon.tech:5432'),
          { code: 'ECONNREFUSED' },
        );
      },
    });

    const reponse = await app.inject({ method: 'GET', url: '/sante/base' });
    expect(reponse.statusCode).toBe(503);
    expect(reponse.body).not.toContain('neon.tech');
    expect(reponse.json().cause).toBe('connexion_refusee');
  });

  it('répond ok quand la base répond', async () => {
    const { app } = await monterServeur({ verifierLaBase: async () => undefined });
    const reponse = await app.inject({ method: 'GET', url: '/sante/base' });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ base: 'ok' });
  });
});
