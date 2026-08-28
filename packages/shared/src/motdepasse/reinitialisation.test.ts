import { describe, expect, it } from 'vitest';
import { ALPHABET_CODE, LONGUEUR_CODE } from '../onboarding/invitation';
import {
  ESSAIS_MAX_REINITIALISATION,
  codeDepuisAlea,
  expirationReinitialisation,
  formaterCode,
  motDePasseAcceptable,
  normaliserCode,
  verifierLaDemande,
  type DemandeReinitialisation,
} from './reinitialisation';

const base = (
  surcharge: Partial<DemandeReinitialisation> = {},
): DemandeReinitialisation => ({
  empreinte: 'peu-importe',
  compteId: 'gaelle',
  demandeeLe: '2026-03-15T10:00:00.000Z',
  expireLe: '2026-03-15T10:30:00.000Z',
  essais: 0,
  ...surcharge,
});

const pendantLaValidite = new Date('2026-03-15T10:05:00.000Z');

describe('code', () => {
  it('a la longueur annoncée et ne tire que de l’alphabet', () => {
    const code = codeDepuisAlea(new Uint8Array([0, 1, 2, 3, 250, 200, 7, 30]));
    expect(code).toHaveLength(LONGUEUR_CODE);
    for (const c of code) expect(ALPHABET_CODE).toContain(c);
  });

  it('évite les caractères qui se confondent à la recopie', () => {
    // Un code se recopie à la main depuis un courriel : aucune paire ambiguë ne
    // doit y figurer au complet.
    for (const paire of ['0O', '1I', '1L', 'IL', '2Z', '5S', '8B']) {
      const presents = [...paire].filter((c) => ALPHABET_CODE.includes(c));
      expect(presents.length).toBeLessThan(paire.length);
    }
  });

  it('se relit malgré la casse, les espaces et les tirets', () => {
    expect(normaliserCode(' a2c4-e6f8 ')).toBe('A2C4E6F8');
    expect(normaliserCode(formaterCode('A2C4E6F8'))).toBe('A2C4E6F8');
  });
});

describe('validité d’une demande', () => {
  it('accepte le bon code pendant la fenêtre', () => {
    expect(verifierLaDemande(base(), true, pendantLaValidite)).toEqual({
      ok: true,
    });
  });

  it('refuse une demande inconnue', () => {
    expect(verifierLaDemande(undefined, true, pendantLaValidite)).toEqual({
      ok: false,
      motif: 'introuvable',
    });
  });

  it('refuse après expiration, même avec le bon code', () => {
    const apres = new Date('2026-03-15T10:31:00.000Z');
    expect(verifierLaDemande(base(), true, apres)).toEqual({
      ok: false,
      motif: 'expiree',
    });
  });

  it('ne se rejoue pas une fois utilisée', () => {
    // Sans cela, un code intercepté resterait valable jusqu'à son expiration,
    // même après que la personne s'en soit servie.
    const utilisee = base({ utiliseeLe: '2026-03-15T10:06:00.000Z' });
    expect(verifierLaDemande(utilisee, true, pendantLaValidite)).toEqual({
      ok: false,
      motif: 'deja_utilisee',
    });
  });

  it('brûle la demande après cinq erreurs', () => {
    const epuisee = base({ essais: ESSAIS_MAX_REINITIALISATION });
    expect(verifierLaDemande(epuisee, true, pendantLaValidite)).toEqual({
      ok: false,
      motif: 'trop_d_essais',
    });
  });

  it('signale un code faux sans révéler autre chose', () => {
    expect(verifierLaDemande(base(), false, pendantLaValidite)).toEqual({
      ok: false,
      motif: 'code_incorrect',
    });
  });
});

describe('règles annexes', () => {
  it('fixe l’expiration à trente minutes', () => {
    expect(expirationReinitialisation('2026-03-15T10:00:00.000Z')).toBe(
      '2026-03-15T10:30:00.000Z',
    );
  });

  it('exige la même longueur de mot de passe qu’à la création', () => {
    expect(motDePasseAcceptable('court')).toBe(false);
    expect(motDePasseAcceptable('assez-long-ca')).toBe(true);
  });
});
