import { describe, expect, it } from 'vitest';
import type { Jalon, Projet } from '../types/projets';
import * as moduleAvancement from './avancement';
import { avancementProjet, basculerJalon, trierProjets } from './avancement';

const MAINTENANT = '2026-03-15T12:00:00.000Z';
const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';

const jalon = (id: string, modifications: Partial<Jalon> = {}): Jalon => ({
  id,
  titre: `Jalon ${id}`,
  ...modifications,
});

const projet = (jalons: Jalon[], modifications: Partial<Projet> = {}): Projet => ({
  id: 'p1',
  titre: 'Partir quelque part',
  jalons,
  creePar: ROCHAMBEAU,
  creeLe: '2026-01-01T10:00:00.000Z',
  ...modifications,
});

describe('avancement', () => {
  it('compte les jalons faits, pas les intentions', () => {
    const a = avancementProjet(
      projet([
        jalon('1', { faitLe: MAINTENANT }),
        jalon('2'),
        jalon('3', { faitLe: MAINTENANT }),
        jalon('4'),
      ]),
      MAINTENANT,
    );

    expect(a.total).toBe(4);
    expect(a.faits).toBe(2);
    expect(a.pourcentage).toBe(50);
    expect(a.etat).toBe('en_cours');
  });

  it('ne divise pas par zéro sur un projet sans jalon', () => {
    const a = avancementProjet(projet([]), MAINTENANT);
    expect(a.pourcentage).toBe(0);
    expect(a.etat).toBe('a_lancer');
    expect(a.prochainJalon).toBeUndefined();
  });

  it('reconnaît un projet terminé et un projet archivé', () => {
    const fini = avancementProjet(
      projet([jalon('1', { faitLe: MAINTENANT })]),
      MAINTENANT,
    );
    expect(fini.etat).toBe('termine');

    const range = avancementProjet(
      projet([jalon('1', { faitLe: MAINTENANT })], { archiveLe: MAINTENANT }),
      MAINTENANT,
    );
    expect(range.etat).toBe('archive');
  });

  it('désigne le prochain jalon par échéance, les sans-date en dernier', () => {
    const a = avancementProjet(
      projet([
        jalon('sans-date'),
        jalon('tard', { echeance: '2026-06-01' }),
        jalon('tot', { echeance: '2026-04-01' }),
      ]),
      MAINTENANT,
    );
    expect(a.prochainJalon?.id).toBe('tot');
  });

  it('signale les échéances dépassées, sans compter celles qui sont faites', () => {
    const a = avancementProjet(
      projet([
        jalon('oublie', { echeance: '2026-03-01' }),
        jalon('fait-a-temps', { echeance: '2026-03-01', faitLe: MAINTENANT }),
        jalon('a-venir', { echeance: '2026-05-01' }),
      ]),
      MAINTENANT,
    );
    expect(a.enRetard.map((j) => j.id)).toEqual(['oublie']);
  });
});

describe('bascule d’un jalon', () => {
  it('coche en notant qui, puis décoche proprement', () => {
    const initial = projet([jalon('1')]);

    const coche = basculerJalon(initial, '1', GAELLE, MAINTENANT);
    expect(coche.jalons[0]?.faitLe).toBe(MAINTENANT);
    expect(coche.jalons[0]?.faitPar).toBe(GAELLE);

    const decoche = basculerJalon(coche, '1', ROCHAMBEAU, MAINTENANT);
    expect(decoche.jalons[0]?.faitLe).toBeUndefined();
    expect(decoche.jalons[0]?.faitPar).toBeUndefined();
  });

  it('ne touche pas aux autres jalons', () => {
    const initial = projet([jalon('1'), jalon('2')]);
    const apres = basculerJalon(initial, '1', GAELLE, MAINTENANT);
    expect(apres.jalons[1]).toEqual(initial.jalons[1]);
  });
});

describe('aucun classement entre les deux', () => {
  it('n’expose aucune fonction qui compterait les jalons par personne', () => {
    // Un projet de couple avance ou n'avance pas ; personne n'avance plus que
    // l'autre. Ce test empêche qu'une barre de progression par partenaire
    // apparaisse un jour par inadvertance.
    const interdits = /parPartenaire|parPersonne|classement|contribution/i;
    expect(Object.keys(moduleAvancement).filter((n) => interdits.test(n))).toEqual(
      [],
    );
  });

  it('donne le même avancement quel que soit l’auteur des jalons', () => {
    const parGaelle = projet([
      jalon('1', { faitLe: MAINTENANT, faitPar: GAELLE }),
      jalon('2', { faitLe: MAINTENANT, faitPar: GAELLE }),
    ]);
    const partage = projet([
      jalon('1', { faitLe: MAINTENANT, faitPar: GAELLE }),
      jalon('2', { faitLe: MAINTENANT, faitPar: ROCHAMBEAU }),
    ]);

    expect(avancementProjet(parGaelle, MAINTENANT).pourcentage).toBe(
      avancementProjet(partage, MAINTENANT).pourcentage,
    );
  });
});

describe('tri des projets', () => {
  it('met les projets vivants devant, les archivés derrière', () => {
    const enCours = projet([jalon('1', { faitLe: MAINTENANT }), jalon('2')], {
      id: 'en-cours',
    });
    const aLancer = projet([jalon('1')], { id: 'a-lancer' });
    const termine = projet([jalon('1', { faitLe: MAINTENANT })], {
      id: 'termine',
    });
    const archive = projet([jalon('1')], {
      id: 'archive',
      archiveLe: MAINTENANT,
    });

    expect(
      trierProjets([archive, termine, aLancer, enCours], MAINTENANT).map(
        (p) => p.id,
      ),
    ).toEqual(['en-cours', 'a-lancer', 'termine', 'archive']);
  });
});
