/**
 * Date d'origine du couple.
 *
 * Le serveur la fixe au jour de l'appairage. Ce n'est presque jamais la bonne :
 * un couple ne commence pas le jour où il installe une application, et c'est
 * pourtant le premier chiffre que les deux voient en ouvrant l'app.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  GAELLE,
  INTRUS,
  ROCHAMBEAU,
  entete,
  monterServeur,
} from '../../tests/aide.ts';

describe('correction de la date d’origine', () => {
  it('accepte une date passée et la rend au client', async () => {
    const { app } = await monterServeur();

    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/depuis`,
      headers: entete(ROCHAMBEAU),
      payload: { depuis: '2024-09-14' },
    });

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json().depuis).toBe('2024-09-14');
  });

  it('la rend ensuite sur /moi, aux deux partenaires', async () => {
    const { app } = await monterServeur();
    await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/depuis`,
      headers: entete(ROCHAMBEAU),
      payload: { depuis: '2024-09-14' },
    });

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const moi = await app.inject({
        method: 'GET',
        url: '/moi',
        headers: entete(qui),
      });
      // Une donnée de couple : les deux la voient identiquement, sans quoi le
      // compteur afficherait deux durées différentes sur les deux téléphones.
      expect(moi.json().depuis).toBe('2024-09-14');
    }
  });

  it('refuse une date future', async () => {
    const { app } = await monterServeur();
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/depuis`,
      headers: entete(ROCHAMBEAU),
      payload: { depuis: demain },
    });

    // Sans ce garde-fou, le compteur afficherait « ensemble depuis -12 jours ».
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('date_future');
  });

  it('refuse ce qui n’est pas une date', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/depuis`,
      headers: entete(ROCHAMBEAU),
      payload: { depuis: '14 septembre 2024' },
    });
    expect(reponse.statusCode).toBe(400);
  });

  it('refuse quelqu’un qui n’est pas du couple', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/depuis`,
      headers: entete(INTRUS),
      payload: { depuis: '2024-09-14' },
    });
    expect(reponse.statusCode).toBe(403);
  });
});
