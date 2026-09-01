/**
 * Notes vocales, côté serveur (§8.3).
 *
 * Le plafond de durée est ce qui garde le poids en base prévisible. Il ne
 * tient que si le serveur le fait respecter : un client modifié pourrait
 * sinon déposer un fichier de plusieurs méga-octets dans une conversation.
 */
import { describe, expect, it } from 'vitest';
import { DUREE_MAX_VOCAL_S } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const envoyerVocal = (s: Serveur, qui: string, vocal: unknown) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
    payload: { enveloppe: 'm1.n.note-vocale', vocal },
  });

const lister = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/chat`,
    headers: entete(qui),
  });

const VOCAL = { audioScelle: 'm1.nonce.audio', dureeS: 12 };

describe('envoi', () => {
  it('accompagne un message et se voit des deux côtés', async () => {
    const s = await monterServeur();
    expect((await envoyerVocal(s, GAELLE, VOCAL)).statusCode).toBe(201);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const message = (await lister(s, qui)).json().messages[0];
      expect(message.vocal.dureeS).toBe(12);
      expect(message.vocal.audioScelle).toBe('m1.nonce.audio');
    }
  });

  it('refuse un audio en clair', async () => {
    const s = await monterServeur();
    const r = await envoyerVocal(s, GAELLE, {
      audioScelle: 'UklGRiQAAABXQVZF',
      dureeS: 12,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('enveloppe_invalide');
  });

  it('refuse une durée au-delà du plafond', async () => {
    const s = await monterServeur();
    const r = await envoyerVocal(s, GAELLE, {
      ...VOCAL,
      dureeS: DUREE_MAX_VOCAL_S + 1,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('duree_invalide');
  });

  it('refuse une durée nulle ou absurde', async () => {
    const s = await monterServeur();
    for (const dureeS of [0, -4, 99999]) {
      const r = await envoyerVocal(s, GAELLE, { ...VOCAL, dureeS });
      expect(r.statusCode).toBe(400);
    }
  });

  it('arrondit la durée : la base la range en entier', async () => {
    const s = await monterServeur();
    await envoyerVocal(s, GAELLE, { ...VOCAL, dureeS: 12.7 });

    expect((await lister(s, GAELLE)).json().messages[0].vocal.dureeS).toBe(13);
  });

  it('laisse passer un message sans vocal', async () => {
    const s = await monterServeur();
    const r = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/chat`,
      headers: entete(GAELLE),
      payload: { enveloppe: 'm1.n.texte' },
    });
    expect(r.statusCode).toBe(201);
    expect((await lister(s, GAELLE)).json().messages[0].vocal).toBeUndefined();
  });

  it('ignore un vocal incomplet plutôt que d’échouer', async () => {
    // Un client qui envoie une durée sans audio ne doit pas perdre son
    // message : il part comme un message ordinaire.
    const s = await monterServeur();
    const r = await envoyerVocal(s, GAELLE, { dureeS: 12 });
    expect(r.statusCode).toBe(201);
    expect((await lister(s, GAELLE)).json().messages[0].vocal).toBeUndefined();
  });
});

describe('retrait', () => {
  it('emporte l’audio, pas seulement le texte', async () => {
    const s = await monterServeur();
    const id = (await envoyerVocal(s, GAELLE, VOCAL)).json().message.id;

    await s.app.inject({
      method: 'DELETE',
      url: `/couples/${COUPLE_ID}/chat/messages/${id}`,
      headers: entete(GAELLE),
    });

    const message = (await lister(s, ROCHAMBEAU)).json().messages[0];
    expect(message.retireLe).toBeTruthy();
    // Garder le son ferait mentir « ce message a été retiré ».
    expect(message.vocal).toBeUndefined();
    expect((await lister(s, ROCHAMBEAU)).body).not.toContain('nonce.audio');
  });
});
