import { describe, expect, it } from 'vitest';
import { construireJournal, grouperParAnnee } from './journal';
import type { Projet } from '../types/projets';
import type { AxeCroissance } from '../types/croissance';
import type { Initiative } from '../types/initiatives';
import type { Souvenir } from './souvenirs';

const AUJOURDHUI = '2026-09-01T12:00:00.000Z';

const projetTermine: Projet = {
  id: 'p1',
  titre: 'Partir en Casamance',
  intention: 'Se retrouver ailleurs que dans le quotidien.',
  jalons: [
    { id: 'j1', titre: 'Réserver', faitLe: '2026-03-10T10:00:00.000Z' },
    { id: 'j2', titre: 'Partir', faitLe: '2026-04-02T10:00:00.000Z' },
  ],
  creePar: 'gaelle',
  creeLe: '2026-01-05T10:00:00.000Z',
};

const projetEnCours: Projet = {
  id: 'p2',
  titre: 'Réaménager le salon',
  jalons: [
    { id: 'j3', titre: 'Mesurer', faitLe: '2026-05-01T10:00:00.000Z' },
    { id: 'j4', titre: 'Acheter' },
  ],
  creePar: 'rochambeau',
  creeLe: '2026-04-20T10:00:00.000Z',
};

const axeClos: AxeCroissance = {
  id: 'a1',
  theme: 'communication',
  titre: 'Se dire les choses plus tôt',
  ouvertPar: 'gaelle',
  ouvertLe: '2026-02-01T10:00:00.000Z',
  contributions: [],
  clotureLe: '2026-06-15T10:00:00.000Z',
};

const axeOuvert: AxeCroissance = {
  id: 'a2',
  theme: 'quotidien',
  titre: 'Répartir la charge',
  ouvertPar: 'rochambeau',
  ouvertLe: '2026-07-01T10:00:00.000Z',
  contributions: [],
};

const initiativeVecue: Initiative = {
  id: 'i1',
  titre: 'Dîner sans téléphone',
  categorie: 'restaurant',
  etat: 'vecue',
  proposeePar: 'rochambeau',
  proposeeLe: '2026-05-01T10:00:00.000Z',
  vecueLe: '2026-05-08T10:00:00.000Z',
  souvenir: 'On a parlé jusqu’à la fermeture.',
};

const initiativePrevue: Initiative = {
  id: 'i2',
  titre: 'Une expo au hasard',
  categorie: 'culture',
  etat: 'prevue',
  proposeePar: 'gaelle',
  proposeeLe: '2026-08-20T10:00:00.000Z',
  prevuePour: '2026-10-01',
};

const souvenir: Souvenir = {
  id: 's1',
  sorte: 'moment',
  jour: '2026-07-14',
  creePar: 'gaelle',
  creeLe: '2026-07-14T20:00:00.000Z',
  contenu: { titre: 'Le feu d’artifice', note: 'Depuis le toit.' },
};

describe('ce qui entre dans la frise', () => {
  it('prend un projet terminé, à la date du dernier jalon', () => {
    const journal = construireJournal({ projets: [projetTermine] }, AUJOURDHUI);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      sorte: 'projet',
      jour: '2026-04-02',
      titre: 'Partir en Casamance',
    });
  });

  it('écarte un projet encore en cours', () => {
    expect(construireJournal({ projets: [projetEnCours] }, AUJOURDHUI)).toEqual(
      [],
    );
  });

  it('prend un axe refermé, pas un axe ouvert', () => {
    const journal = construireJournal(
      { axes: [axeClos, axeOuvert] },
      AUJOURDHUI,
    );
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ sorte: 'progres', jour: '2026-06-15' });
  });

  it('prend une sortie vécue, pas une sortie prévue', () => {
    const journal = construireJournal(
      { initiatives: [initiativeVecue, initiativePrevue] },
      AUJOURDHUI,
    );
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      sorte: 'initiative',
      detail: 'On a parlé jusqu’à la fermeture.',
    });
  });

  it('prend les souvenirs et les parcours achevés', () => {
    const journal = construireJournal(
      {
        souvenirs: [souvenir],
        parcours: [
          {
            parcoursId: 'communication-1',
            titre: 'Se dire les choses plus tôt',
            termineLe: '2026-08-01T10:00:00.000Z',
          },
        ],
      },
      AUJOURDHUI,
    );
    expect(journal.map((e) => e.sorte)).toEqual(['parcours', 'souvenir']);
  });

  it('ne montre jamais l’avenir', () => {
    const journal = construireJournal(
      { souvenirs: [{ ...souvenir, id: 's2', jour: '2027-01-01' }] },
      AUJOURDHUI,
    );
    expect(journal).toEqual([]);
  });
});

describe('ce que la frise ne dit pas', () => {
  it('ne nomme personne, sur aucune entrée', () => {
    const journal = construireJournal(
      {
        depuis: '2020-06-12',
        projets: [projetTermine],
        axes: [axeClos],
        initiatives: [initiativeVecue],
        souvenirs: [souvenir],
      },
      AUJOURDHUI,
    );

    const texte = JSON.stringify(journal);
    expect(texte).not.toContain('gaelle');
    expect(texte).not.toContain('rochambeau');
  });
});

describe('anniversaires', () => {
  it('compte les années révolues, pas l’origine', () => {
    const journal = construireJournal({ depuis: '2023-06-12' }, AUJOURDHUI);
    expect(journal.map((e) => e.jour)).toEqual([
      '2026-06-12',
      '2025-06-12',
      '2024-06-12',
    ]);
  });

  it('s’arrête à aujourd’hui', () => {
    // Le 12 décembre 2026 n'a pas encore eu lieu au 1er septembre.
    const journal = construireJournal({ depuis: '2023-12-12' }, AUJOURDHUI);
    expect(journal.map((e) => e.jour)).toEqual(['2025-12-12', '2024-12-12']);
  });

  it('ne fabrique pas de 29 février les années communes', () => {
    const journal = construireJournal(
      { depuis: '2020-02-29' },
      '2026-09-01T12:00:00.000Z',
    );
    // Seul 2024 est bissextile dans l'intervalle.
    expect(journal.map((e) => e.jour)).toEqual(['2024-02-29']);
  });

  it('n’en rend aucun la première année', () => {
    expect(construireJournal({ depuis: '2026-06-12' }, AUJOURDHUI)).toEqual([]);
  });
});

describe('robustesse', () => {
  it('rend une frise vide sans source', () => {
    expect(construireJournal({}, AUJOURDHUI)).toEqual([]);
  });

  it('écarte en silence une date illisible', () => {
    const journal = construireJournal(
      { souvenirs: [{ ...souvenir, id: 's3', jour: 'bientôt' }] },
      AUJOURDHUI,
    );
    expect(journal).toEqual([]);
  });

  it('donne le même résultat deux fois de suite', () => {
    const sources = {
      depuis: '2023-06-12',
      projets: [projetTermine],
      axes: [axeClos],
      initiatives: [initiativeVecue],
      souvenirs: [souvenir],
    };
    expect(construireJournal(sources, AUJOURDHUI)).toEqual(
      construireJournal(sources, AUJOURDHUI),
    );
  });
});

describe('ordre et regroupement', () => {
  it('va du plus récent au plus ancien', () => {
    const journal = construireJournal(
      {
        depuis: '2023-06-12',
        projets: [projetTermine],
        axes: [axeClos],
        initiatives: [initiativeVecue],
        souvenirs: [souvenir],
      },
      AUJOURDHUI,
    );
    const jours = journal.map((e) => e.jour);
    expect([...jours].sort().reverse()).toEqual(jours);
  });

  it('groupe par année, la plus récente en tête', () => {
    const groupes = grouperParAnnee(
      construireJournal({ depuis: '2023-06-12' }, AUJOURDHUI),
    );
    expect(groupes.map((g) => g.annee)).toEqual(['2026', '2025', '2024']);
    expect(groupes[0]!.entrees).toHaveLength(1);
  });

  it('ne perd rien en groupant', () => {
    const journal = construireJournal(
      { depuis: '2023-06-12', souvenirs: [souvenir] },
      AUJOURDHUI,
    );
    const total = grouperParAnnee(journal).reduce(
      (n, g) => n + g.entrees.length,
      0,
    );
    expect(total).toBe(journal.length);
  });
});
