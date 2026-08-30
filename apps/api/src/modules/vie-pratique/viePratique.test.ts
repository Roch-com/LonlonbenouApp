/** Pôle ③ — vie pratique, et rappels émis par le serveur. */
import { describe, expect, it } from 'vitest';
import { PREFERENCES_PAR_DEFAUT } from '@lonlonbenu/shared';
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
type App = Serveur['app'];

const dansNJours = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const lire = (app: App, qui: string) =>
  app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/vie-pratique`,
    headers: entete(qui),
  });

const ajouterEvenement = (app: App, qui: string, corps: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/vie-pratique/evenements`,
    headers: entete(qui),
    payload: corps,
  });

const creerProjet = (app: App, qui: string, titre: string) =>
  app.inject({
    method: 'POST',
    url: `/couples/${COUPLE_ID}/vie-pratique/projets`,
    headers: entete(qui),
    payload: { titre },
  });

describe('agenda partagé', () => {
  it('rend à l’autre ce que l’un a ajouté, sans consentement à donner', async () => {
    const { app } = await monterServeur();

    const cree = await ajouterEvenement(app, GAELLE, {
      titre: 'Dîner chez Marta',
      categorie: 'a_deux',
      debut: `${dansNJours(2)}T20:00:00.000Z`,
      journeeEntiere: false,
    });
    expect(cree.statusCode).toBe(201);
    // La visibilité est posée par le serveur, jamais reçue du client.
    expect(cree.json().evenement.visibilite).toBe('couple');

    const vuParLui = await lire(app, ROCHAMBEAU);
    expect(vuParLui.json().evenements).toHaveLength(1);
    expect(vuParLui.body).toContain('Dîner chez Marta');
  });

  it('laisse les deux retirer un événement', async () => {
    const { app } = await monterServeur();
    const id = (
      await ajouterEvenement(app, GAELLE, {
        titre: 'À retirer',
        categorie: 'autre',
        debut: dansNJours(3),
        journeeEntiere: true,
      })
    ).json().evenement.id;

    const retrait = await app.inject({
      method: 'DELETE',
      url: `/couples/${COUPLE_ID}/vie-pratique/evenements/${id}`,
      headers: entete(ROCHAMBEAU),
    });
    expect(retrait.statusCode).toBe(204);
    expect((await lire(app, GAELLE)).json().evenements).toHaveLength(0);
  });

  it('refuse un événement sans titre ni date', async () => {
    const { app } = await monterServeur();
    const reponse = await ajouterEvenement(app, GAELLE, { categorie: 'autre' });
    expect(reponse.statusCode).toBe(400);
  });

  it('refuse un horodatage que personne ne saura relire', async () => {
    // Le client complétait « 9 » en « 00009 » ; le serveur ne vérifiait que
    // la présence du champ. L'événement partait en base et fermait ensuite le
    // pôle à chaque lecture, sans moyen d'aller le supprimer.
    const { app } = await monterServeur();

    for (const debut of ['2026-08-30T00009:00', '2026-08-30T0020h:00', 'demain']) {
      const reponse = await ajouterEvenement(app, GAELLE, {
        titre: 'Dîner',
        categorie: 'a_deux',
        debut,
        journeeEntiere: false,
      });
      expect(reponse.statusCode).toBe(400);
      expect(reponse.json().motif).toBe('donnees_invalides');
    }
  });

  it('accepte toujours un horodatage correct', async () => {
    const { app } = await monterServeur();
    const horodate = await ajouterEvenement(app, GAELLE, {
      titre: 'Dîner',
      categorie: 'a_deux',
      debut: '2026-08-30T19:00:00',
      journeeEntiere: false,
    });
    expect(horodate.statusCode).toBe(201);

    const journee = await ajouterEvenement(app, GAELLE, {
      titre: 'Anniversaire',
      categorie: 'a_deux',
      debut: '2026-08-30',
      journeeEntiere: true,
    });
    expect(journee.statusCode).toBe(201);
  });
});

describe('projets et jalons', () => {
  it('coche et décoche, en notant qui a coché', async () => {
    const { app } = await monterServeur();
    const projetId = (await creerProjet(app, GAELLE, 'Partir quelque part')).json()
      .projet.id;

    const avecJalon = await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/vie-pratique/projets/${projetId}/jalons`,
      headers: entete(GAELLE),
      payload: { titre: 'Choisir la destination', echeance: dansNJours(10) },
    });
    const jalonId = avecJalon.json().projet.jalons[0].id;

    const chemin = `/couples/${COUPLE_ID}/vie-pratique/projets/${projetId}/jalons/${jalonId}`;
    const coche = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(ROCHAMBEAU),
    });
    expect(coche.json().projet.jalons[0].faitPar).toBe(ROCHAMBEAU);

    const decoche = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(GAELLE),
    });
    expect(decoche.json().projet.jalons[0].faitLe).toBeUndefined();
  });

  it('archive et sort des archives', async () => {
    const { app } = await monterServeur();
    const projetId = (await creerProjet(app, GAELLE, 'Un projet')).json().projet.id;
    const chemin = `/couples/${COUPLE_ID}/vie-pratique/projets/${projetId}/archive`;

    const archive = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(ROCHAMBEAU),
      payload: { archive: true },
    });
    expect(archive.json().projet.archiveLe).toBeTruthy();

    const sorti = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(GAELLE),
      payload: { archive: false },
    });
    expect(sorti.json().projet.archiveLe).toBeUndefined();
  });
});

describe('initiatives', () => {
  it('passe d’idée à prévue puis à vécue', async () => {
    const { app } = await monterServeur();
    const id = (
      await app.inject({
        method: 'POST',
        url: `/couples/${COUPLE_ID}/vie-pratique/initiatives`,
        headers: entete(GAELLE),
        payload: { titre: 'Un dîner sans téléphone', categorie: 'restaurant' },
      })
    ).json().initiative.id;

    const chemin = `/couples/${COUPLE_ID}/vie-pratique/initiatives/${id}`;
    const prevue = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(ROCHAMBEAU),
      payload: { action: 'programmer', prevuePour: dansNJours(1) },
    });
    expect(prevue.json().initiative.etat).toBe('prevue');

    const vecue = await app.inject({
      method: 'PUT',
      url: chemin,
      headers: entete(GAELLE),
      payload: { action: 'vivre', souvenir: 'On a ri tout le repas.' },
    });
    expect(vecue.json().initiative.etat).toBe('vecue');
    expect(vecue.json().initiative.souvenir).toBe('On a ri tout le repas.');
  });
});

describe('les rappels sont émis par le serveur', () => {
  /** Un événement dans la fenêtre de rappel, et un jalon pour aujourd'hui. */
  async function monterAvecRappels() {
    const serveur = await monterServeur();
    const { app } = serveur;

    await ajouterEvenement(app, GAELLE, {
      titre: 'Dîner chez Marta',
      categorie: 'a_deux',
      debut: new Date(Date.now() + 3 * 3_600_000).toISOString(),
      journeeEntiere: false,
      rappelHeures: 24,
    });

    const projetId = (await creerProjet(app, GAELLE, 'Partir quelque part')).json()
      .projet.id;
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/vie-pratique/projets/${projetId}/jalons`,
      headers: entete(GAELLE),
      payload: { titre: 'Réserver le train', echeance: dansNJours(0) },
    });

    return serveur;
  }

  it('prévient les deux partenaires sans qu’aucune app soit ouverte', async () => {
    const { depot, expediteur } = await monterAvecRappels();

    const rapport = await executerLesRappels(depot, expediteur);
    expect(rapport.rappelsEmis).toBe(2);

    for (const qui of [GAELLE, ROCHAMBEAU]) {
      const journal = await depot.notifications.journal(qui);
      expect(journal).toHaveLength(2);
      expect(journal.every((n) => n.categorie === 'rappel')).toBe(true);
    }
  });

  it('ne redit jamais deux fois la même chose', async () => {
    const { depot, expediteur } = await monterAvecRappels();

    await executerLesRappels(depot, expediteur);
    const second = await executerLesRappels(depot, expediteur);

    expect(second.rappelsEmis).toBe(0);
    expect(await depot.notifications.journal(GAELLE)).toHaveLength(2);
  });

  it('passe par `deciderRemise` : le silence nocturne diffère au lieu d’envoyer', async () => {
    const { depot, expediteur, transport } = await monterAvecRappels();

    // Silence total pour Gaëlle, rien pour Rochambeau : la différence de
    // traitement prouve que la décision vient bien des préférences.
    const preferences = await depot.notifications.preferences(GAELLE);
    await depot.notifications.definirPreferences(GAELLE, {
      ...preferences,
      silence: { actif: true, debut: '00:00', fin: '23:59' },
    });

    await executerLesRappels(depot, expediteur);

    const versElle = await depot.notifications.journal(GAELLE);
    const versLui = await depot.notifications.journal(ROCHAMBEAU);
    expect(versElle.every((n) => n.remise === 'differee')).toBe(true);
    expect(versLui.every((n) => n.remise !== 'differee')).toBe(true);

    // Rien n'a été poussé vers elle ; le planificateur ne s'accorde aucun
    // privilège sur le mode ne pas déranger.
    expect(
      transport.messages.every((m) => m.appareil.partenaireId !== GAELLE),
    ).toBe(true);
  });

  it('respecte un réglage « jamais » sur la catégorie rappel', async () => {
    const { depot, expediteur } = await monterAvecRappels();

    await depot.notifications.definirPreferences(ROCHAMBEAU, {
      ...PREFERENCES_PAR_DEFAUT,
      silence: { ...PREFERENCES_PAR_DEFAUT.silence, actif: false },
      parCategorie: { ...PREFERENCES_PAR_DEFAUT.parCategorie, rappel: 'jamais' },
    });

    await executerLesRappels(depot, expediteur);

    const journal = await depot.notifications.journal(ROCHAMBEAU);
    expect(journal.every((n) => n.remise === 'ignoree')).toBe(true);
  });

  it('ignore un couple dissocié', async () => {
    const { app, depot, expediteur } = await monterAvecRappels();
    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(GAELLE),
    });

    const rapport = await executerLesRappels(depot, expediteur);
    expect(rapport.couplesBalayes).toBe(0);
    expect(rapport.rappelsEmis).toBe(0);
  });
});

describe('déclencheur de tâche planifiée', () => {
  it('refuse sans le secret, accepte avec', async () => {
    const { app } = await monterServeur();

    expect(
      (await app.inject({ method: 'POST', url: '/taches/rappels' })).statusCode,
    ).toBe(401);

    const avec = await app.inject({
      method: 'POST',
      url: '/taches/rappels',
      headers: { authorization: 'Bearer secret-de-taches' },
    });
    expect(avec.statusCode).toBe(200);
    expect(avec.json()).toHaveProperty('couplesBalayes');
  });

  it('n’existe pas quand aucun secret n’est configuré', async () => {
    const { app } = await monterServeur({ sansSecretTaches: true });
    const reponse = await app.inject({ method: 'POST', url: '/taches/rappels' });
    expect(reponse.statusCode).toBe(404);
  });
});

describe('contrôles d’accès', () => {
  it('refuse un étranger au couple', async () => {
    const { app } = await monterServeur();
    expect((await lire(app, INTRUS)).statusCode).toBe(403);
    expect((await creerProjet(app, INTRUS, 'Un projet')).statusCode).toBe(403);
  });

  it('refuse sans jeton', async () => {
    const { app } = await monterServeur();
    const reponse = await app.inject({
      method: 'GET',
      url: `/couples/${COUPLE_ID}/vie-pratique`,
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ferme tout après dissociation, et efface la vie pratique', async () => {
    const { app, depot } = await monterServeur();
    await creerProjet(app, GAELLE, 'Un projet');

    await app.inject({
      method: 'POST',
      url: `/couples/${COUPLE_ID}/dissociation`,
      headers: entete(ROCHAMBEAU),
    });

    expect((await lire(app, GAELLE)).statusCode).toBe(410);
    expect(await depot.viePratique.projets(COUPLE_ID)).toHaveLength(0);
  });
});
