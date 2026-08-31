/**
 * Le doublon réel : le client abandonne au bout de quinze secondes et rejoue,
 * mais `abort()` n'annule que son attente — le serveur a traité la première.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

/** Une enveloppe scellée quelconque : le serveur ne l'ouvre pas. */
const ENVELOPPE = 'm1.abcdefghijklmnopqrstuvwx.charge-scellee';

const envoyerMessage = (app: App, qui: string, cle?: string) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: { ...entete(qui), ...(cle ? { 'x-idempotence': cle } : {}) },
    payload: { enveloppe: ENVELOPPE },
  });

const lireMessages = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
  });

describe('rejeu d’une création', () => {
  it('ne crée qu’un message quand la même clé est rejouée', async () => {
    const { app } = await monterServeur();

    const premiere = await envoyerMessage(app, ROCHAMBEAU, 'cle-1');
    const rejeu = await envoyerMessage(app, ROCHAMBEAU, 'cle-1');

    expect(premiere.statusCode).toBe(201);
    // Le rejeu reçoit la première réponse, à l'identique.
    expect(rejeu.statusCode).toBe(201);
    expect(rejeu.json()).toEqual(premiere.json());

    const messages = (await lireMessages(app, ROCHAMBEAU)).json().messages;
    expect(messages).toHaveLength(1);
  });

  it('laisse passer deux envois volontaires', async () => {
    // Deux fois le même mot, tapé deux fois : ce sont deux appels logiques
    // distincts, donc deux clés. Les confondre avalerait un vrai message.
    const { app } = await monterServeur();
    await envoyerMessage(app, ROCHAMBEAU, 'cle-1');
    await envoyerMessage(app, ROCHAMBEAU, 'cle-2');

    expect((await lireMessages(app, ROCHAMBEAU)).json().messages).toHaveLength(2);
  });

  it('sans clé, rien ne change', async () => {
    // Un client d'une version antérieure n'en envoie pas : il doit continuer
    // de fonctionner, doublons compris — ce n'est pas une régression.
    const { app } = await monterServeur();
    await envoyerMessage(app, ROCHAMBEAU);
    await envoyerMessage(app, ROCHAMBEAU);

    expect((await lireMessages(app, ROCHAMBEAU)).json().messages).toHaveLength(2);
  });

  it('ne partage pas une réponse entre deux personnes', async () => {
    // Une clé devinée ne doit pas donner accès à la réponse de l'autre.
    const { app } = await monterServeur();
    const deRochambeau = await envoyerMessage(app, ROCHAMBEAU, 'meme-cle');
    const deGaelle = await envoyerMessage(app, GAELLE, 'meme-cle');

    expect(deGaelle.json().message.id).not.toBe(deRochambeau.json().message.id);
    expect((await lireMessages(app, ROCHAMBEAU)).json().messages).toHaveLength(2);
  });
});
