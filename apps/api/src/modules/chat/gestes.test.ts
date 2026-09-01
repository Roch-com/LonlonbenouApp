/**
 * Épingle, réactions et retrait d’un message (§8.3).
 *
 * Deux règles portent tout le reste : on ne retire que **ses propres**
 * messages, et l’épingle appartient à la conversation — les deux peuvent la
 * poser comme la décrocher.
 */
import { describe, expect, it } from 'vitest';
import { ENVELOPPE_RETIREE } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const envoyer = (s: Serveur, qui: string, enveloppe: string) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
    payload: { enveloppe },
  });

const lister = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
  });

const retirer = (s: Serveur, qui: string, id: string) =>
  s.app.inject({
    method: 'DELETE',
    url: `/couples/${COUPLE_ID}/chat/messages/${id}`,
    headers: entete(qui),
  });

const reagir = (s: Serveur, qui: string, id: string, emojiScelle?: string) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/chat/messages/${id}/reaction`,
    headers: entete(qui),
    payload: emojiScelle ? { emojiScelle } : {},
  });

const epingler = (s: Serveur, qui: string, messageId?: string) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/chat/epingle`,
    headers: entete(qui),
    payload: messageId ? { messageId } : {},
  });

const lireEpingle = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat/epingle`,
    headers: entete(qui),
  });

/** Un couple avec un message de Gaëlle déjà envoyé. */
async function avecUnMessage() {
  const s = await monterServeur();
  const id = (await envoyer(s, GAELLE, 'm1.nonce.bonjour')).json().message.id;
  return { s, id };
}

describe('retirer un message', () => {
  it('n’est possible que pour son auteur', async () => {
    const { s, id } = await avecUnMessage();

    const refus = await retirer(s, ROCHAMBEAU, id);
    expect(refus.statusCode).toBe(403);
    expect(refus.json().motif).toBe('pas_mon_message');
  });

  it('vide l’enveloppe et laisse la ligne', async () => {
    const { s, id } = await avecUnMessage();
    expect((await retirer(s, GAELLE, id)).statusCode).toBe(200);

    const messages = (await lister(s, ROCHAMBEAU)).json().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].retireLe).toBeTruthy();
    expect(messages[0].enveloppe).toBe(ENVELOPPE_RETIREE);
  });

  it('efface vraiment le texte du serveur', async () => {
    const { s, id } = await avecUnMessage();
    await retirer(s, GAELLE, id);

    // Le test qui compte : le contenu ne doit plus être nulle part.
    expect((await lister(s, ROCHAMBEAU)).body).not.toContain('bonjour');
  });

  it('ne se retire pas deux fois', async () => {
    const { s, id } = await avecUnMessage();
    await retirer(s, GAELLE, id);

    const second = await retirer(s, GAELLE, id);
    expect(second.statusCode).toBe(409);
    expect(second.json().motif).toBe('deja_retire');
  });

  it('refuse un tiers', async () => {
    const { s, id } = await avecUnMessage();
    expect((await retirer(s, INTRUS, id)).statusCode).toBe(403);
  });
});

describe('réactions', () => {
  it('se posent, des deux côtés', async () => {
    const { s, id } = await avecUnMessage();

    await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur');
    const messages = (await lister(s, GAELLE)).json().messages;
    expect(messages[0].reactions).toHaveLength(1);
    expect(messages[0].reactions[0].partenaireId).toBe(ROCHAMBEAU);
  });

  it('n’en gardent qu’une par personne', async () => {
    const { s, id } = await avecUnMessage();

    await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur');
    await reagir(s, ROCHAMBEAU, id, 'm1.b.rire');
    const reactions = (await lister(s, GAELLE)).json().messages[0].reactions;
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emojiScelle).toBe('m1.b.rire');
  });

  it('acceptent une réaction de chacun', async () => {
    const { s, id } = await avecUnMessage();

    await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur');
    await reagir(s, GAELLE, id, 'm1.b.rire');
    expect((await lister(s, GAELLE)).json().messages[0].reactions).toHaveLength(2);
  });

  it('se retirent avec un corps vide', async () => {
    const { s, id } = await avecUnMessage();
    await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur');

    await reagir(s, ROCHAMBEAU, id);
    expect((await lister(s, GAELLE)).json().messages[0].reactions).toEqual([]);
  });

  it('refusent un emoji en clair', async () => {
    const { s, id } = await avecUnMessage();
    const r = await reagir(s, ROCHAMBEAU, id, '❤️');
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('enveloppe_invalide');
  });

  it('disparaissent quand le message est retiré', async () => {
    const { s, id } = await avecUnMessage();
    await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur');
    await retirer(s, GAELLE, id);

    expect((await lister(s, GAELLE)).json().messages[0].reactions).toEqual([]);
  });

  it('ne se posent plus sur un message retiré', async () => {
    const { s, id } = await avecUnMessage();
    await retirer(s, GAELLE, id);

    expect((await reagir(s, ROCHAMBEAU, id, 'm1.a.coeur')).statusCode).toBe(409);
  });
});

describe('épingle', () => {
  it('est absente au départ', async () => {
    const s = await monterServeur();
    expect((await lireEpingle(s, GAELLE)).json().epingle).toBeNull();
  });

  it('se pose et se voit des deux côtés', async () => {
    const { s, id } = await avecUnMessage();
    expect((await epingler(s, GAELLE, id)).statusCode).toBe(200);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      expect((await lireEpingle(s, qui)).json().epingle.messageId).toBe(id);
    }
  });

  it('se décroche depuis l’autre côté', async () => {
    // L'épingle appartient à la conversation, pas à celui qui l'a posée.
    const { s, id } = await avecUnMessage();
    await epingler(s, GAELLE, id);

    await epingler(s, ROCHAMBEAU);
    expect((await lireEpingle(s, GAELLE)).json().epingle).toBeNull();
  });

  it('n’en garde qu’une : épingler remplace', async () => {
    const { s, id } = await avecUnMessage();
    const second = (await envoyer(s, ROCHAMBEAU, 'm1.n.deux')).json().message.id;

    await epingler(s, GAELLE, id);
    await epingler(s, GAELLE, second);
    expect((await lireEpingle(s, GAELLE)).json().epingle.messageId).toBe(second);
  });

  it('tombe quand le message épinglé est retiré', async () => {
    // Sans cela, le bandeau pointerait sur un vide.
    const { s, id } = await avecUnMessage();
    await epingler(s, GAELLE, id);
    await retirer(s, GAELLE, id);

    expect((await lireEpingle(s, GAELLE)).json().epingle).toBeNull();
  });

  it('refuse un message qui n’existe pas', async () => {
    const s = await monterServeur();
    expect((await epingler(s, GAELLE, 'fantome')).statusCode).toBe(404);
  });

  it('refuse un tiers', async () => {
    const { s, id } = await avecUnMessage();
    expect((await epingler(s, INTRUS, id)).statusCode).toBe(403);
    expect((await lireEpingle(s, INTRUS)).statusCode).toBe(403);
  });
});

describe('dissociation', () => {
  it('emporte l’épingle avec les messages', async () => {
    const { s, id } = await avecUnMessage();
    await epingler(s, GAELLE, id);

    await s.services.dissociation.dissocier(COUPLE_ID, GAELLE);

    expect(await s.depot.chat.epingle(COUPLE_ID)).toBeUndefined();
  });
});
