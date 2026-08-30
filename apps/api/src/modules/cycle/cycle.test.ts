/** Pôle ④ — le serveur rejoue `vuePartenaire` et ne rend jamais le brut. */
import { describe, expect, it } from 'vitest';
import { NIVEAUX_CYCLE, SYMPTOMES } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type App = Awaited<ReturnType<typeof monterServeur>>['app'];

/** Gaëlle porte le cycle ; Rochambeau est le partenaire. */
async function monterCycle(
  niveau?: string,
  /** Carnet vide : le cycle est déclaré, mais aucune règle n’est saisie. */
  options?: { sansRegles?: boolean },
) {
  const serveur = await monterServeur();
  const { app } = serveur;

  await app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/cycle/porteuse`,
    headers: entete(GAELLE),
    payload: { porteuseId: GAELLE },
  });

  // Un cycle démarré il y a quatre jours : phase menstruelle.
  const debut = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
  if (!options?.sansRegles) {
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/cycle/regles`,
      headers: entete(GAELLE),
      payload: { debutLe: debut },
    });

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/cycle/symptomes`,
      headers: entete(GAELLE),
      payload: {
        date: debut,
        type: 'crampes',
        intensite: 3,
        note: 'nuit difficile',
      },
    });
  }

  if (niveau) {
    await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/niveau`,
      headers: entete(GAELLE),
      payload: { niveau },
    });
  }

  return { ...serveur, debut };
}

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/cycle`,
    headers: entete(qui),
  });

describe('le brut ne quitte jamais le serveur', () => {
  it('ne laisse passer ni date, ni symptôme, ni jour de cycle, à aucun niveau', async () => {
    for (const niveau of ['aucun', 'discret', 'phases']) {
      const { app } = await monterCycle(niveau);
      const vu = await lire(app, ROCHAMBEAU);

      expect(vu.statusCode).toBe(200);
      // La preuve la plus solide : rien de tout cela n'est dans le corps HTTP.
      expect(vu.body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(vu.body).not.toContain('nuit difficile');
      expect(vu.body).not.toContain('jourDuCycle');
      expect(vu.body).not.toContain('prochainesRegles');
      for (const symptome of SYMPTOMES) {
        expect(vu.body).not.toContain(symptome.code);
        expect(vu.body).not.toContain(symptome.libelle);
      }
    }
  });

  it('ne nomme aucune phase au niveau discret', async () => {
    const { app } = await monterCycle('discret');
    const vu = await lire(app, ROCHAMBEAU);

    expect(vu.json()).toMatchObject({
      role: 'partenaire',
      vue: { niveau: 'discret', partage: true, jourAttentionne: true },
    });
    for (const niveau of NIVEAUX_CYCLE) {
      expect(vu.body).not.toContain(niveau.libelle);
    }
  });

  it('ne rend rien du tout au niveau « aucun »', async () => {
    const { app } = await monterCycle('aucun');
    const vu = await lire(app, ROCHAMBEAU);

    expect(vu.json().vue).toEqual({
      niveau: 'aucun',
      partage: false,
      raison: 'sans_partage',
    });
  });

  it('distingue « non déclaré » de « déclaré sans partage »', async () => {
    // Les deux ne montrent rien, mais confondre les deux ferait proposer au
    // partenaire de se déclarer alors que la personne concernée l’est déjà.
    const vierge = await monterServeur();
    expect((await lire(vierge.app, ROCHAMBEAU)).json().vue.raison).toBe(
      'non_declare',
    );

    const { app } = await monterCycle('aucun');
    expect((await lire(app, ROCHAMBEAU)).json().vue.raison).toBe('sans_partage');
  });

  it('dit « sans données » quand le partage est ouvert mais le carnet vide', async () => {
    const { app } = await monterCycle('phases', { sansRegles: true });
    const vu = await lire(app, ROCHAMBEAU);

    expect(vu.json().vue).toEqual({
      niveau: 'aucun',
      partage: false,
      raison: 'sans_donnees',
    });
  });

  it('rend la phase et des gestes concrets au niveau « phases »', async () => {
    const { app } = await monterCycle('phases');
    const vu = await lire(app, ROCHAMBEAU);
    const { vue } = vu.json();

    expect(vue.niveau).toBe('phases');
    expect(vue.phase).toBe('menstruelle');
    expect(vue.attentions.length).toBeGreaterThan(0);
    expect(vue.rappel).toContain('demandez-lui');
  });
});

describe('la personne concernée voit son cycle entier', () => {
  it('reçoit ses règles, ses symptômes et son état', async () => {
    const { app, debut } = await monterCycle('phases');
    const vu = await lire(app, GAELLE);
    const charge = vu.json();

    expect(charge.role).toBe('porteuse');
    expect(charge.regles[0].debutLe).toBe(debut);
    expect(charge.symptomes[0].type).toBe('crampes');
    expect(charge.etat.jourDuCycle).toBe(5);
    expect(charge.etat.phase).toBe('menstruelle');
  });
});

describe('une seule personne écrit', () => {
  const ecritures: [string, string, Record<string, unknown>][] = [
    ['PUT', 'niveau', { niveau: 'phases' }],
    ['POST', 'regles', { debutLe: '2026-01-01' }],
    ['POST', 'symptomes', { date: '2026-01-01', type: 'fatigue', intensite: 2 }],
  ];

  it('refuse toute écriture du partenaire', async () => {
    const { app } = await monterCycle('phases');

    for (const [methode, chemin, payload] of ecritures) {
      const reponse = await app.inject({
        method: methode as 'PUT' | 'POST',
        url: `/couples/${COUPLE_ID}/cycle/${chemin}`,
        headers: entete(ROCHAMBEAU),
        payload,
      });
      expect(reponse.statusCode).toBe(403);
      expect(reponse.json().motif).toBe('pas_la_porteuse');
    }
  });

  it('empêche le partenaire de se désigner porteur à la place de l’autre', async () => {
    const { app } = await monterCycle();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/porteuse`,
      headers: entete(ROCHAMBEAU),
      payload: { porteuseId: ROCHAMBEAU },
    });

    expect(reponse.statusCode).toBe(403);
    expect(reponse.json().motif).toBe('pas_la_porteuse');
  });

  it('laisse la personne concernée changer de niveau à tout moment', async () => {
    const { app } = await monterCycle('phases');

    const redescente = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/niveau`,
      headers: entete(GAELLE),
      payload: { niveau: 'aucun' },
    });
    expect(redescente.statusCode).toBe(200);
    expect((await lire(app, ROCHAMBEAU)).json().vue.partage).toBe(false);
  });

  it('n’annonce rien au partenaire quand le niveau baisse', async () => {
    // Annoncer « elle en partage moins » transformerait un droit en dette.
    const { app, depot } = await monterCycle('phases');
    await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/niveau`,
      headers: entete(GAELLE),
      payload: { niveau: 'aucun' },
    });

    expect(await depot.notifications.journal(ROCHAMBEAU)).toHaveLength(0);
  });
});

describe('niveaux et validation', () => {
  it('refuse le niveau 3, non ouvert en P0', async () => {
    const { app } = await monterCycle();
    const reponse = await app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/niveau`,
      headers: entete(GAELLE),
      payload: { niveau: 'complet' },
    });
    expect(reponse.statusCode).toBe(409);
    expect(reponse.json().motif).toBe('niveau_indisponible');
  });

  it('refuse une date mal formée ou une fin antérieure au début', async () => {
    const { app } = await monterCycle();

    for (const payload of [
      { debutLe: '01/02/2026' },
      { debutLe: '2026-02-10', finLe: '2026-02-01' },
    ]) {
      const reponse = await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/cycle/regles`,
        headers: entete(GAELLE),
        payload,
      });
      expect(reponse.statusCode).toBe(400);
    }
  });

  it('refuse d’écrire tant que personne n’est déclaré', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/cycle/regles`,
      headers: entete(GAELLE),
      payload: { debutLe: '2026-02-10' },
    });
    expect(reponse.statusCode).toBe(409);
    expect(reponse.json().motif).toBe('cycle_non_declare');
  });

  it('rend la même absence aux deux quand rien n’est déclaré', async () => {
    const { app } = await monterServeur();
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect((await lire(app, qui)).json().vue).toEqual({
        niveau: 'aucun',
        partage: false,
        raison: 'non_declare',
      });
    }
  });
});

describe('durée de cycle annoncée', () => {
  const definirDuree = (app: App, qui: string, duree: number | null) =>
    app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/cycle/duree`,
      headers: entete(qui),
      payload: { duree },
    });

  it('sert à la personne concernée et se relit', async () => {
    const { app } = await monterCycle('phases');
    expect((await definirDuree(app, GAELLE, 30)).statusCode).toBe(200);

    // La porteuse reçoit l'objet à plat ; seul le partenaire a un champ `vue`.
    const vu = await lire(app, GAELLE);
    expect(vu.json().dureeDeclaree).toBe(30);
  });

  it('refuse le partenaire, comme pour le niveau', async () => {
    // Elle décrit le corps de la personne concernée : l'autre n'a rien à y
    // écrire, même en étant membre du couple.
    const { app } = await monterCycle('phases');
    expect((await definirDuree(app, ROCHAMBEAU, 30)).statusCode).toBe(403);
  });

  it('refuse une durée aberrante', async () => {
    const { app } = await monterCycle('phases');
    for (const duree of [3, 400, 28.5]) {
      const reponse = await definirDuree(app, GAELLE, duree);
      expect(reponse.statusCode).toBe(400);
      expect(reponse.json().motif).toBe('donnees_invalides');
    }
  });

  it('rend la main au calcul observé sur null', async () => {
    const { app } = await monterCycle('phases');
    await definirDuree(app, GAELLE, 30);
    expect((await definirDuree(app, GAELLE, null)).statusCode).toBe(200);
    expect((await lire(app, GAELLE)).json().dureeDeclaree).toBeUndefined();
  });

  it('ne fuite pas la durée vers le partenaire', async () => {
    // Elle ne figure dans aucun niveau : `vuePartenaire` décide seule de la
    // forme, et la durée n'en fait pas partie.
    const { app } = await monterCycle('phases');
    await definirDuree(app, GAELLE, 30);

    const vu = await lire(app, ROCHAMBEAU);
    expect(vu.body).not.toContain('dureeDeclaree');
    // La projection ne porte que ce que le niveau autorise, rien de plus.
    expect(Object.keys(vu.json().vue).sort()).toEqual([
      'attentions',
      'lecture',
      'libellePhase',
      'niveau',
      'partage',
      'phase',
      'rappel',
    ]);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterCycle('phases');
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
  });

  it('refuse sans jeton', async () => {
    const { app } = await monterCycle('phases');
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/cycle`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ferme tout après dissociation, et efface les données', async () => {
    const { app, depot } = await monterCycle('phases');
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    expect((await lire(app, GAELLE)).statusCode).toBe(410);
    expect((await lire(app, ROCHAMBEAU)).statusCode).toBe(410);
    expect(await depot.cycle.regles(COUPLE_ID)).toHaveLength(0);
    expect(await depot.cycle.symptomes(COUPLE_ID)).toHaveLength(0);
    expect(await depot.cycle.partage(COUPLE_ID)).toBeUndefined();
  });
});
