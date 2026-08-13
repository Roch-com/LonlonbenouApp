import { describe, expect, it } from 'vitest';
import {
  attenteApresEchecs,
  controlerPin,
  creerVerificateur,
  creerVerificateurAsync,
  EFFACEMENT_APRES_ECHECS,
  etatDurcissement,
  LONGUEUR_SEL,
  verifierPin,
  verifierPinAsync,
} from './verrou';

const SEL = new Uint8Array(LONGUEUR_SEL).fill(5);
const AUTRE_SEL = new Uint8Array(LONGUEUR_SEL).fill(6);
// Itérations réduites pour les tests : la valeur de production est ailleurs.
const RAPIDE = 1_000;

describe('contrôle du code', () => {
  it('accepte 4 à 6 chiffres non triviaux', () => {
    for (const pin of ['1847', '90210', '284163']) {
      expect(controlerPin(pin).valide).toBe(true);
    }
  });

  it('refuse les longueurs hors bornes', () => {
    expect(controlerPin('123').motif).toBe('longueur');
    expect(controlerPin('1234567').motif).toBe('longueur');
  });

  it('refuse ce qui n’est pas un chiffre', () => {
    expect(controlerPin('12a4').motif).toBe('chiffres_seulement');
  });

  it('refuse les codes qui se devinent', () => {
    for (const pin of ['0000', '1111', '1234', '4321', '9876', '012345']) {
      expect(controlerPin(pin).motif).toBe('trop_previsible');
    }
  });

  it('explique le refus sans faire la leçon', () => {
    const message = controlerPin('1234').message ?? '';
    for (const mot of ['erreur', 'interdit', 'mauvais', 'devez']) {
      expect(message.toLowerCase()).not.toContain(mot);
    }
    expect(message).toContain('protégera');
  });
});

describe('vérificateur', () => {
  it('reconnaît le bon code et rejette les autres', () => {
    const verificateur = creerVerificateur('1847', SEL, RAPIDE);

    expect(verifierPin('1847', verificateur)).toBe(true);
    expect(verifierPin('1848', verificateur)).toBe(false);
    expect(verifierPin('184', verificateur)).toBe(false);
    expect(verifierPin('', verificateur)).toBe(false);
  });

  it('ne conserve nulle part le code en clair', () => {
    const verificateur = creerVerificateur('1847', SEL, RAPIDE);
    expect(JSON.stringify(verificateur)).not.toContain('1847');
  });

  it('donne des empreintes différentes pour le même code avec deux sels', () => {
    const a = creerVerificateur('1847', SEL, RAPIDE);
    const b = creerVerificateur('1847', AUTRE_SEL, RAPIDE);
    expect(a.empreinte).not.toBe(b.empreinte);
  });

  it('refuse de sceller un code trivial', () => {
    expect(() => creerVerificateur('0000', SEL, RAPIDE)).toThrow();
  });

  it('exige un sel de la bonne taille', () => {
    expect(() => creerVerificateur('1847', new Uint8Array(4), RAPIDE)).toThrow();
  });

  it('donne le même résultat en synchrone et en asynchrone', async () => {
    const sync = creerVerificateur('1847', SEL, RAPIDE);
    const async = await creerVerificateurAsync('1847', SEL, RAPIDE);

    expect(async.empreinte).toBe(sync.empreinte);
    expect(await verifierPinAsync('1847', sync)).toBe(true);
    expect(await verifierPinAsync('1848', sync)).toBe(false);
  });
});

describe('durcissement après échecs', () => {
  const T0 = '2026-03-15T12:00:00.000Z';
  const plusTard = (secondes: number) =>
    new Date(Date.parse(T0) + secondes * 1000).toISOString();

  it('laisse passer les premières fautes de frappe', () => {
    expect(attenteApresEchecs(0)).toBe(0);
    expect(attenteApresEchecs(2)).toBe(0);
    expect(etatDurcissement(2, T0, T0).bloque).toBe(false);
  });

  it('durcit progressivement, sans jamais enfermer définitivement', () => {
    const paliers = [3, 4, 5, 6, 10].map(attenteApresEchecs);
    expect(paliers).toEqual([30, 60, 300, 900, 900]);

    for (const attente of paliers) {
      expect(Number.isFinite(attente)).toBe(true);
    }
  });

  it('décompte le temps déjà écoulé', () => {
    expect(etatDurcissement(3, T0, plusTard(10))).toEqual({
      bloque: true,
      secondesRestantes: 20,
    });
    expect(etatDurcissement(3, T0, plusTard(30)).bloque).toBe(false);
  });

  it('n’efface jamais les données après des échecs répétés', () => {
    // Un partenaire pourrait saisir de faux codes exprès pour détruire ce que
    // l'autre a écrit : le verrou fait attendre, il ne punit pas.
    expect(EFFACEMENT_APRES_ECHECS).toBe(false);
  });
});
