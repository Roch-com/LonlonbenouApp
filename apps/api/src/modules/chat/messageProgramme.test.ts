/**
 * Pôle ① — messages programmés et capsules temporelles (§8.3).
 *
 * Une capsule n'a de sens que si elle ne s'ouvre pas avant l'heure — y compris
 * pour celui qui l'a écrite. Le filtrage porte donc sur la conversation des
 * deux, pas sur celle du destinataire.
 */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

const SCELLE = 'm1.abcdefghijklmnopqrstuvwx.message-scelle';
const PLUS_TARD = new Date(Date.now() + 3 * 86_400_000).toISOString();
const DEJA_PASSE = new Date(Date.now() - 60_000).toISOString();

const envoyer = (app: App, qui: string, corps: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
    payload: { enveloppe: SCELLE, ...corps },
  });

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
  });

const programmes = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat/programmes`,
    headers: entete(qui),
  });

const annuler = (app: App, qui: string, id: string) =>
  app.inject({
    method: 'DELETE',
    url: `/couples/${COUPLE_ID}/chat/programmes/${id}`,
    headers: entete(qui),
  });

describe('la capsule reste fermée', () => {
  it('n’apparaît dans aucune des deux conversations', async () => {
    const { app } = await monterServeur();
    await envoyer(app, GAELLE, { remettreLe: PLUS_TARD });

    // Pas même chez son auteur : sinon la capsule n'aurait plus de sens
    // pour lui.
    expect((await lire(app, ROCHAMBEAU)).json().messages).toHaveLength(0);
    expect((await lire(app, GAELLE)).json().messages).toHaveLength(0);
  });

  it('apparaît une fois l’heure passée', async () => {
    const { app } = await monterServeur();
    await envoyer(app, GAELLE, { remettreLe: DEJA_PASSE });
    expect((await lire(app, ROCHAMBEAU)).json().messages).toHaveLength(1);
  });

  it('part tout de suite sans date', async () => {
    const { app } = await monterServeur();
    await envoyer(app, GAELLE);
    expect((await lire(app, ROCHAMBEAU)).json().messages).toHaveLength(1);
  });

  it('refuse une date illisible', async () => {
    // Elle ferait un message jamais délivré, disparu sans explication.
    const { app } = await monterServeur();
    const reponse = await envoyer(app, GAELLE, { remettreLe: 'demain' });
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().motif).toBe('date_invalide');
  });
});

describe('les envois en attente', () => {
  it('ne montre que les siens', async () => {
    // Voir ceux de l'autre reviendrait à connaître à l'avance la surprise
    // qu'il prépare.
    const { app } = await monterServeur();
    await envoyer(app, GAELLE, { remettreLe: PLUS_TARD });

    expect((await programmes(app, GAELLE)).json().messages).toHaveLength(1);
    expect((await programmes(app, ROCHAMBEAU)).json().messages).toHaveLength(0);
  });

  it('n’y range pas ce qui est déjà parti', async () => {
    const { app } = await monterServeur();
    await envoyer(app, GAELLE);
    expect((await programmes(app, GAELLE)).json().messages).toHaveLength(0);
  });
});

describe('annulation', () => {
  it('retire un envoi encore en attente', async () => {
    const { app } = await monterServeur();
    const cree = await envoyer(app, GAELLE, { remettreLe: PLUS_TARD });

    expect((await annuler(app, GAELLE, cree.json().message.id)).statusCode).toBe(
      204,
    );
    expect((await programmes(app, GAELLE)).json().messages).toHaveLength(0);
  });

  it('refuse d’annuler ce qui est déjà remis', async () => {
    // Le message a pu être lu, peut-être répondu : le retirer réécrirait une
    // conversation à deux.
    const { app } = await monterServeur();
    const cree = await envoyer(app, GAELLE);
    const reponse = await annuler(app, GAELLE, cree.json().message.id);

    expect(reponse.statusCode).toBe(409);
    expect(reponse.json().motif).toBe('deja_remis');
  });

  it('refuse à quelqu’un d’autre que son auteur', async () => {
    const { app } = await monterServeur();
    const cree = await envoyer(app, GAELLE, { remettreLe: PLUS_TARD });
    expect((await annuler(app, ROCHAMBEAU, cree.json().message.id)).statusCode).toBe(
      404,
    );
  });
});
