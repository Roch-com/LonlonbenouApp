import { describe, expect, it } from 'vitest';
import {
  ALPHABET_CODE,
  codeDepuisAlea,
  creerInvitation,
  ESSAIS_MAX,
  formaterCode,
  LONGUEUR_CODE,
  normaliserCode,
  secondesAvantExpiration,
  verifierInvitation,
} from './invitation';

const SEL = new Uint8Array(16).fill(11);
const EMETTEUR = 'rochambeau';
const T0 = '2026-03-15T12:00:00.000Z';
const CODE = 'ACDEFGHJ';

const plusTard = (minutes: number) =>
  new Date(Date.parse(T0) + minutes * 60_000).toISOString();

const invitation = () => creerInvitation(CODE, SEL, EMETTEUR, T0);

describe('forme du code', () => {
  it('ne garde jamais deux caractères d’une même paire confondable', () => {
    // Ce qui compte n'est pas d'exclure tel caractère, mais qu'aucune paire ne
    // subsiste en entier : « S » est sans danger dès lors que « 5 » est absent.
    const paires = [
      ['0', 'O'],
      ['1', 'I', 'L'],
      ['2', 'Z'],
      ['5', 'S'],
      ['8', 'B'],
    ];

    for (const groupe of paires) {
      const presents = groupe.filter((c) => ALPHABET_CODE.includes(c));
      expect(presents.length).toBeLessThanOrEqual(1);
    }
  });

  it('garde assez d’entropie malgré l’alphabet réduit', () => {
    const bits = LONGUEUR_CODE * Math.log2(ALPHABET_CODE.length);
    expect(bits).toBeGreaterThan(37);
  });

  it('tire un code de la bonne longueur depuis de l’aléa', () => {
    const code = codeDepuisAlea(Uint8Array.from({ length: 16 }, (_, i) => i * 7));
    expect(code).toHaveLength(LONGUEUR_CODE);
    for (const caractere of code) expect(ALPHABET_CODE).toContain(caractere);
  });

  it('refuse de tirer un code sans assez d’aléa', () => {
    expect(() => codeDepuisAlea(new Uint8Array(4))).toThrow();
  });

  it('pardonne minuscules, espaces et tirets à la saisie', () => {
    expect(normaliserCode(' acde-fghj ')).toBe(CODE);
    expect(formaterCode(CODE)).toBe('ACDE-FGHJ');
  });
});

describe('vérification', () => {
  it('accepte le bon code, quelle que soit sa présentation', () => {
    expect(verifierInvitation(invitation(), 'acde-fghj', T0).ok).toBe(true);
    expect(verifierInvitation(invitation(), 'ACDEFGHJ', T0).ok).toBe(true);
  });

  it('ne conserve jamais le code en clair', () => {
    expect(JSON.stringify(invitation())).not.toContain(CODE);
  });

  it('refuse un code faux et compte l’essai', () => {
    const resultat = verifierInvitation(invitation(), 'ACDEFGHK', T0);
    expect(resultat.ok).toBe(false);
    expect(resultat.motif).toBe('code_incorrect');
    expect(resultat.invitation.essais).toBe(1);
  });

  it('brûle le code après cinq erreurs', () => {
    let courante = invitation();
    for (let i = 0; i < ESSAIS_MAX; i++) {
      courante = verifierInvitation(courante, 'ACDEFGHK', T0).invitation;
    }

    // Même le bon code ne passe plus : le balayage est sans objet.
    const apres = verifierInvitation(courante, CODE, T0);
    expect(apres.ok).toBe(false);
    expect(apres.motif).toBe('trop_d_essais');
  });

  it('expire au bout du délai annoncé', () => {
    expect(verifierInvitation(invitation(), CODE, plusTard(14)).ok).toBe(true);
    const expiree = verifierInvitation(invitation(), CODE, plusTard(16));
    expect(expiree.motif).toBe('expiree');
  });

  it('ne se rejoue pas une fois consommée', () => {
    const consommee = verifierInvitation(invitation(), CODE, T0).invitation;
    const rejeu = verifierInvitation(consommee, CODE, T0);
    expect(rejeu.ok).toBe(false);
    expect(rejeu.motif).toBe('deja_utilisee');
  });

  it('décompte le temps restant', () => {
    expect(secondesAvantExpiration(invitation(), T0)).toBe(15 * 60);
    expect(secondesAvantExpiration(invitation(), plusTard(20))).toBe(0);
  });
});

describe('messages', () => {
  it('explique chaque refus sans accuser la personne', () => {
    const cas = [
      verifierInvitation(invitation(), 'ACDEFGHK', T0),
      verifierInvitation(invitation(), CODE, plusTard(20)),
    ];

    for (const resultat of cas) {
      expect(resultat.message).toBeTruthy();
      for (const mot of ['erreur de votre part', 'vous avez échoué', 'interdit']) {
        expect(resultat.message!.toLowerCase()).not.toContain(mot);
      }
    }
  });
});
