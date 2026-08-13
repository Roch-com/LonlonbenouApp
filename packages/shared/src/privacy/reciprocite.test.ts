import { describe, expect, it } from 'vitest';
import {
  accesDe,
  basculerConsentement,
  creerPartage,
  estPartageActif,
  verifierReciprocite,
  type ModuleSensible,
} from './reciprocite';

const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';
const T0 = '2026-01-01T10:00:00.000Z';

const MODULES: ModuleSensible[] = [
  'position',
  'cycle',
  'croissance',
  'score',
  'confidences',
];

describe('opt-in symétrique', () => {
  it('reste inactif tant que les deux n’ont pas consenti', () => {
    const initial = creerPartage('position', ROCHAMBEAU, GAELLE, false, T0);
    expect(estPartageActif(initial)).toBe(false);

    const { partage: unSeul } = basculerConsentement(
      initial,
      ROCHAMBEAU,
      true,
      'Rochambeau',
      T0,
    );
    expect(estPartageActif(unSeul)).toBe(false);

    const { partage: lesDeux } = basculerConsentement(
      unSeul,
      GAELLE,
      true,
      'Gaëlle',
      T0,
    );
    expect(estPartageActif(lesDeux)).toBe(true);
  });

  it('laisse chacun se retirer seul, à tout moment', () => {
    const actif = creerPartage('cycle', ROCHAMBEAU, GAELLE, true, T0);
    const { partage } = basculerConsentement(actif, GAELLE, false, 'Gaëlle', T0);
    expect(estPartageActif(partage)).toBe(false);
  });
});

describe('réciprocité stricte', () => {
  it('n’expose jamais un accès à sens unique, quelle que soit la combinaison', () => {
    for (const module of MODULES) {
      for (const aActif of [false, true]) {
        for (const bActif of [false, true]) {
          let partage = creerPartage(module, ROCHAMBEAU, GAELLE, false, T0);
          partage = basculerConsentement(
            partage,
            ROCHAMBEAU,
            aActif,
            'Rochambeau',
            T0,
          ).partage;
          partage = basculerConsentement(partage, GAELLE, bActif, 'Gaëlle', T0)
            .partage;

          expect(() => verifierReciprocite(partage)).not.toThrow();
          expect(accesDe(partage, ROCHAMBEAU).peutVoir).toBe(aActif && bActif);
          expect(accesDe(partage, GAELLE).peutVoir).toBe(aActif && bActif);
        }
      }
    }
  });

  it('coupe l’accès des DEUX côtés dès qu’un partenaire se met en pause', () => {
    const actif = creerPartage('position', ROCHAMBEAU, GAELLE, true, T0);
    const { partage } = basculerConsentement(
      actif,
      ROCHAMBEAU,
      false,
      'Rochambeau',
      T0,
    );

    expect(accesDe(partage, ROCHAMBEAU).peutVoir).toBe(false);
    expect(accesDe(partage, GAELLE).peutVoir).toBe(false);
    expect(accesDe(partage, ROCHAMBEAU).raison).toBe('en_pause_de_mon_cote');
    expect(accesDe(partage, GAELLE).raison).toBe('en_pause_cote_partenaire');
  });

  it('refuse un lecteur étranger au couple', () => {
    const partage = creerPartage('position', ROCHAMBEAU, GAELLE, true, T0);
    expect(() => accesDe(partage, 'inconnu')).toThrow();
  });
});

describe('aucun mode furtif', () => {
  it('notifie les deux partenaires à chaque changement', () => {
    const partage = creerPartage('position', ROCHAMBEAU, GAELLE, true, T0);
    const { notifications } = basculerConsentement(
      partage,
      ROCHAMBEAU,
      false,
      'Rochambeau',
      T0,
    );

    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.destinataireId).sort()).toEqual(
      [GAELLE, ROCHAMBEAU].sort(),
    );
    for (const n of notifications) {
      expect(n.texte.length).toBeGreaterThan(0);
      expect(n.emisLe).toBe(T0);
    }
  });

  it('formule la pause sans reproche ni culpabilisation', () => {
    const partage = creerPartage('position', ROCHAMBEAU, GAELLE, true, T0);
    const { notifications } = basculerConsentement(
      partage,
      GAELLE,
      false,
      'Gaëlle',
      T0,
    );
    const versRochambeau = notifications.find(
      (n) => n.destinataireId === ROCHAMBEAU,
    )!;

    expect(versRochambeau.texte).toBe(
      'Gaëlle a mis le partage de position en pause.',
    );
    for (const mot of ['refuse', 'ne veut plus', 'cache', 'a coupé']) {
      expect(versRochambeau.texte.toLowerCase()).not.toContain(mot);
    }
  });
});
