import { describe, expect, it } from 'vitest';
import type { Evenement } from '../types/calendrier';
import type { Initiative } from '../types/initiatives';
import type { Projet } from '../types/projets';
import { rappelsDus, type SourcesRappel } from './rappels';

const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';
const COUPLE = [ROCHAMBEAU, GAELLE] as const;
const MAINTENANT = '2026-03-15T12:00:00.000Z';

const vide: SourcesRappel = { evenements: [], projets: [], initiatives: [] };

const evenement = (modifications: Partial<Evenement> = {}): Evenement => ({
  id: 'e1',
  titre: 'Dîner chez Marta',
  categorie: 'a_deux',
  debut: '2026-03-15T20:00:00.000Z',
  journeeEntiere: false,
  creePar: ROCHAMBEAU,
  creeLe: '2026-03-01T10:00:00.000Z',
  visibilite: 'couple',
  rappelHeures: 24,
  ...modifications,
});

const projet = (echeance?: string, faitLe?: string): Projet => ({
  id: 'p1',
  titre: 'Partir quelque part',
  jalons: [{ id: 'j1', titre: 'Réserver le train', echeance, faitLe }],
  creePar: GAELLE,
  creeLe: '2026-01-01T10:00:00.000Z',
});

const initiative = (modifications: Partial<Initiative> = {}): Initiative => ({
  id: 'i1',
  titre: 'Marche au lever du jour',
  categorie: 'nature',
  etat: 'prevue',
  proposeePar: GAELLE,
  proposeeLe: '2026-03-01T10:00:00.000Z',
  prevuePour: '2026-03-15',
  ...modifications,
});

const rappels = (sources: Partial<SourcesRappel>, dejaEmis: string[] = []) =>
  rappelsDus({ ...vide, ...sources }, COUPLE, dejaEmis, MAINTENANT);

describe('un rappel s’adresse toujours aux deux', () => {
  it('vise les deux partenaires, quelle que soit la source', () => {
    const tous = rappels({
      evenements: [evenement()],
      projets: [projet('2026-03-15')],
      initiatives: [initiative()],
    });

    expect(tous.length).toBe(3);
    for (const rappel of tous) {
      expect([...rappel.destinataires].sort()).toEqual([GAELLE, ROCHAMBEAU].sort());
    }
  });

  it('ne dépend pas de qui a créé l’élément', () => {
    const parLun = rappels({ evenements: [evenement({ creePar: ROCHAMBEAU })] });
    const parLautre = rappels({ evenements: [evenement({ creePar: GAELLE })] });
    expect(parLun).toEqual(parLautre);
  });
});

describe('fenêtre de rappel des événements', () => {
  it('ne dit rien trop tôt', () => {
    const dansTroisJours = evenement({
      debut: '2026-03-18T20:00:00.000Z',
      rappelHeures: 24,
    });
    expect(rappels({ evenements: [dansTroisJours] })).toEqual([]);
  });

  it('parle une fois dans la fenêtre', () => {
    const liste = rappels({ evenements: [evenement()] });
    expect(liste).toHaveLength(1);
    expect(liste[0]?.texte).toContain('Dîner chez Marta');
  });

  it('se tait une fois l’événement commencé', () => {
    const passe = evenement({ debut: '2026-03-15T09:00:00.000Z' });
    expect(rappels({ evenements: [passe] })).toEqual([]);
  });

  it('ignore un événement sans rappel demandé', () => {
    expect(
      rappels({ evenements: [evenement({ rappelHeures: undefined })] }),
    ).toEqual([]);
  });

  it('omet l’heure pour une journée entière', () => {
    const liste = rappels({
      evenements: [
        evenement({ debut: '2026-03-16', journeeEntiere: true, rappelHeures: 24 }),
      ],
    });
    expect(liste[0]?.texte).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('jalons de projet', () => {
  it('prévient la veille et le jour même, pas avant', () => {
    expect(rappels({ projets: [projet('2026-03-15')] })).toHaveLength(1);
    expect(rappels({ projets: [projet('2026-03-16')] })).toHaveLength(1);
    expect(rappels({ projets: [projet('2026-03-20')] })).toHaveLength(0);
  });

  it('ne relance pas un jalon déjà fait', () => {
    expect(rappels({ projets: [projet('2026-03-15', MAINTENANT)] })).toEqual([]);
  });

  it('laisse tranquille un projet archivé', () => {
    const range = { ...projet('2026-03-15'), archiveLe: MAINTENANT };
    expect(rappels({ projets: [range] })).toEqual([]);
  });
});

describe('sorties prévues', () => {
  it('prévient le jour même seulement', () => {
    expect(rappels({ initiatives: [initiative()] })).toHaveLength(1);
    expect(
      rappels({ initiatives: [initiative({ prevuePour: '2026-03-16' })] }),
    ).toHaveLength(0);
  });

  it('ignore une simple idée', () => {
    expect(
      rappels({
        initiatives: [initiative({ etat: 'idee', prevuePour: undefined })],
      }),
    ).toEqual([]);
  });
});

describe('idempotence', () => {
  it('ne redit pas ce qui a déjà été dit', () => {
    const premier = rappels({ evenements: [evenement()] });
    const cles = premier.map((r) => r.cle);

    expect(rappels({ evenements: [evenement()] }, cles)).toEqual([]);
  });

  it('donne des clés stables et distinctes', () => {
    const tous = rappels({
      evenements: [evenement()],
      projets: [projet('2026-03-15')],
      initiatives: [initiative()],
    });
    const cles = tous.map((r) => r.cle);

    expect(new Set(cles).size).toBe(cles.length);
    expect(
      rappels({
        evenements: [evenement()],
        projets: [projet('2026-03-15')],
        initiatives: [initiative()],
      }).map((r) => r.cle),
    ).toEqual(cles);
  });
});
