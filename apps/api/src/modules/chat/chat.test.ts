/** Pôle ① — le serveur achemine des enveloppes qu'il ne peut pas ouvrir. */
import { describe, expect, it } from 'vitest';
import {
  deriverCleDeMessages,
  LONGUEUR_NONCE,
  ouvrirMessage,
  paireDepuisAlea,
  scellerMessage,
} from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

const ELLE = paireDepuisAlea(new Uint8Array(32).fill(11));
const LUI = paireDepuisAlea(new Uint8Array(32).fill(22));
const CLE = deriverCleDeMessages(ELLE.cleePrivee, LUI.clePublique);
const NONCE = new Uint8Array(LONGUEUR_NONCE).fill(7);

const publierCles = async (app: App) => {
  await app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/chat/cle`,
    headers: entete(GAELLE),
    payload: { clePublique: ELLE.clePublique },
  });
  return app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/chat/cle`,
    headers: entete(ROCHAMBEAU),
    payload: { clePublique: LUI.clePublique },
  });
};

const envoyer = (app: App, qui: string, enveloppe: string) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
    payload: { enveloppe },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
  });

describe('le clair ne traverse jamais le serveur', () => {
  it('n’expose le texte ni dans la réponse, ni dans ce qui est stocké', async () => {
    const { app, depot } = await monterServeur();
    await publierCles(app);

    const CLAIR = 'Ce que Gaelle ecrit et que le serveur ne doit jamais lire';
    await envoyer(app, GAELLE, scellerMessage(CLE, NONCE, CLAIR));

    const recu = await lire(app, ROCHAMBEAU);
    // Même preuve que pour les axes : sur la chaîne sérialisée entière.
    expect(recu.body).not.toContain(CLAIR);

    const stockes = await depot.chat.messages(COUPLE_ID);
    expect(JSON.stringify(stockes)).not.toContain(CLAIR);
    // Et ce qui est stocké n'a aucun champ où du clair pourrait se glisser :
    // le contenu ne vit que dans `enveloppe`, qui est scellée.
    const champs = Object.keys(stockes[0]!);
    for (const suspect of ['texte', 'clair', 'contenu', 'message', 'corps']) {
      expect(champs.some((c) => c.toLowerCase().includes(suspect))).toBe(false);
    }
    expect(champs).toContain('enveloppe');
    expect(stockes[0]!.enveloppe.startsWith('m1.')).toBe(true);
  });

  it('n’accepte pas une enveloppe qui serait du texte en clair', async () => {
    const { app } = await monterServeur();
    await publierCles(app);

    const reponse = await envoyer(app, GAELLE, 'Bonjour, ceci est en clair');
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('enveloppe_invalide');
  });

  it('ignore un champ « texte » qu’un client bogué ajouterait', async () => {
    const { app, depot } = await monterServeur();
    await publierCles(app);

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/chat`,
      headers: entete(GAELLE),
      payload: {
        enveloppe: scellerMessage(CLE, NONCE, 'contenu scelle'),
        texte: 'DU CLAIR AJOUTE PAR ERREUR',
      },
    });

    const stockes = await depot.chat.messages(COUPLE_ID);
    expect(JSON.stringify(stockes)).not.toContain('DU CLAIR');
  });

  it('rend au destinataire une enveloppe qu’il sait ouvrir', async () => {
    const { app } = await monterServeur();
    await publierCles(app);

    const CLAIR = 'Je pense à toi';
    await envoyer(app, GAELLE, scellerMessage(CLE, NONCE, CLAIR));

    const { messages } = (await lire(app, ROCHAMBEAU)).json();
    const cleDeLui = deriverCleDeMessages(LUI.cleePrivee, ELLE.clePublique);

    expect(ouvrirMessage(cleDeLui, messages[0].enveloppe)).toBe(CLAIR);
  });
});

describe('clés publiques', () => {
  it('ne stocke que des clés publiques et signale quand l’échange est prêt', async () => {
    const { app } = await monterServeur();

    const seule = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/chat/cle`,
      headers: entete(GAELLE),
      payload: { clePublique: ELLE.clePublique },
    });
    expect(seule.json().cles.echangePret).toBe(false);

    const lesDeux = await publierCles(app);
    expect(lesDeux.json().cles.echangePret).toBe(true);

    // La clé privée n'apparaît jamais, d'aucun côté.
    const vues = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/chat/cles`,
      headers: entete(GAELLE),
    });
    expect(vues.body).not.toContain(ELLE.cleePrivee);
    expect(vues.body).not.toContain(LUI.cleePrivee);
  });
});

describe('accusés de lecture', () => {
  it('ne marque que les messages reçus, jamais les siens', async () => {
    const { app, depot } = await monterServeur();
    await publierCles(app);

    await envoyer(app, GAELLE, scellerMessage(CLE, NONCE, 'de elle'));
    await envoyer(app, ROCHAMBEAU, scellerMessage(CLE, NONCE, 'de lui'));

    await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/chat/lecture`,
      headers: entete(ROCHAMBEAU),
    });

    const messages = await depot.chat.messages(COUPLE_ID);
    expect(messages.find((m) => m.auteurId === GAELLE)?.luLe).toBeTruthy();
    expect(messages.find((m) => m.auteurId === ROCHAMBEAU)?.luLe).toBeUndefined();
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect(
      (await envoyer(app, INTRUS, scellerMessage(CLE, NONCE, 'x'))).statusCode,
    ).toBe(403);
  });

  it('refuse sans jeton', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/chat`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ferme tout après dissociation, et efface les messages', async () => {
    const { app, depot } = await monterServeur();
    await publierCles(app);
    await envoyer(app, GAELLE, scellerMessage(CLE, NONCE, 'un message'));

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    expect((await lire(app, GAELLE)).statusCode).toBe(410);
    expect((await lire(app, ROCHAMBEAU)).statusCode).toBe(410);
    expect(await depot.chat.messages(COUPLE_ID)).toHaveLength(0);
  });
});
