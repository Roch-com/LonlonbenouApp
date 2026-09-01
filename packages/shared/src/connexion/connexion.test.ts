import { describe, expect, it } from 'vitest';
import {
  depouiller,
  LANGAGES,
  QUESTIONS_LANGAGES,
  questionnaireComplet,
  vueLangages,
  type Choix,
} from './langages';
import { RITUELS, rituelDuJour, rituelsSuggeres } from './rituels';
import { inviterReconnexion } from './distance';

const MOI = 'rochambeau';
const AUTRE = 'gaelle';
const T0 = '2026-09-01T10:00:00.000Z';

/** Répond à tout, en choisissant systématiquement le côté demandé. */
const toutRepondre = (cote: 'a' | 'b'): Choix =>
  Object.fromEntries(QUESTIONS_LANGAGES.map((q) => [q.id, cote]));

/** Répond de façon à faire ressortir un langage donné. */
function pousser(langage: string): Choix {
  const choix: Record<string, 'a' | 'b'> = {};
  for (const q of QUESTIONS_LANGAGES) {
    choix[q.id] = q.a.langage === langage ? 'a' : 'b';
  }
  return choix;
}

describe('questionnaire', () => {
  it('oppose toujours deux langages différents', () => {
    for (const q of QUESTIONS_LANGAGES) expect(q.a.langage).not.toBe(q.b.langage);
  });

  it('n’a aucun identifiant en double', () => {
    const ids = QUESTIONS_LANGAGES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('met chaque langage en jeu', () => {
    const vus = new Set(QUESTIONS_LANGAGES.flatMap((q) => [q.a.langage, q.b.langage]));
    for (const l of LANGAGES) expect(vus).toContain(l.code);
  });

  it('ne se dit complet qu’une fois tout répondu', () => {
    expect(questionnaireComplet({})).toBe(false);
    const presque = { ...toutRepondre('a') };
    delete presque[QUESTIONS_LANGAGES[0]!.id];
    expect(questionnaireComplet(presque)).toBe(false);
    expect(questionnaireComplet(toutRepondre('a'))).toBe(true);
  });
});

describe('dépouillement', () => {
  it('fait ressortir le langage poussé', () => {
    for (const langage of LANGAGES) {
      expect(depouiller(pousser(langage.code)).dominant).toBe(langage.code);
    }
  });

  it('compte autant de réponses que de questions', () => {
    expect(depouiller(toutRepondre('a')).repondues).toBe(QUESTIONS_LANGAGES.length);
  });

  it('tolère un questionnaire partiel', () => {
    const partiel = { [QUESTIONS_LANGAGES[0]!.id]: 'a' } as Choix;
    const resultat = depouiller(partiel);
    expect(resultat.repondues).toBe(1);
    expect(resultat.ordre).toHaveLength(LANGAGES.length);
  });

  it('donne un ordre stable en cas d’égalité', () => {
    const vide = depouiller({});
    expect(vide.ordre).toEqual(LANGAGES.map((l) => l.code));
    expect(depouiller({}).ordre).toEqual(vide.ordre);
  });
});

describe('le miroir des résultats', () => {
  it('cache celui de l’autre tant que je n’ai pas répondu', () => {
    const vue = vueLangages(
      [{ partenaireId: AUTRE, choix: toutRepondre('a'), majLe: T0 }],
      MOI,
    );
    expect(vue.etat).toBe('lui_seul');
    expect(vue.sien).toBeUndefined();
    expect(vue.pistes).toEqual([]);
  });

  it('garde le mien fermé tant que l’autre n’a pas fini', () => {
    const vue = vueLangages(
      [{ partenaireId: MOI, choix: toutRepondre('a'), majLe: T0 }],
      MOI,
    );
    expect(vue.etat).toBe('moi_seul');
    expect(vue.mien).toBeDefined();
    expect(vue.sien).toBeUndefined();
  });

  it('n’ouvre rien sur un questionnaire inachevé', () => {
    const presque = { ...toutRepondre('a') };
    delete presque[QUESTIONS_LANGAGES[0]!.id];

    const vue = vueLangages(
      [
        { partenaireId: MOI, choix: toutRepondre('b'), majLe: T0 },
        { partenaireId: AUTRE, choix: presque, majLe: T0 },
      ],
      MOI,
    );
    expect(vue.etat).toBe('moi_seul');
    expect(vue.sien).toBeUndefined();
  });

  it('ouvre les deux une fois les deux finis, avec une piste sur l’autre', () => {
    const vue = vueLangages(
      [
        { partenaireId: MOI, choix: pousser('paroles'), majLe: T0 },
        { partenaireId: AUTRE, choix: pousser('contact'), majLe: T0 },
      ],
      MOI,
    );
    expect(vue.etat).toBe('les_deux');
    expect(vue.mien?.dominant).toBe('paroles');
    expect(vue.sien?.dominant).toBe('contact');
    // La piste porte sur ce que l'autre reçoit, pas sur ce que je préfère.
    expect(vue.pistes[0]).toBe(
      LANGAGES.find((l) => l.code === 'contact')!.pistePourLautre,
    );
  });

  it('est symétrique : chacun voit la même chose de son côté', () => {
    const reponses = [
      { partenaireId: MOI, choix: pousser('paroles'), majLe: T0 },
      { partenaireId: AUTRE, choix: pousser('contact'), majLe: T0 },
    ];
    const aMoi = vueLangages(reponses, MOI);
    const aLautre = vueLangages(reponses, AUTRE);

    expect(aMoi.etat).toBe(aLautre.etat);
    expect(aMoi.mien?.dominant).toBe(aLautre.sien?.dominant);
    expect(aMoi.sien?.dominant).toBe(aLautre.mien?.dominant);
  });
});

describe('rituels', () => {
  it('tombe sur le même des deux côtés, un jour donné', () => {
    expect(rituelDuJour('2026-09-01').id).toBe(rituelDuJour('2026-09-01').id);
  });

  it('tourne d’un jour à l’autre', () => {
    const sur15 = new Set(
      Array.from({ length: RITUELS.length }, (_, i) =>
        rituelDuJour(`2026-09-${String(i + 1).padStart(2, '0')}`).id,
      ),
    );
    expect(sur15.size).toBe(RITUELS.length);
  });

  it('rend le catalogue entier sans préférence connue', () => {
    expect(rituelsSuggeres()).toHaveLength(RITUELS.length);
  });

  it('remonte ce qui touche l’autre', () => {
    expect(rituelsSuggeres(['contact', 'paroles'])[0]!.langage).toBe('contact');
  });

  it('ne perd rien en triant', () => {
    expect(rituelsSuggeres(['contact'])).toHaveLength(RITUELS.length);
  });

  it('filtre par durée quand on la précise', () => {
    const courts = rituelsSuggeres(undefined, 'un instant');
    expect(courts.length).toBeGreaterThan(0);
    for (const r of courts) expect(r.duree).toBe('un instant');
  });
});

describe('le rappel doux', () => {
  it('se tait sur un seul signal', () => {
    expect(
      inviterReconnexion({ joursSansInitiative: 60 }, '2026-09-01'),
    ).toBeUndefined();
    expect(
      inviterReconnexion({ joursSansMessage: 60 }, '2026-09-01'),
    ).toBeUndefined();
  });

  it('se tait sous les seuils', () => {
    expect(
      inviterReconnexion(
        { joursSansInitiative: 20, joursSansMessage: 9 },
        '2026-09-01',
      ),
    ).toBeUndefined();
  });

  it('propose quand deux signaux se croisent', () => {
    const invitation = inviterReconnexion(
      { joursSansInitiative: 21, joursSansMessage: 10 },
      '2026-09-01',
    );
    expect(invitation).toBeDefined();
    expect(invitation!.rituel.titre).toBeTruthy();
  });

  it('ne nomme personne et ne compte rien', () => {
    const invitation = inviterReconnexion(
      { joursSansInitiative: 90, joursSansMessage: 90 },
      '2026-09-01',
    )!;
    expect(invitation.lecture).not.toMatch(/\d/);
    expect(invitation.lecture).not.toMatch(/partenaire|il |elle /i);
  });

  it('dit la même chose aux deux, le même jour', () => {
    const signaux = { joursSansInitiative: 30, joursSansMessage: 15 };
    const a = inviterReconnexion(signaux, '2026-09-01', ['contact']);
    const b = inviterReconnexion(signaux, '2026-09-01', ['contact']);
    expect(a).toEqual(b);
  });
});
