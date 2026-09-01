/**
 * Les statuts, l’importance et la limite d’axes actifs (§8.5).
 *
 * La limite est un garde-fou, pas une contrainte technique : le cahier la
 * demande explicitement « pour éviter l’effet liste de griefs ». Elle se teste
 * comme telle.
 */
import { describe, expect, it } from 'vitest';
import {
  axesActifs,
  definitionImportance,
  etatAxe,
  IMPORTANCES,
  LIBELLES_ETAT_AXE,
  LIMITE_AXES_ACTIFS,
  peutOuvrirUnAxe,
  type AxeCroissance,
} from '../types/croissance';

const T0 = '2026-09-01T10:00:00.000Z';

const axe = (id: string, reste: Partial<AxeCroissance> = {}): AxeCroissance => ({
  id,
  theme: 'communication',
  titre: `Axe ${id}`,
  ouvertPar: 'gaelle',
  ouvertLe: T0,
  contributions: [],
  ...reste,
});

const contribution = (partenaireId: string) => ({
  partenaireId,
  ressenti: 'r',
  besoin: 'b',
  majLe: T0,
});

describe('statuts', () => {
  it('part de « à travailler »', () => {
    expect(etatAxe(axe('a'))).toBe('a_travailler');
  });

  it('reste « à travailler » avec une seule contribution', () => {
    // Le miroir n'est pas complet : la conversation n'a pas commencé.
    expect(
      etatAxe(axe('a', { contributions: [contribution('gaelle')] })),
    ).toBe('a_travailler');
  });

  it('passe « en cours » quand les deux ont écrit', () => {
    expect(
      etatAxe(
        axe('a', {
          contributions: [contribution('gaelle'), contribution('rochambeau')],
        }),
      ),
    ).toBe('en_cours');
  });

  it('passe « progrès reconnu » dès une reconnaissance', () => {
    expect(
      etatAxe(
        axe('a', {
          contributions: [contribution('gaelle'), contribution('rochambeau')],
          reconnaissances: [{ partenaireId: 'rochambeau', le: T0 }],
        }),
      ),
    ).toBe('progres_reconnu');
  });

  it('« clos » l’emporte sur tout le reste', () => {
    expect(
      etatAxe(
        axe('a', {
          reconnaissances: [{ partenaireId: 'rochambeau', le: T0 }],
          clotureLe: T0,
        }),
      ),
    ).toBe('clos');
  });

  it('a un libellé pour chaque statut', () => {
    for (const etat of Object.keys(LIBELLES_ETAT_AXE)) {
      expect(LIBELLES_ETAT_AXE[etat as keyof typeof LIBELLES_ETAT_AXE]).toBeTruthy();
    }
  });
});

describe('importance', () => {
  it('propose trois niveaux, chacun avec une lecture', () => {
    expect(IMPORTANCES).toHaveLength(3);
    for (const niveau of IMPORTANCES) {
      expect(definitionImportance(niveau.code).lecture).toBeTruthy();
    }
  });

  it('n’emploie jamais un ton de mise en demeure', () => {
    for (const niveau of IMPORTANCES) {
      expect(niveau.lecture).not.toMatch(/dois|faut que tu|exige|immédiatement/i);
    }
  });

  it('refuse un niveau inventé', () => {
    expect(() =>
      definitionImportance('urgente' as never),
    ).toThrow();
  });
});

describe('la limite d’axes actifs', () => {
  it('laisse ouvrir tant qu’on est sous la limite', () => {
    const axes = Array.from({ length: LIMITE_AXES_ACTIFS - 1 }, (_, i) =>
      axe(`a${i}`),
    );
    expect(peutOuvrirUnAxe(axes)).toBe(true);
  });

  it('refuse une fois la limite atteinte', () => {
    const axes = Array.from({ length: LIMITE_AXES_ACTIFS }, (_, i) => axe(`a${i}`));
    expect(peutOuvrirUnAxe(axes)).toBe(false);
  });

  it('ne compte pas les axes clos', () => {
    // Refermer ce qui a avancé rouvre la place : c'est tout le sens de la règle.
    const axes = Array.from({ length: LIMITE_AXES_ACTIFS }, (_, i) =>
      axe(`a${i}`, { clotureLe: T0 }),
    );
    expect(axesActifs(axes)).toEqual([]);
    expect(peutOuvrirUnAxe(axes)).toBe(true);
  });

  it('porte sur le couple, pas sur la personne', () => {
    // Deux listes de trois feraient six griefs affichés — exactement ce que la
    // règle cherche à éviter.
    const axes = [
      axe('a1', { ouvertPar: 'gaelle' }),
      axe('a2', { ouvertPar: 'gaelle' }),
      axe('a3', { ouvertPar: 'rochambeau' }),
    ];
    expect(peutOuvrirUnAxe(axes)).toBe(false);
  });
});
