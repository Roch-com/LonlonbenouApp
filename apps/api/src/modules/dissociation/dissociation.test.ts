/** Exigence 2 — dissociation bilatérale et notification symétrique. */
import { describe, expect, it } from 'vitest';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

async function dissocier(
  app: Awaited<ReturnType<typeof monterServeur>>['app'],
  parQui: string = ROCHAMBEAU,
) {
  return app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/dissociation`,
    headers: entete(parQui),
  });
}

describe('la coupure vaut pour les deux', () => {
  it('ferme l’accès à celui qui demande comme à l’autre', async () => {
    const { app } = await monterServeur();
    expect((await dissocier(app)).statusCode).toBe(200);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const reponse = await app.inject({
        method: 'GET',
        url: `/couples/${COUPLE_ID}/axes`,
        headers: entete(qui),
      });
      expect(reponse.statusCode).toBe(410);
      expect(reponse.json().motif).toBe('couple_dissocie');
    }
  });

  it('détruit les données partagées au lieu de les laisser orphelines', async () => {
    const { app, depot } = await monterServeur();

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/axes`,
      headers: entete(GAELLE),
      payload: { theme: 'communication', titre: 'Un sujet' },
    });
    expect(await depot.axes.parCouple(COUPLE_ID)).toHaveLength(1);

    await dissocier(app);
    expect(await depot.axes.parCouple(COUPLE_ID)).toHaveLength(0);
  });

  it('remet tous les consentements à zéro', async () => {
    const { app, depot } = await monterServeur();
    await dissocier(app);

    const enregistrement = await depot.couples.parId(COUPLE_ID);
    for (const partage of Object.values(enregistrement!.partages)) {
      expect(partage.consentements.every((c) => !c.actif)).toBe(true);
    }
  });

  it('délie les appareils des deux partenaires', async () => {
    const { app, depot } = await monterServeur();
    await dissocier(app);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect(await depot.appareils.parPartenaire(qui)).toHaveLength(0);
    }
  });

  it('refuse une seconde dissociation sans planter', async () => {
    const { app } = await monterServeur();
    await dissocier(app);
    expect((await dissocier(app)).statusCode).toBe(409);
  });

  it('refuse un demandeur étranger au couple', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete('intrus'),
    });
    expect(reponse.statusCode).toBe(403);
  });
});

describe('annonce symétrique', () => {
  it('prévient exactement les deux partenaires', async () => {
    const { app } = await monterServeur();
    const reponse = await dissocier(app, ROCHAMBEAU);

    expect([...reponse.json().notifies].sort()).toEqual(
      [GAELLE, ROCHAMBEAU].sort(),
    );
  });

  it('pousse l’annonce aux deux quand rien ne l’en empêche', async () => {
    const { app, transport } = await monterServeur();
    await dissocier(app);

    const destinataires = transport.messages.map((m) => m.appareil.partenaireId);
    expect([...destinataires].sort()).toEqual([GAELLE, ROCHAMBEAU].sort());
  });

  it('résiste à un réglage « jamais » — mais respecte le silence nocturne', async () => {
    const { app, depot, transport } = await monterServeur();

    // Les deux tentent de rendre l'annonce inaudible : réglage « jamais » et
    // silence permanent.
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const preferences = await depot.notifications.preferences(qui);
      await depot.notifications.definirPreferences(qui, {
        ...preferences,
        silence: { actif: true, debut: '00:00', fin: '23:59' },
        parCategorie: { ...preferences.parCategorie, partage: 'jamais' },
      });
    }

    await dissocier(app);

    // Le réglage « jamais » ne mord pas : la catégorie est impérative. Le
    // silence, lui, s'applique — seul le SOS le traverse. L'annonce est donc
    // différée, jamais supprimée.
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const [annonce] = await depot.notifications.journal(qui);
      expect(annonce?.remise).toBe('differee');
      expect(annonce?.remise).not.toBe('ignoree');
    }
    expect(transport.messages).toHaveLength(0);
  });

  it('remet l’annonce différée aux deux dès le silence levé', async () => {
    const { depot, transport, expediteur, services } = await monterServeur();

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const preferences = await depot.notifications.preferences(qui);
      await depot.notifications.definirPreferences(qui, {
        ...preferences,
        silence: { actif: true, debut: '22:00', fin: '07:00' },
      });
    }

    // Appel direct du service : la route ne prend pas d'horloge, et ce cas
    // n'a de sens qu'à une heure précise.
    const enPleineNuit = new Date('2026-03-15T03:00:00');
    await services.dissociation.dissocier(COUPLE_ID, ROCHAMBEAU, enPleineNuit);
    expect(transport.messages).toHaveLength(0);

    const leMatin = new Date('2026-03-15T09:00:00');
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect(await expediteur.viderLaFile(qui, leMatin)).toBe(1);
    }

    const destinataires = transport.messages.map((m) => m.appareil.partenaireId);
    expect([...destinataires].sort()).toEqual([GAELLE, ROCHAMBEAU].sort());

    // Et les appareils ne sont déliés qu'une fois l'annonce réellement partie.
    for (const qui of [ROCHAMBEAU, GAELLE]) {
      expect(await depot.appareils.parPartenaire(qui)).toHaveLength(0);
    }
  });

  it('journalise l’annonce des deux côtés', async () => {
    const { app, depot } = await monterServeur();
    await dissocier(app, GAELLE);

    for (const qui of [ROCHAMBEAU, GAELLE]) {
      const journal = await depot.notifications.journal(qui);
      expect(journal).toHaveLength(1);
      expect(journal[0]?.categorie).toBe('partage');
      expect(journal[0]?.texte).toContain('coupés des deux côtés');
    }
  });

  it('dit la même chose aux deux, en adaptant seulement qui a agi', async () => {
    const { app, depot } = await monterServeur();
    await dissocier(app, ROCHAMBEAU);

    const [pourLui] = await depot.notifications.journal(ROCHAMBEAU);
    const [pourElle] = await depot.notifications.journal(GAELLE);

    expect(pourLui?.texte).toContain('Vous avez séparé');
    expect(pourElle?.texte).toContain('ont été séparés');
    // Ni l'un ni l'autre n'est accusé, et le fait annoncé est le même.
    for (const texte of [pourLui?.texte ?? '', pourElle?.texte ?? '']) {
      expect(texte).toContain('des deux côtés');
      expect(texte.toLowerCase()).not.toContain('a décidé');
    }
  });
});
