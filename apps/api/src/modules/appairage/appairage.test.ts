/** Exigence 3 — protocole d'appairage rejoué côté serveur. */
import { describe, expect, it } from 'vitest';
import { ESSAIS_MAX } from '@lonlonbenu/shared';
import { creerDepotDeTest } from '../../tests/depotDeTest.ts';
import { creerServeur } from '../../serveur.ts';
import { creerTransportFactice } from '../notifications/transport.ts';
import { CONFIG_OAUTH, entete, GAELLE, ROCHAMBEAU } from '../../tests/aide.ts';

async function monter() {
  const depot = await creerDepotDeTest();
  const { app } = creerServeur({
    depot,
    transport: creerTransportFactice(),
    oauth: CONFIG_OAUTH,
  });
  return { app, depot };
}

async function emettre(app: Awaited<ReturnType<typeof monter>>['app']) {
  const reponse = await app.inject({
    method: 'POST',
    url: '/appairages',
    headers: entete(ROCHAMBEAU),
    payload: { prenom: 'Rochambeau' },
  });
  return reponse.json() as {
    invitationId: string;
    code: string;
    codeFormate: string;
    expireDansSecondes: number;
  };
}

function accepter(
  app: Awaited<ReturnType<typeof monter>>['app'],
  invitationId: string,
  code: string,
  partenaireId = GAELLE,
) {
  return app.inject({
    method: 'POST',
    url: `/appairages/${invitationId}/acceptation`,
    headers: entete(partenaireId),
    payload: { prenom: 'Gaëlle', code },
  });
}

describe('émission', () => {
  it('rend le code une seule fois et ne le range jamais en clair', async () => {
    const { app, depot } = await monter();
    const emise = await emettre(app);

    expect(emise.code).toHaveLength(8);
    expect(emise.codeFormate).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(emise.expireDansSecondes).toBeGreaterThan(0);

    const stockee = await depot.invitations.parId(emise.invitationId);
    expect(JSON.stringify(stockee)).not.toContain(emise.code);
    expect(stockee?.invitation.verificateur).toBeTruthy();
  });
});

describe('vérification', () => {
  it('appaire sur le bon code et rend un jeton utilisable', async () => {
    const { app } = await monter();
    const emise = await emettre(app);

    const reponse = await accepter(app, emise.invitationId, emise.code);
    expect(reponse.statusCode).toBe(201);

    const { coupleId } = reponse.json();
    expect(coupleId).toBeTruthy();

    // Le jeton existant vaut immédiatement pour le couple fraîchement créé :
    // l'appartenance est résolue en base, pas portée par le jeton.
    const axes = await app.inject({
      method: 'GET',
      url: `/couples/${coupleId}/axes`,
      headers: entete(GAELLE),
    });
    // Refusé parce que le consentement n'est pas encore donné, pas parce que
    // l'identité est invalide : c'est bien l'opt-in symétrique qui bloque.
    expect(axes.json().motif).toBe('partage_inactif');
  });

  it('tolère minuscules, espaces et tirets', async () => {
    const { app } = await monter();
    const emise = await emettre(app);
    const brouille = ` ${emise.code.slice(0, 4).toLowerCase()}-${emise.code.slice(4)} `;

    expect((await accepter(app, emise.invitationId, brouille)).statusCode).toBe(201);
  });

  it('persiste chaque tentative ratée', async () => {
    const { app, depot } = await monter();
    const emise = await emettre(app);

    await accepter(app, emise.invitationId, 'AAAAAAAA');
    const apresUnEssai = await depot.invitations.parId(emise.invitationId);
    expect(apresUnEssai?.invitation.essais).toBe(1);

    await accepter(app, emise.invitationId, 'AAAAAAAA');
    const apresDeux = await depot.invitations.parId(emise.invitationId);
    expect(apresDeux?.invitation.essais).toBe(2);
  });

  it('brûle le code après cinq erreurs, même si le bon arrive ensuite', async () => {
    const { app } = await monter();
    const emise = await emettre(app);

    for (let i = 0; i < ESSAIS_MAX; i++) {
      const echec = await accepter(app, emise.invitationId, 'AAAAAAAA');
      expect(echec.statusCode).toBe(401);
    }

    const apres = await accepter(app, emise.invitationId, emise.code);
    expect(apres.statusCode).toBe(429);
    expect(apres.json().motif).toBe('trop_d_essais');
  });

  it('ne se rejoue pas une fois consommé', async () => {
    const { app } = await monter();
    const emise = await emettre(app);

    expect((await accepter(app, emise.invitationId, emise.code)).statusCode).toBe(201);

    const rejeu = await accepter(app, emise.invitationId, emise.code, ROCHAMBEAU);
    expect(rejeu.statusCode).toBe(410);
    expect(rejeu.json().motif).toBe('deja_utilisee');
  });

  it('refuse une invitation inconnue', async () => {
    const { app } = await monter();
    const reponse = await accepter(app, 'inconnue', 'ACDEFGHJ');
    expect(reponse.statusCode).toBe(404);
  });

  it('refuse que l’émetteur s’appaire avec lui-même', async () => {
    const { app } = await monter();
    const emise = await emettre(app);

    const reponse = await accepter(
      app,
      emise.invitationId,
      emise.code,
      ROCHAMBEAU,
    );
    expect(reponse.statusCode).toBe(409);
  });
});

describe('couple créé', () => {
  it('naît sans aucun partage actif', async () => {
    const { app, depot } = await monter();
    const emise = await emettre(app);
    const { coupleId } = (await accepter(app, emise.invitationId, emise.code)).json();

    const enregistrement = await depot.couples.parId(coupleId);
    for (const partage of Object.values(enregistrement!.partages)) {
      expect(partage.consentements.every((c) => !c.actif)).toBe(true);
    }
  });
});
