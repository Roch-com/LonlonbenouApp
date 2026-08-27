import { describe, expect, it } from 'vitest';
import {
  decoderBase64,
  encoderBase64,
  estScelle,
  LONGUEUR_NONCE,
  ouvrir,
  sceller,
} from './coffre';

const CLE = new Uint8Array(32).fill(7);
const AUTRE_CLE = new Uint8Array(32).fill(9);
const NONCE = new Uint8Array(LONGUEUR_NONCE).fill(3);
const CONTEXTE = 'lonlonbenu.chat';

describe('coffre', () => {
  it('rend le clair d’origine', () => {
    const clair = JSON.stringify({
      messages: [{ texte: 'Je pense à toi 💛', humeur: 'amoureux' }],
    });
    const scelle = sceller(CLE, NONCE, clair, CONTEXTE);

    expect(scelle).not.toContain('Je pense à toi');
    expect(ouvrir(CLE, scelle, CONTEXTE)).toBe(clair);
  });

  it('survit aux accents, emoji et apostrophes typographiques', () => {
    const clair = 'Réunion jusqu’à 17h — « au calme » 🌙 ✨';
    expect(ouvrir(CLE, sceller(CLE, NONCE, clair, CONTEXTE), CONTEXTE)).toBe(clair);
  });

  it('gère la chaîne vide et les charges longues', () => {
    const longue = 'a'.repeat(10_000);
    expect(ouvrir(CLE, sceller(CLE, NONCE, '', CONTEXTE), CONTEXTE)).toBe('');
    expect(ouvrir(CLE, sceller(CLE, NONCE, longue, CONTEXTE), CONTEXTE)).toBe(
      longue,
    );
  });

  it('refuse une autre clé', () => {
    const scelle = sceller(CLE, NONCE, 'secret', CONTEXTE);
    expect(() => ouvrir(AUTRE_CLE, scelle, CONTEXTE)).toThrow();
  });

  it('refuse un contexte différent : une valeur ne se déplace pas d’un store à l’autre', () => {
    const scelle = sceller(CLE, NONCE, 'secret', 'lonlonbenu.chat');
    expect(() => ouvrir(CLE, scelle, 'lonlonbenu.presence')).toThrow();
  });

  it('détecte l’altération d’un seul caractère', () => {
    const scelle = sceller(CLE, NONCE, 'secret', CONTEXTE);
    const altere =
      scelle.slice(0, -2) + (scelle.at(-2) === 'A' ? 'B' : 'A') + scelle.at(-1);
    expect(() => ouvrir(CLE, altere, CONTEXTE)).toThrow();
  });

  it('refuse une enveloppe malformée', () => {
    expect(() => ouvrir(CLE, 'nimporte quoi', CONTEXTE)).toThrow(
      'Enveloppe illisible',
    );
    expect(() => ouvrir(CLE, 'lb1.abc', CONTEXTE)).toThrow('Enveloppe illisible');
  });

  it('exige un nonce de la bonne taille', () => {
    expect(() => sceller(CLE, new Uint8Array(12), 'x', CONTEXTE)).toThrow();
  });

  it('distingue une enveloppe d’une valeur en clair héritée', () => {
    expect(estScelle(sceller(CLE, NONCE, '{}', CONTEXTE))).toBe(true);
    expect(estScelle('{"messages":[]}')).toBe(false);
  });

  it('encode et décode en base64 quelle que soit la longueur', () => {
    // Les longueurs 0 à 4 couvrent les trois cas de rembourrage.
    for (let taille = 0; taille <= 64; taille++) {
      const octets = Uint8Array.from({ length: taille }, (_, i) => (i * 37) % 256);
      expect(Array.from(decoderBase64(encoderBase64(octets)))).toEqual(
        Array.from(octets),
      );
    }
  });

  it('produit des enveloppes différentes pour deux nonces différents', () => {
    const a = sceller(CLE, new Uint8Array(LONGUEUR_NONCE).fill(1), 'x', CONTEXTE);
    const b = sceller(CLE, new Uint8Array(LONGUEUR_NONCE).fill(2), 'x', CONTEXTE);
    expect(a).not.toBe(b);
  });
});
