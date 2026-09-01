/**
 * Finances : factures récurrentes et enveloppes de projet (§8.11).
 *
 * Deux propriétés dominent ces cas : le module reste **entièrement
 * optionnel** — éteint, il ne rend rien et ne rappelle rien —, et le serveur
 * ne doit jamais détenir de montant ni de libellé en clair.
 */
import { describe, expect, it } from 'vitest';
import { executerLesRappels } from '../rappels/planificateur.ts';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

const activer = (s: Serveur) =>
  s.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/finances/reglages`,
    headers: entete(GAELLE),
    payload: { actif: true },
  });

const ajouterFacture = (
  s: Serveur,
  qui: string,
  corps: Record<string, unknown>,
) =>
  s.app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/finances/factures`,
    headers: entete(qui),
    payload: corps,
  });

const lire = (s: Serveur, qui: string) =>
  s.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/finances`,
    headers: entete(qui),
  });

const FACTURE = {
  premiereEcheance: '2026-09-05',
  periodicite: 'mensuelle',
  contenuScelle: 'm1.nonce.scelle',
};

describe('factures', () => {
  it('refuse un tiers', async () => {
    const s = await monterServeur();
    await activer(s);
    expect((await ajouterFacture(s, INTRUS, FACTURE)).statusCode).toBe(403);
  });

  it('refuse tant que le module est éteint', async () => {
    const s = await monterServeur();
    const r = await ajouterFacture(s, GAELLE, FACTURE);
    expect(r.statusCode).toBe(409);
    expect(r.json().motif).toBe('module_inactif');
  });

  it('refuse un contenu en clair', async () => {
    const s = await monterServeur();
    await activer(s);
    const r = await ajouterFacture(s, GAELLE, {
      ...FACTURE,
      contenuScelle: 'Loyer 250000',
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('contenu_non_scelle');
  });

  it('refuse une périodicité inventée et une date illisible', async () => {
    const s = await monterServeur();
    await activer(s);
    expect(
      (await ajouterFacture(s, GAELLE, { ...FACTURE, periodicite: 'hebdo' }))
        .statusCode,
    ).toBe(400);
    expect(
      (await ajouterFacture(s, GAELLE, {
        ...FACTURE,
        premiereEcheance: 'le 5',
      })).statusCode,
    ).toBe(400);
  });

  it('l’enregistre et la rend aux deux', async () => {
    const s = await monterServeur();
    await activer(s);
    expect((await ajouterFacture(s, GAELLE, FACTURE)).statusCode).toBe(201);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const vue = (await lire(s, qui)).json();
      expect(vue.factures).toHaveLength(1);
      expect(vue.factures[0].periodicite).toBe('mensuelle');
    }
  });

  it('s’arrête sans s’effacer', async () => {
    const s = await monterServeur();
    await activer(s);
    const id = (await ajouterFacture(s, GAELLE, FACTURE)).json().facture.id;

    const arret = await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/finances/factures/${id}/arreter`,
      headers: entete(ROCHAMBEAU),
    });
    expect(arret.statusCode).toBe(200);
    expect(arret.json().facture.arreteeLe).toBeTruthy();

    // Toujours là : des dépenses passées y renvoient.
    expect((await lire(s, GAELLE)).json().factures).toHaveLength(1);
  });

  it('disparaît de la vue quand le module s’éteint', async () => {
    const s = await monterServeur();
    await activer(s);
    await ajouterFacture(s, GAELLE, FACTURE);

    await s.app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/finances/reglages`,
      headers: entete(GAELLE),
      payload: { actif: false },
    });

    const vue = (await lire(s, GAELLE)).json();
    expect(vue.factures).toEqual([]);
    expect(vue.budgets).toEqual([]);
  });
});

describe('les rappels de facture', () => {
  it('préviennent les deux, sans nommer la facture', async () => {
    const s = await monterServeur();
    await activer(s);
    await ajouterFacture(s, GAELLE, FACTURE);

    // Trois jours avant l'échéance.
    const rapport = await executerLesRappels(
      s.depot,
      s.expediteur,
      new Date('2026-09-02T09:00:00.000Z'),
    );
    expect(rapport.rappelsEmis).toBe(1);

    // Le journal dit ce qui a été publié, que le push soit parti tout de suite
    // ou qu'il attende la fenêtre de silence.
    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const journal = await s.depot.notifications.journal(qui);
      const rappels = journal.filter((n) => n.categorie === 'rappel');
      expect(rappels).toHaveLength(1);
      expect(rappels[0]!.texte).toContain('facture commune');
      // Le serveur n'a jamais lu l'enveloppe : rien ne peut en sortir.
      expect(rappels[0]!.texte).not.toContain('m1.');
    }
  });

  it('ne se répètent pas', async () => {
    const s = await monterServeur();
    await activer(s);
    await ajouterFacture(s, GAELLE, FACTURE);

    await executerLesRappels(
      s.depot,
      s.expediteur,
      new Date('2026-09-02T09:00:00.000Z'),
    );
    const second = await executerLesRappels(
      s.depot,
      s.expediteur,
      new Date('2026-09-03T09:00:00.000Z'),
    );
    expect(second.rappelsEmis).toBe(0);
  });

  it('se taisent quand le module est éteint', async () => {
    const s = await monterServeur();
    await activer(s);
    await ajouterFacture(s, GAELLE, FACTURE);
    await s.app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/finances/reglages`,
      headers: entete(GAELLE),
      payload: { actif: false },
    });

    const rapport = await executerLesRappels(
      s.depot,
      s.expediteur,
      new Date('2026-09-02T09:00:00.000Z'),
    );
    expect(rapport.rappelsEmis).toBe(0);
  });

  it('se taisent pour une facture arrêtée', async () => {
    const s = await monterServeur();
    await activer(s);
    const id = (await ajouterFacture(s, GAELLE, FACTURE)).json().facture.id;
    await s.app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/finances/factures/${id}/arreter`,
      headers: entete(GAELLE),
    });

    const rapport = await executerLesRappels(
      s.depot,
      s.expediteur,
      new Date('2026-09-02T09:00:00.000Z'),
    );
    expect(rapport.rappelsEmis).toBe(0);
  });
});

describe('enveloppes de projet', () => {
  const definir = (s: Serveur, qui: string, montantScelle: string) =>
    s.app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/finances/budgets/projet-1`,
      headers: entete(qui),
      payload: { montantScelle },
    });

  it('refuse un montant en clair', async () => {
    const s = await monterServeur();
    await activer(s);
    const r = await definir(s, GAELLE, '250000');
    expect(r.statusCode).toBe(400);
    expect(r.json().motif).toBe('contenu_non_scelle');
  });

  it('se pose et se remplace', async () => {
    const s = await monterServeur();
    await activer(s);
    await definir(s, GAELLE, 'm1.a.a');
    await definir(s, ROCHAMBEAU, 'm1.b.b');

    const budgets = (await lire(s, GAELLE)).json().budgets;
    expect(budgets).toHaveLength(1);
    expect(budgets[0].montantScelle).toBe('m1.b.b');
    expect(budgets[0].projetId).toBe('projet-1');
  });

  it('se retire', async () => {
    const s = await monterServeur();
    await activer(s);
    await definir(s, GAELLE, 'm1.a.a');

    const suppression = await s.app.inject({
      method: 'DELETE',
      url: `/couples/${COUPLE_ID}/finances/budgets/projet-1`,
      headers: entete(GAELLE),
    });
    expect(suppression.statusCode).toBe(204);
    expect((await lire(s, GAELLE)).json().budgets).toEqual([]);
  });
});

describe('dissociation', () => {
  it('emporte factures et enveloppes', async () => {
    const s = await monterServeur();
    await activer(s);
    await ajouterFacture(s, GAELLE, FACTURE);
    await s.app.inject({
      method: 'PUT',
      url: `/couples/${COUPLE_ID}/finances/budgets/projet-1`,
      headers: entete(GAELLE),
      payload: { montantScelle: 'm1.a.a' },
    });

    await s.services.dissociation.dissocier(COUPLE_ID, GAELLE);

    expect(await s.depot.finances.factures(COUPLE_ID)).toEqual([]);
    expect(await s.depot.finances.budgets(COUPLE_ID)).toEqual([]);
  });
});
