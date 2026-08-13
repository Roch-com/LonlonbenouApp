import { describe, expect, it } from 'vitest';
import { LONGUEUR_NONCE } from '../privacy/coffre';
import {
  deriverCleDeMessages,
  empreinteDeVerification,
  estScelleMessage,
  ouvrirMessage,
  paireDepuisAlea,
  scellerMessage,
} from './boutEnBout';

const alea = (remplissage: number) => new Uint8Array(32).fill(remplissage);
const NONCE = new Uint8Array(LONGUEUR_NONCE).fill(4);

const ELLE = paireDepuisAlea(alea(11));
const LUI = paireDepuisAlea(alea(22));
const UN_TIERS = paireDepuisAlea(alea(33));

describe('échange de clés', () => {
  it('fait converger les deux appareils sur la même clé', () => {
    const cheElle = deriverCleDeMessages(ELLE.cleePrivee, LUI.clePublique);
    const cheLui = deriverCleDeMessages(LUI.cleePrivee, ELLE.clePublique);

    expect(Array.from(cheElle)).toEqual(Array.from(cheLui));
    expect(cheElle).toHaveLength(32);
  });

  it('ne conserve pas la clé privée dans la clé publique', () => {
    expect(ELLE.clePublique).not.toBe(ELLE.cleePrivee);
    expect(ELLE.clePublique).not.toContain(ELLE.cleePrivee);
  });

  it('donne une clé différente à un tiers', () => {
    const couple = deriverCleDeMessages(ELLE.cleePrivee, LUI.clePublique);
    const intrus = deriverCleDeMessages(UN_TIERS.cleePrivee, LUI.clePublique);
    expect(Array.from(intrus)).not.toEqual(Array.from(couple));
  });

  it('refuse un aléa trop court plutôt que d’affaiblir la clé', () => {
    expect(() => paireDepuisAlea(new Uint8Array(8))).toThrow();
  });
});

describe('scellement des messages', () => {
  const cle = deriverCleDeMessages(ELLE.cleePrivee, LUI.clePublique);

  it('rend le clair à celui qui a la bonne clé', () => {
    const clair = 'Je pense à toi, là, maintenant 💛';
    const enveloppe = scellerMessage(cle, NONCE, clair);

    expect(enveloppe).not.toContain('pense');
    expect(ouvrirMessage(cle, enveloppe)).toBe(clair);
  });

  it('résiste à un tiers qui a intercepté l’enveloppe', () => {
    const enveloppe = scellerMessage(cle, NONCE, 'un secret');
    const cleIntrus = deriverCleDeMessages(UN_TIERS.cleePrivee, LUI.clePublique);

    expect(() => ouvrirMessage(cleIntrus, enveloppe)).toThrow();
  });

  it('détecte l’altération d’un seul caractère', () => {
    const enveloppe = scellerMessage(cle, NONCE, 'un secret');
    const altere =
      enveloppe.slice(0, -2) + (enveloppe.at(-2) === 'A' ? 'B' : 'A') + enveloppe.at(-1);

    expect(() => ouvrirMessage(cle, altere)).toThrow();
  });

  it('refuse une enveloppe malformée sans planter bizarrement', () => {
    for (const bidon of ['', 'texte en clair', 'm1.abc', 'x1.a.b']) {
      expect(() => ouvrirMessage(cle, bidon)).toThrow();
    }
  });

  it('se reconnaît, pour ne jamais afficher du chiffré brut à l’écran', () => {
    expect(estScelleMessage(scellerMessage(cle, NONCE, 'coucou'))).toBe(true);
    expect(estScelleMessage('coucou')).toBe(false);
  });

  it('exige un nonce de la bonne taille', () => {
    expect(() => scellerMessage(cle, new Uint8Array(12), 'x')).toThrow();
  });
});

describe('nombre de vérification', () => {
  it('est identique des deux côtés, quel que soit l’ordre', () => {
    expect(empreinteDeVerification(ELLE.clePublique, LUI.clePublique)).toBe(
      empreinteDeVerification(LUI.clePublique, ELLE.clePublique),
    );
  });

  it('change si une clé publique a été substituée', () => {
    // C'est exactement ce que la comparaison de vive voix doit révéler.
    const legitime = empreinteDeVerification(ELLE.clePublique, LUI.clePublique);
    const usurpee = empreinteDeVerification(ELLE.clePublique, UN_TIERS.clePublique);

    expect(usurpee).not.toBe(legitime);
  });

  it('se lit à voix haute : cinq groupes de cinq chiffres', () => {
    const empreinte = empreinteDeVerification(ELLE.clePublique, LUI.clePublique);
    expect(empreinte).toMatch(/^\d{5}( \d{5}){4}$/);
  });
});
