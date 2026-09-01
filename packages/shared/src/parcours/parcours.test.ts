import { describe, expect, it } from 'vitest';
import {
  AVERTISSEMENT,
  PARCOURS,
  parcoursParId,
  THEMES_PARCOURS,
} from './catalogue';
import {
  marquerEchangee,
  repondreSeance,
  vueParcours,
  type ParcoursEngage,
} from './progression';
import { recommanderParcours } from './recommandation';

const MOI = 'rochambeau';
const AUTRE = 'gaelle';
const T0 = '2026-09-01T10:00:00.000Z';

const communication = parcoursParId('communication-1')!;

const neuf = (parcoursId: string): ParcoursEngage => ({
  parcoursId,
  commenceLe: T0,
  avancees: [],
});

/** Répond des deux côtés puis marque l'échange : une séance entière. */
function faireSeance(
  engage: ParcoursEngage,
  seanceId: string,
): ParcoursEngage {
  const a = repondreSeance(communication, engage, seanceId, MOI, 'm1.a.a', T0);
  expect(a.ok).toBe(true);
  const b = repondreSeance(
    communication,
    (a as { engage: ParcoursEngage }).engage,
    seanceId,
    AUTRE,
    'm1.b.b',
    T0,
  );
  expect(b.ok).toBe(true);
  const c = marquerEchangee(
    communication,
    (b as { engage: ParcoursEngage }).engage,
    seanceId,
    T0,
  );
  expect(c.ok).toBe(true);
  return (c as { engage: ParcoursEngage }).engage;
}

describe('catalogue', () => {
  it('propose 5 à 10 séances par parcours, comme le cahier le demande', () => {
    for (const p of PARCOURS) {
      expect(p.seances.length).toBeGreaterThanOrEqual(5);
      expect(p.seances.length).toBeLessThanOrEqual(10);
    }
  });

  it('couvre les cinq thématiques citées', () => {
    const themes = new Set(PARCOURS.map((p) => p.theme));
    for (const t of THEMES_PARCOURS) expect(themes).toContain(t.code);
  });

  it('n’a aucun identifiant en double', () => {
    const ids = PARCOURS.flatMap((p) => [p.id, ...p.seances.map((s) => s.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dit qu’il ne remplace pas un professionnel', () => {
    expect(AVERTISSEMENT).toMatch(/professionnel/);
  });
});

describe('la règle du miroir', () => {
  it('cache la réponse de l’autre tant que je n’ai pas écrit', () => {
    const engage = repondreSeance(
      communication,
      neuf(communication.id),
      communication.seances[0]!.id,
      AUTRE,
      'm1.x.y',
      T0,
    );
    const vue = vueParcours(
      communication,
      (engage as { engage: ParcoursEngage }).engage,
      MOI,
    );

    expect(vue.courante?.etat).toBe('lui_seul');
    expect(vue.courante?.sienne).toBeUndefined();
  });

  it('ouvre les deux réponses une fois les deux écrites', () => {
    let e = neuf(communication.id);
    const seanceId = communication.seances[0]!.id;
    e = (
      repondreSeance(communication, e, seanceId, MOI, 'm1.a.a', T0) as {
        engage: ParcoursEngage;
      }
    ).engage;
    e = (
      repondreSeance(communication, e, seanceId, AUTRE, 'm1.b.b', T0) as {
        engage: ParcoursEngage;
      }
    ).engage;

    const vue = vueParcours(communication, e, MOI);
    expect(vue.courante?.etat).toBe('a_echanger');
    expect(vue.courante?.sienne?.texteScelle).toBe('m1.b.b');
  });

  it('refuse de réécrire une réponse déjà donnée', () => {
    const seanceId = communication.seances[0]!.id;
    const e = (
      repondreSeance(
        communication,
        neuf(communication.id),
        seanceId,
        MOI,
        'm1.a.a',
        T0,
      ) as { engage: ParcoursEngage }
    ).engage;

    const encore = repondreSeance(
      communication,
      e,
      seanceId,
      MOI,
      'm1.a2.a2',
      T0,
    );
    expect(encore).toEqual({ ok: false, motif: 'deja_repondu' });
  });
});

describe('progression', () => {
  it('n’avance pas tant que le temps ensemble n’a pas eu lieu', () => {
    let e = neuf(communication.id);
    const seanceId = communication.seances[0]!.id;
    e = (
      repondreSeance(communication, e, seanceId, MOI, 'm1.a.a', T0) as {
        engage: ParcoursEngage;
      }
    ).engage;
    e = (
      repondreSeance(communication, e, seanceId, AUTRE, 'm1.b.b', T0) as {
        engage: ParcoursEngage;
      }
    ).engage;

    const vue = vueParcours(communication, e, MOI);
    expect(vue.seancesFaites).toBe(0);
    expect(vue.courante?.rang).toBe(1);
  });

  it('passe à la séance suivante une fois l’échange marqué', () => {
    const e = faireSeance(neuf(communication.id), communication.seances[0]!.id);
    const vue = vueParcours(communication, e, MOI);

    expect(vue.seancesFaites).toBe(1);
    expect(vue.courante?.rang).toBe(2);
    expect(vue.courante?.seance.id).toBe(communication.seances[1]!.id);
  });

  it('refuse de sauter une séance', () => {
    const refus = repondreSeance(
      communication,
      neuf(communication.id),
      communication.seances[3]!.id,
      MOI,
      'm1.a.a',
      T0,
    );
    expect(refus).toEqual({ ok: false, motif: 'pas_la_seance_courante' });
  });

  it('refuse de marquer un échange que l’un n’a pas préparé', () => {
    const seanceId = communication.seances[0]!.id;
    const e = (
      repondreSeance(
        communication,
        neuf(communication.id),
        seanceId,
        MOI,
        'm1.a.a',
        T0,
      ) as { engage: ParcoursEngage }
    ).engage;

    expect(marquerEchangee(communication, e, seanceId, T0)).toEqual({
      ok: false,
      motif: 'reponses_incompletes',
    });
  });

  it('marque le parcours terminé à la dernière séance', () => {
    let e = neuf(communication.id);
    for (const s of communication.seances) e = faireSeance(e, s.id);

    expect(e.termineLe).toBe(T0);
    const vue = vueParcours(communication, e, MOI);
    expect(vue.termine).toBe(true);
    expect(vue.courante).toBeUndefined();
    expect(vue.seancesFaites).toBe(communication.seances.length);
  });

  it('ne répond plus une fois le parcours terminé', () => {
    let e = neuf(communication.id);
    for (const s of communication.seances) e = faireSeance(e, s.id);

    const refus = repondreSeance(
      communication,
      e,
      communication.seances[0]!.id,
      MOI,
      'm1.a.a',
      T0,
    );
    expect(refus).toEqual({ ok: false, motif: 'parcours_termine' });
  });
});

describe('recommandation douce', () => {
  it('se tait quand rien ne ressort', () => {
    expect(recommanderParcours({})).toBeUndefined();
    expect(
      recommanderParcours({ axesOuverts: { communication: 2 } }),
    ).toBeUndefined();
  });

  it('propose au seuil, sur le thème observé', () => {
    const r = recommanderParcours({ axesOuverts: { communication: 3 } });
    expect(r?.parcours.theme).toBe('communication');
    expect(r?.motif).toContain('3 axes');
  });

  it('n’en propose qu’un, le plus net', () => {
    const r = recommanderParcours({
      axesOuverts: { communication: 3, quotidien: 5 },
    });
    expect(r?.parcours.theme).toBe('charge_mentale');
  });

  it('fait passer le désir d’enfant devant', () => {
    const r = recommanderParcours({
      desirEnfant: true,
      axesOuverts: { communication: 9 },
    });
    expect(r?.parcours.theme).toBe('desir_enfant');
  });

  it('ne repropose pas un parcours déjà engagé', () => {
    const r = recommanderParcours({
      axesOuverts: { communication: 4 },
      dejaEngages: ['communication-1'],
    });
    expect(r).toBeUndefined();
  });

  it('attend deux mois avant de parler d’argent', () => {
    expect(recommanderParcours({ budgetDepasseDeSuite: 1 })).toBeUndefined();
    expect(
      recommanderParcours({ budgetDepasseDeSuite: 2 })?.parcours.theme,
    ).toBe('argent');
  });

  it('ne rattache pas de force un thème sans parcours', () => {
    // « temps ensemble » relève de Complicité & connexion, pas d'un parcours.
    expect(
      recommanderParcours({ axesOuverts: { temps_ensemble: 8 } }),
    ).toBeUndefined();
  });
});
