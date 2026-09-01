import { describe, expect, it } from 'vitest';
import {
  facturesAVenir,
  prochaineEcheance,
  texteRappelFacture,
  type FactureScellee,
} from './factures';
import { depensesDuProjet, lectureBudget } from './finances';

const facture = (
  premiereEcheance: string,
  periodicite: FactureScellee['periodicite'] = 'mensuelle',
  arreteeLe?: string,
) => ({
  id: 'f1',
  premiereEcheance,
  periodicite,
  ...(arreteeLe ? { arreteeLe } : {}),
});

describe('prochaine échéance', () => {
  it('rend l’échéance elle-même le jour venu', () => {
    expect(prochaineEcheance(facture('2026-09-05'), '2026-09-05')).toBe(
      '2026-09-05',
    );
  });

  it('rend la première tant qu’elle est à venir', () => {
    expect(prochaineEcheance(facture('2026-12-05'), '2026-09-01')).toBe(
      '2026-12-05',
    );
  });

  it('avance d’un mois une fois passée', () => {
    expect(prochaineEcheance(facture('2026-09-05'), '2026-09-06')).toBe(
      '2026-10-05',
    );
  });

  it('suit le trimestre et l’année', () => {
    expect(
      prochaineEcheance(facture('2026-01-15', 'trimestrielle'), '2026-05-01'),
    ).toBe('2026-07-15');
    expect(
      prochaineEcheance(facture('2026-03-20', 'annuelle'), '2026-04-01'),
    ).toBe('2027-03-20');
  });

  it('rattrape un long retard sans boucler', () => {
    expect(prochaineEcheance(facture('2016-01-10'), '2026-09-01')).toBe(
      '2026-09-10',
    );
  });

  it('ne rend rien pour une facture arrêtée', () => {
    expect(
      prochaineEcheance(facture('2026-09-05', 'mensuelle', '2026-08-01'), '2026-09-01'),
    ).toBeUndefined();
  });

  it('ne rend rien sur une date illisible', () => {
    expect(prochaineEcheance(facture('bientôt'), '2026-09-01')).toBeUndefined();
    expect(prochaineEcheance(facture('2026-09-05'), 'demain')).toBeUndefined();
  });
});

describe('les fins de mois', () => {
  it('ramène le 31 au dernier jour du mois', () => {
    expect(prochaineEcheance(facture('2026-01-31'), '2026-02-01')).toBe(
      '2026-02-28',
    );
  });

  it('retrouve le 31 le mois suivant, sans rester coincé au 28', () => {
    // C'est tout l'intérêt de repartir du quantième d'origine : une facture du
    // 31 qui croise février doit redevenir une facture du 31 en mars.
    expect(prochaineEcheance(facture('2026-01-31'), '2026-03-01')).toBe(
      '2026-03-31',
    );
  });

  it('tient compte des années bissextiles', () => {
    expect(prochaineEcheance(facture('2024-01-30'), '2024-02-01')).toBe(
      '2024-02-29',
    );
    expect(prochaineEcheance(facture('2026-01-30'), '2026-02-01')).toBe(
      '2026-02-28',
    );
  });

  it('n’avance jamais dans le passé, quelle que soit la date', () => {
    for (const jour of ['2026-01-01', '2026-02-28', '2026-03-31', '2026-12-31']) {
      const suivante = prochaineEcheance(facture('2026-01-31'), jour);
      expect(suivante).toBeDefined();
      expect(suivante! >= jour).toBe(true);
    }
  });
});

describe('rappels', () => {
  it('prévient trois jours avant, pas plus tôt', () => {
    expect(facturesAVenir([facture('2026-09-05')], '2026-09-01')).toEqual([]);
    expect(facturesAVenir([facture('2026-09-05')], '2026-09-02')).toHaveLength(1);
  });

  it('prévient encore le jour même', () => {
    const rappels = facturesAVenir([facture('2026-09-05')], '2026-09-05');
    expect(rappels[0]!.dans).toBe(0);
  });

  it('ne prévient pas pour une facture arrêtée', () => {
    expect(
      facturesAVenir([facture('2026-09-05', 'mensuelle', '2026-08-01')], '2026-09-04'),
    ).toEqual([]);
  });

  it('donne une clé par échéance, stable', () => {
    const a = facturesAVenir([facture('2026-09-05')], '2026-09-03');
    const b = facturesAVenir([facture('2026-09-05')], '2026-09-04');
    expect(a[0]!.cle).toBe(b[0]!.cle);
    // Le mois suivant est une autre échéance, donc une autre clé.
    const suivant = facturesAVenir([facture('2026-09-05')], '2026-10-04');
    expect(suivant[0]!.cle).not.toBe(a[0]!.cle);
  });

  it('range par échéance', () => {
    const rappels = facturesAVenir(
      [
        { ...facture('2026-09-05'), id: 'tard' },
        { ...facture('2026-09-03'), id: 'tot' },
      ],
      '2026-09-02',
    );
    expect(rappels.map((r) => r.factureId)).toEqual(['tot', 'tard']);
  });
});

describe('le texte du rappel', () => {
  it('ne nomme aucune facture — le serveur ne l’a jamais lue', () => {
    for (const dans of [0, 1, 2, 3]) {
      expect(texteRappelFacture(dans)).not.toMatch(/€|\d+ ?(F|XOF)/);
    }
  });

  it('dit aujourd’hui, demain, puis les jours', () => {
    expect(texteRappelFacture(0)).toContain('aujourd’hui');
    expect(texteRappelFacture(1)).toContain('demain');
    expect(texteRappelFacture(3)).toContain('3 jours');
  });
});

describe('budget par projet', () => {
  it('ne retient que les dépenses du projet', () => {
    const depenses = [
      { projetId: 'p1', montant: 100 },
      { projetId: 'p2', montant: 50 },
      { montant: 20 },
    ];
    expect(depensesDuProjet(depenses, 'p1')).toHaveLength(1);
  });

  it('parle d’enveloppe, pas de mois', () => {
    const projet = lectureBudget(120, 100, 'projet');
    expect(projet?.etat).toBe('depasse');
    expect(projet?.lecture).toContain('enveloppe');
    expect(projet?.lecture).not.toContain('mois');
  });

  it('garde la lecture mensuelle par défaut', () => {
    expect(lectureBudget(120, 100)?.lecture).toContain('mois');
  });

  it('ne reproche rien dans aucun des deux cadres', () => {
    for (const cadre of ['mois', 'projet'] as const) {
      for (const depense of [10, 90, 200]) {
        const lecture = lectureBudget(depense, 100, cadre)!.lecture;
        expect(lecture).not.toMatch(/faute|trop|attention|devriez/i);
      }
    }
  });
});
