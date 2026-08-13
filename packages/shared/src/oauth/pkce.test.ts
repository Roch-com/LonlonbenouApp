import { describe, expect, it } from 'vitest';
import {
  defiDepuisVerificateur,
  encoderBase64Url,
  OCTETS_VERIFICATEUR,
  verificateurDepuisAlea,
} from './pkce';

describe('PKCE S256', () => {
  it('reproduit le vecteur de l’annexe B du RFC 7636', () => {
    // Le test qui compte : si le mobile et le serveur passent tous deux
    // celui-ci, ils ne peuvent pas diverger.
    expect(
      defiDepuisVerificateur('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('encode en base64url, sans remplissage ni caractère à échapper', () => {
    const encode = encoderBase64Url(Uint8Array.from([251, 255, 190, 0]));
    expect(encode).not.toContain('+');
    expect(encode).not.toContain('/');
    expect(encode).not.toContain('=');
  });

  it('produit un vérificateur de 43 caractères', () => {
    const alea = Uint8Array.from({ length: OCTETS_VERIFICATEUR }, (_, i) => i * 7);
    expect(verificateurDepuisAlea(alea)).toHaveLength(43);
  });

  it('refuse un aléa trop court plutôt que d’affaiblir le vérificateur', () => {
    expect(() => verificateurDepuisAlea(new Uint8Array(8))).toThrow();
  });

  it('donne un défi différent pour deux vérificateurs différents', () => {
    const a = verificateurDepuisAlea(new Uint8Array(32).fill(1));
    const b = verificateurDepuisAlea(new Uint8Array(32).fill(2));
    expect(defiDepuisVerificateur(a)).not.toBe(defiDepuisVerificateur(b));
  });
});
