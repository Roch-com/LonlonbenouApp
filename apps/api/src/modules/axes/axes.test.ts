/** Exigence 1 — le serveur rejoue `axeVisiblePar`. */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  INTRUS,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

const TEXTE_DE_GAELLE = 'Ce que Gaëlle a écrit et qui ne doit pas fuiter';
const TEXTE_DE_ROCHAMBEAU = 'Ce que Rochambeau a écrit de son côté';

async function ouvrirAxe(app: Awaited<ReturnType<typeof monterServeur>>['app']) {
  const reponse = await app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/axes`,
    headers: entete(ROCHAMBEAU),
    payload: { theme: 'communication', titre: 'Se dire les choses plus tôt' },
  });
  return reponse.json().axe.id as string;
}

describe('lecture des axes', () => {
  it('ne laisse pas la contribution de l’autre quitter le serveur tant que le miroir est incomplet', async () => {
    const { app } = await monterServeur();
    const axeId = await ouvrirAxe(app);

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/axes/${axeId}/contribution`,
      headers: entete(GAELLE),
      payload: { ressenti: TEXTE_DE_GAELLE, besoin: 'Un peu de temps' },
    });

    const vuParRochambeau = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
    });

    // La preuve la plus solide : le texte n'apparaît nulle part dans la réponse.
    expect(vuParRochambeau.body).not.toContain(TEXTE_DE_GAELLE);
    expect(vuParRochambeau.json().axes[0].contributions).toHaveLength(0);
    // En revanche, le fait qu'elle ait écrit reste visible : c'est symétrique.
    expect(vuParRochambeau.json().axes[0].lautreAContribue).toBe(true);
    expect(vuParRochambeau.json().axes[0].etat).toBe('en_attente_de_moi');
  });

  it('découvre les deux contributions au même moment', async () => {
    const { app } = await monterServeur();
    const axeId = await ouvrirAxe(app);

    for (const [qui, texte] of [
      [GAELLE, TEXTE_DE_GAELLE],
      [ROCHAMBEAU, TEXTE_DE_ROCHAMBEAU],
    ] as const) {
      await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/axes/${axeId}/contribution`,
        headers: entete(qui),
        payload: { ressenti: texte, besoin: 'Un besoin' },
      });
    }

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const reponse = await app.inject({
        method: 'GET',
        url: `/couples/${COUPLE_ID}/axes`,
        headers: entete(qui),
      });
      expect(reponse.json().axes[0].contributions).toHaveLength(2);
      expect(reponse.body).toContain(TEXTE_DE_GAELLE);
      expect(reponse.body).toContain(TEXTE_DE_ROCHAMBEAU);
    }
  });

  it('rend exactement la même chose aux deux une fois le miroir complet', async () => {
    const { app } = await monterServeur();
    const axeId = await ouvrirAxe(app);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/axes/${axeId}/contribution`,
        headers: entete(qui),
        payload: { ressenti: `ressenti de ${qui}`, besoin: `besoin de ${qui}` },
      });
    }

    const cote = async (qui: string) => {
      const { axes } = (
        await app.inject({
          method: 'GET',
          url: `/couples/${COUPLE_ID}/axes`,
          headers: entete(qui),
        })
      ).json();
      return axes[0].contributions as {
        partenaireId: string;
        ressenti: string;
        besoin: string;
        estLaMienne: boolean;
      }[];
    };

    const vuParLui = await cote(ROCHAMBEAU);
    const vuParElle = await cote(GAELLE);

    // Le contenu est rigoureusement le même des deux côtés…
    const contenu = (liste: Awaited<ReturnType<typeof cote>>) =>
      liste.map(({ estLaMienne: _, ...reste }) => reste);
    expect(contenu(vuParLui)).toEqual(contenu(vuParElle));

    // …seul le marquage « c'est la mienne » est personnel, et il désigne bien
    // une contribution différente pour chacun.
    expect(vuParLui.find((c) => c.estLaMienne)?.partenaireId).toBe(ROCHAMBEAU);
    expect(vuParElle.find((c) => c.estLaMienne)?.partenaireId).toBe(GAELLE);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un lecteur sans jeton', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('refuse un porteur de jeton valide qui n’est pas de ce couple', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(INTRUS),
    });
    expect(reponse.statusCode).toBe(403);
    expect(reponse.json().motif).toBe('non_membre');
  });

  it('refuse quand le consentement mutuel n’est pas actif', async () => {
    const { app } = await monterServeur({ croissanceActive: false });
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
    });

    expect(reponse.statusCode).toBe(403);
    expect(reponse.json().motif).toBe('partage_inactif');
  });

  it('refuse d’écrire quand le consentement n’est pas actif', async () => {
    const { app } = await monterServeur({ croissanceActive: false });
    const reponse = await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(ROCHAMBEAU),
      payload: { theme: 'communication', titre: 'Un axe' },
    });
    expect(reponse.statusCode).toBe(403);
  });
});
