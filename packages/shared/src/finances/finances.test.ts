import { describe, expect, it } from 'vitest';
import {
  definitionDevise,
  depensesDuMois,
  equilibre,
  lectureBudget,
  montantLisible,
  parCategorie,
  partsEffectives,
  type ContenuDepense,
} from './finances';

const A = 'rochambeau';
const B = 'gaelle';
const DUO: readonly [string, string] = [A, B];

const d = (montant: number, payePar: string, partiel: Partial<ContenuDepense> = {}): ContenuDepense => ({
  libelle: 'Courses',
  montant,
  categorie: 'courses',
  payePar,
  ...partiel,
});

describe('parts', () => {
  it('partage à moitié par défaut', () => {
    expect(partsEffectives({ mode: 'egal' }, DUO)).toEqual({ [A]: 0.5, [B]: 0.5 });
  });

  it('renormalise des parts qui ne somment pas à 1', () => {
    // Le réglage vient d'une interface : un arrondi ne doit pas produire des
    // dus absurdes ni bloquer la saisie.
    const parts = partsEffectives(
      { mode: 'personnalise', parts: { [A]: 3, [B]: 1 } },
      DUO,
    );
    expect(parts[A]).toBeCloseTo(0.75, 6);
    expect(parts[B]).toBeCloseTo(0.25, 6);
  });

  it('retombe à moitié plutôt que de diviser par zéro', () => {
    expect(
      partsEffectives({ mode: 'revenus', parts: { [A]: 0, [B]: 0 } }, DUO),
    ).toEqual({ [A]: 0.5, [B]: 0.5 });
  });
});

describe('équilibre', () => {
  it('ne doit rien quand chacun a avancé sa part', () => {
    const bilan = equilibre([d(1000, A), d(1000, B)], DUO, { mode: 'egal' });
    expect(bilan.regularisation).toBeUndefined();
  });

  it('dit qui rend et combien, sans qualifier personne', () => {
    // Rochambeau a tout avancé : la moitié lui revient.
    const bilan = equilibre([d(4000, A)], DUO, { mode: 'egal' });
    expect(bilan.regularisation).toEqual({ de: B, vers: A, montant: 2000 });
  });

  it('suit la règle choisie plutôt que l’égalité stricte', () => {
    // Trois quarts pour A : sur 4000 avancés par B, A lui doit 3000.
    const bilan = equilibre([d(4000, B)], DUO, {
      mode: 'revenus',
      parts: { [A]: 0.75, [B]: 0.25 },
    });
    expect(bilan.regularisation).toEqual({ de: A, vers: B, montant: 3000 });
  });

  it('ne laisse pas traîner une unité d’arrondi', () => {
    // 1001 partagé en deux ne tombe pas juste : le reste doit être attribué,
    // pas perdu. Additionner deux parts arrondies laisserait un résidu.
    const bilan = equilibre([d(1001, A)], DUO, { mode: 'egal' });
    expect((bilan.du[A] ?? 0) + (bilan.du[B] ?? 0)).toBe(1001);
  });

  it('ignore les montants absurdes plutôt que de propager NaN', () => {
    const bilan = equilibre(
      [d(Number.NaN, A), d(-500, B), d(0, A), d(600, A)],
      DUO,
      { mode: 'egal' },
    );
    expect(bilan.avance[A]).toBe(600);
    expect(bilan.avance[B]).toBe(0);
  });

  it('ignore une dépense payée par quelqu’un d’étranger au couple', () => {
    const bilan = equilibre([d(1000, 'intrus'), d(500, A)], DUO, { mode: 'egal' });
    expect(bilan.avance[A]).toBe(500);
    expect((bilan.du[A] ?? 0) + (bilan.du[B] ?? 0)).toBe(500);
  });

  it('ne rend aucun classement des personnes', () => {
    // Le §8.8 interdit au score de classer ; la même règle vaut ici, et plus
    // fort encore. Aucune clé du résultat ne doit ressembler à un palmarès.
    const bilan = equilibre([d(9000, A), d(100, B)], DUO, { mode: 'egal' });
    expect(Object.keys(bilan).sort()).toEqual(['avance', 'du', 'regularisation']);
  });
});

describe('catégories', () => {
  it('classe du plus lourd au plus léger', () => {
    const totaux = parCategorie([
      d(1000, A, { categorie: 'courses' }),
      d(5000, B, { categorie: 'logement' }),
      d(500, A, { categorie: 'courses' }),
    ]);
    expect(totaux).toEqual([
      { categorie: 'logement', total: 5000 },
      { categorie: 'courses', total: 1500 },
    ]);
  });
});

describe('mois', () => {
  it('ne retient que le mois demandé', () => {
    const liste = [
      { jour: '2026-09-01' },
      { jour: '2026-09-30' },
      { jour: '2026-10-01' },
    ];
    expect(depensesDuMois(liste, '2026-09')).toHaveLength(2);
  });
});

describe('budget', () => {
  it('ne dit rien sans budget fixé', () => {
    expect(lectureBudget(5000, undefined)).toBeUndefined();
    expect(lectureBudget(5000, 0)).toBeUndefined();
  });

  it('prévient avant le dépassement, pas seulement après', () => {
    expect(lectureBudget(4300, 5000)?.etat).toBe('proche');
    expect(lectureBudget(2000, 5000)?.etat).toBe('dans_le_budget');
    expect(lectureBudget(5200, 5000)?.etat).toBe('depasse');
  });

  it('constate sans reprocher', () => {
    // « Alertes douces » n'est pas décoratif : un budget dépassé n'est pas une
    // faute, et le texte ne doit désigner aucun responsable.
    const lecture = lectureBudget(6000, 5000)!;
    expect(lecture.lecture).not.toMatch(/trop|faute|attention|devez|auriez/i);
    expect(lecture.lecture).toContain('Cela arrive');
  });
});

describe('affichage', () => {
  it('respecte les décimales de la devise', () => {
    // Le séparateur de milliers français est une espace fine insécable
    // (U+202F), pas une espace ordinaire : l’écrire en clair dans le test
    // ferait échouer une vérification pourtant correcte.
    expect(montantLisible(2500, definitionDevise('XOF'))).toBe('2 500 F');
    expect(montantLisible(2500, definitionDevise('EUR'))).toBe('25,00 €');
  });

  it('retombe sur la devise par défaut si le code est inconnu', () => {
    expect(definitionDevise('ZZZ').code).toBe('XOF');
  });
});
