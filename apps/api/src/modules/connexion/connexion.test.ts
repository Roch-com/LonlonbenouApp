/**
 * Complicité & connexion, côté serveur (§8.14).
 *
 * Comme pour les parcours, l’essentiel porte sur ce qui **franchit la
 * frontière réseau** : le miroir ne vaut que si le résultat de l’autre n’est
 * pas dans la charge utile.
 *
 * Le rappel de distance a ses propres cas : c’est la fonctionnalité la plus
 * facile à rendre culpabilisante du cahier, et les garde-fous se vérifient.
 */
import { describe, expect, it } from 'vitest';
import { LANGAGES, QUESTIONS_LANGAGES } from '@lonlonbenu/shared';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

/** Répond de façon à faire ressortir un langage donné. */
const pousser = (langage: string) =>
  Object.fromEntries(
    QUESTIONS_LANGAGES.map((q) => [q.id, q.a.langage === langage ? 'a' : 'b']),
  );

const lire = (s: Serveur, qui: string, jour = '2026-09-01') =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/connexion?jour=${jour}`,
    headers: entete(qui),
  });

const repondre = (s: Serveur, qui: string, choix: unknown) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/connexion/langages`,
    headers: entete(qui),
    payload: { choix, jour: '2026-09-01' },
  });

/** Fait vivre une initiative et échanger un message, à une date donnée. */
async function activite(s: Serveur, quand: string): Promise<void> {
  await s.depot.viePratique.enregistrerInitiative(COUPLE_ID, {
    id: 'i1',
    titre: 'Une marche',
    categorie: 'nature',
    etat: 'vecue',
    proposeePar: GAELLE,
    proposeeLe: quand,
    vecueLe: quand,
  });
  await s.depot.chat.ajouter(COUPLE_ID, {
    id: 'm1',
    auteurId: GAELLE,
    enveloppe: 'm1.a.a',
    envoyeLe: quand,
  });
}

describe('accès', () => {
  it('refuse un tiers', async () => {
    const s = await monterServeur();
    expect((await lire(s, INTRUS)).statusCode).toBe(403);
    expect((await repondre(s, INTRUS, pousser('paroles'))).statusCode).toBe(403);
  });

  it('refuse des choix qui ne sont pas des a/b', async () => {
    const s = await monterServeur();
    const r = await repondre(s, GAELLE, { l01: 'oui' });
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('choix_invalides');
  });

  it('ignore les clés qui ne sont pas du questionnaire', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, { ...pousser('paroles'), inconnue: 'a' });
    await repondre(s, ROCHAMBEAU, pousser('contact'));

    // Le questionnaire reste complet et exact malgré la clé parasite.
    const vue = (await lire(s, GAELLE)).json();
    expect(vue.langages.etat).toBe('les_deux');
    expect(vue.langages.mien.repondues).toBe(QUESTIONS_LANGAGES.length);
  });
});

describe('le miroir, à la frontière réseau', () => {
  it('ne laisse pas sortir le résultat de l’autre avant le mien', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, pousser('contact'));

    const vue = await lire(s, ROCHAMBEAU);
    expect(vue.json().langages.etat).toBe('lui_seul');
    expect(vue.json().langages.sien).toBeUndefined();
    // Le test qui compte : aucun score de Gaëlle dans la charge utile.
    expect(vue.json().langages.mien).toBeUndefined();
  });

  it('n’ouvre rien sur un questionnaire inachevé', async () => {
    const s = await monterServeur();
    const partiel = { ...pousser('contact') };
    delete partiel[QUESTIONS_LANGAGES[0]!.id];

    await repondre(s, GAELLE, pousser('paroles'));
    await repondre(s, ROCHAMBEAU, partiel);

    expect((await lire(s, GAELLE)).json().langages.etat).toBe('moi_seul');
  });

  it('ouvre les deux une fois les deux finis', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, pousser('paroles'));
    const apres = await repondre(s, ROCHAMBEAU, pousser('contact'));

    expect(apres.json().langages.etat).toBe('les_deux');
    expect(apres.json().langages.mien.dominant).toBe('contact');
    expect(apres.json().langages.sien.dominant).toBe('paroles');
    expect(apres.json().langages.pistes[0]).toBe(
      LANGAGES.find((l) => l.code === 'paroles')!.pistePourLautre,
    );
  });

  it('est symétrique : chacun voit la même chose de son côté', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, pousser('paroles'));
    await repondre(s, ROCHAMBEAU, pousser('contact'));

    const aGaelle = (await lire(s, GAELLE)).json().langages;
    const aRochambeau = (await lire(s, ROCHAMBEAU)).json().langages;

    expect(aGaelle.etat).toBe(aRochambeau.etat);
    expect(aGaelle.mien.dominant).toBe(aRochambeau.sien.dominant);
    expect(aGaelle.sien.dominant).toBe(aRochambeau.mien.dominant);
  });

  it('accepte un questionnaire rempli en plusieurs fois', async () => {
    const s = await monterServeur();
    const complet = pousser('contact');
    const moitie = Object.fromEntries(
      Object.entries(complet).slice(0, 7),
    );

    expect((await repondre(s, GAELLE, moitie)).statusCode).toBe(200);
    await repondre(s, GAELLE, complet);
    await repondre(s, ROCHAMBEAU, pousser('paroles'));

    expect((await lire(s, GAELLE)).json().langages.etat).toBe('les_deux');
  });

  it('ne répond que pour soi, quoi qu’on envoie', async () => {
    const s = await monterServeur();
    await s.app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/connexion/langages`,
      headers: entete(GAELLE),
      payload: { choix: pousser('contact'), partenaireId: ROCHAMBEAU },
    });

    expect((await lire(s, ROCHAMBEAU)).json().langages.etat).toBe('lui_seul');
  });
});

describe('rituels', () => {
  it('propose le même rituel du jour aux deux', async () => {
    const s = await monterServeur();
    const a = (await lire(s, GAELLE)).json().rituelDuJour;
    const b = (await lire(s, ROCHAMBEAU)).json().rituelDuJour;
    expect(a.id).toBe(b.id);
  });

  it('trie selon ce qui touche l’autre une fois les deux résultats connus', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, pousser('contact'));
    await repondre(s, ROCHAMBEAU, pousser('paroles'));

    // Gaëlle voit remonter les rituels qui parlent à Rochambeau.
    expect((await lire(s, GAELLE)).json().rituels[0].langage).toBe('paroles');
    expect((await lire(s, ROCHAMBEAU)).json().rituels[0].langage).toBe('contact');
  });
});

describe('le rappel doux', () => {
  it('se tait quand le couple est actif', async () => {
    const s = await monterServeur();
    await activite(s, '2026-08-30T10:00:00.000Z');

    expect((await lire(s, GAELLE)).json().invitation).toBeUndefined();
  });

  it('se tait quand rien n’a jamais été utilisé', async () => {
    // Sans repère, on ne compte rien : un module jamais ouvert n'est pas un
    // signe de distance.
    const s = await monterServeur();
    expect((await lire(s, GAELLE)).json().invitation).toBeUndefined();
  });

  it('se tait sur un seul signal', async () => {
    const s = await monterServeur();
    // Initiative ancienne, mais conversation vivante.
    await s.depot.viePratique.enregistrerInitiative(COUPLE_ID, {
      id: 'i1',
      titre: 'Une marche',
      categorie: 'nature',
      etat: 'vecue',
      proposeePar: GAELLE,
      proposeeLe: '2026-06-01T10:00:00.000Z',
      vecueLe: '2026-06-01T10:00:00.000Z',
    });
    await s.depot.chat.ajouter(COUPLE_ID, {
      id: 'm1',
      auteurId: GAELLE,
      enveloppe: 'm1.a.a',
      envoyeLe: '2026-08-31T10:00:00.000Z',
    });

    expect((await lire(s, GAELLE)).json().invitation).toBeUndefined();
  });

  it('propose quand deux signaux se croisent', async () => {
    const s = await monterServeur();
    await activite(s, '2026-06-01T10:00:00.000Z');

    const invitation = (await lire(s, GAELLE)).json().invitation;
    expect(invitation).toBeDefined();
    expect(invitation.rituel.titre).toBeTruthy();
  });

  it('ne nomme personne et ne compte rien', async () => {
    const s = await monterServeur();
    await activite(s, '2026-06-01T10:00:00.000Z');

    const { lecture } = (await lire(s, GAELLE)).json().invitation;
    expect(lecture).not.toMatch(/\d/);
    expect(lecture).not.toMatch(/Ga[eë]lle|Rochambeau|partenaire/i);
  });

  it('dit exactement la même chose aux deux', async () => {
    const s = await monterServeur();
    await activite(s, '2026-06-01T10:00:00.000Z');

    const a = (await lire(s, GAELLE)).json().invitation;
    const b = (await lire(s, ROCHAMBEAU)).json().invitation;
    expect(a).toEqual(b);
  });

  it('ne compte pas un message programmé comme un échange', async () => {
    const s = await monterServeur();
    await activite(s, '2026-06-01T10:00:00.000Z');
    // Une capsule déposée pour plus tard : la conversation reste silencieuse.
    await s.depot.chat.ajouter(COUPLE_ID, {
      id: 'm2',
      auteurId: GAELLE,
      enveloppe: 'm1.b.b',
      envoyeLe: '2026-08-31T10:00:00.000Z',
      remettreLe: '2026-12-25T10:00:00.000Z',
    });

    expect((await lire(s, GAELLE)).json().invitation).toBeDefined();
  });
});

describe('dissociation', () => {
  it('emporte les réponses avec le reste', async () => {
    const s = await monterServeur();
    await repondre(s, GAELLE, pousser('contact'));

    await s.services.dissociation.dissocier(COUPLE_ID, GAELLE);

    expect(await s.depot.connexion.langages(COUPLE_ID)).toEqual([]);
  });
});
