import { describe, expect, it } from 'vitest';
import { prochaineEcheanceProjet } from './avancement';
import type { Projet } from '../types/projets';

const projet = (
  id: string,
  titre: string,
  jalons: Projet['jalons'],
  archiveLe?: string,
): Projet => ({
  id,
  titre,
  jalons,
  creePar: 'gaelle',
  creeLe: '2026-01-01T10:00:00.000Z',
  ...(archiveLe ? { archiveLe } : {}),
});

describe('prochaine échéance de projet', () => {
  it('ne rend rien sans projet', () => {
    expect(prochaineEcheanceProjet([])).toBeUndefined();
  });

  it('rend la plus proche, tous projets confondus', () => {
    const echeance = prochaineEcheanceProjet([
      projet('p1', 'Voyage', [{ id: 'j1', titre: 'Réserver', echeance: '2026-10-01' }]),
      projet('p2', 'Salon', [{ id: 'j2', titre: 'Mesurer', echeance: '2026-09-15' }]),
    ]);
    expect(echeance?.projetTitre).toBe('Salon');
    expect(echeance?.jalon.id).toBe('j2');
  });

  it('écarte les jalons faits et ceux sans date', () => {
    expect(
      prochaineEcheanceProjet([
        projet('p1', 'Voyage', [
          { id: 'j1', titre: 'Fait', echeance: '2026-09-01', faitLe: '2026-08-01T10:00:00.000Z' },
          { id: 'j2', titre: 'Sans date' },
        ]),
      ]),
    ).toBeUndefined();
  });

  it('écarte les projets archivés', () => {
    expect(
      prochaineEcheanceProjet([
        projet('p1', 'Ancien', [{ id: 'j1', titre: 'À faire', echeance: '2026-09-01' }], '2026-08-01T10:00:00.000Z'),
      ]),
    ).toBeUndefined();
  });

  it('garde une échéance déjà dépassée', () => {
    // C'est justement celle qu'il faut voir : la masquer ferait disparaître ce
    // qu'on a laissé filer.
    const echeance = prochaineEcheanceProjet([
      projet('p1', 'Voyage', [{ id: 'j1', titre: 'Réserver', echeance: '2020-01-01' }]),
    ]);
    expect(echeance?.jalon.id).toBe('j1');
  });

  it('départage deux échéances du même jour de façon stable', () => {
    const projets = [
      projet('p2', 'Salon', [{ id: 'j2', titre: 'B', echeance: '2026-09-15' }]),
      projet('p1', 'Ailleurs', [{ id: 'j1', titre: 'A', echeance: '2026-09-15' }]),
    ];
    expect(prochaineEcheanceProjet(projets)?.projetTitre).toBe('Ailleurs');
    expect(prochaineEcheanceProjet([...projets].reverse())?.projetTitre).toBe(
      'Ailleurs',
    );
  });
});
