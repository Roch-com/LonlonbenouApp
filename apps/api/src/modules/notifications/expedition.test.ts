/** Exigence 4 — transport branché sur `deciderRemise`. */
import { describe, expect, it } from 'vitest';
import { PREFERENCES_PAR_DEFAUT } from '@lonlonbenu/shared';
import { creerDepotDeTest } from '../../tests/depotDeTest.ts';
import type { Depot } from '../../domaine/depot.ts';
import { creerExpediteur, FENETRE_REGROUPEMENT_MS } from './expedition.ts';
import { creerTransportFactice, ErreurPush, type Transport } from './transport.ts';

const GAELLE = 'gaelle';
const enPleineNuit = new Date('2026-03-15T03:00:00');
const enPleineJournee = new Date('2026-03-15T14:00:00');

async function monter(preferences?: Partial<typeof PREFERENCES_PAR_DEFAUT>) {
  const depot: Depot = await creerDepotDeTest();
  const transport = creerTransportFactice();

  await depot.appareils.enregistrer({
    partenaireId: GAELLE,
    jetonPush: 'push-gaelle',
    plateforme: 'ios',
  });
  if (preferences) {
    await depot.notifications.definirPreferences(GAELLE, {
      ...PREFERENCES_PAR_DEFAUT,
      ...preferences,
    });
  }

  return { depot, transport, expediteur: creerExpediteur(depot, transport) };
}

const message = (categorie: 'sos' | 'message' | 'presence' | 'rappel') => ({
  destinataireId: GAELLE,
  categorie,
  texte: 'contenu confidentiel',
});

describe('le SOS traverse tout', () => {
  it('part en pleine nuit, malgré le silence et la pause', async () => {
    const { expediteur, transport } = await monter({
      silence: { actif: true, debut: '00:00', fin: '23:59' },
      pauseJusqua: '2030-01-01T00:00:00.000Z',
    });

    await expediteur.publier([message('sos')], enPleineNuit);

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.titre).toBe('SOS');
  });
});

describe('ne pas déranger', () => {
  it('retient un message la nuit, sans le perdre', async () => {
    const { expediteur, transport, depot } = await monter();

    await expediteur.publier([message('message')], enPleineNuit);

    expect(transport.messages).toHaveLength(0);
    const journal = await depot.notifications.journal(GAELLE);
    expect(journal[0]?.remise).toBe('differee');
  });

  it('le remet dès le silence levé, en un seul message', async () => {
    const { expediteur, transport } = await monter();

    await expediteur.publier([message('message')], enPleineNuit);
    await expediteur.publier([message('message')], enPleineNuit);
    expect(transport.messages).toHaveLength(0);

    const expediees = await expediteur.viderLaFile(GAELLE, enPleineJournee);

    expect(expediees).toBe(2);
    // Deux notifications, un seul réveil.
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.regroupees).toBe(2);
  });

  it('ne vide rien tant que le silence dure', async () => {
    const { expediteur, transport } = await monter();

    await expediteur.publier([message('message')], enPleineNuit);
    expect(await expediteur.viderLaFile(GAELLE, enPleineNuit)).toBe(0);
    expect(transport.messages).toHaveLength(0);
  });
});

describe('fréquences', () => {
  it('n’expédie jamais une catégorie réglée sur « jamais », mais la journalise', async () => {
    const { expediteur, transport, depot } = await monter({
      parCategorie: { ...PREFERENCES_PAR_DEFAUT.parCategorie, presence: 'jamais' },
    });

    await expediteur.publier([message('presence')], enPleineJournee);

    expect(transport.messages).toHaveLength(0);
    const journal = await depot.notifications.journal(GAELLE);
    expect(journal[0]?.remise).toBe('ignoree');

    // Et le vidage ne la ressuscite pas.
    expect(await expediteur.viderLaFile(GAELLE, enPleineJournee)).toBe(0);
  });

  it('pousse immédiatement une catégorie réglée sur « tout de suite »', async () => {
    const { expediteur, transport } = await monter();
    await expediteur.publier([message('message')], enPleineJournee);
    expect(transport.messages).toHaveLength(1);
  });

  it('fait patienter une catégorie groupée jusqu’à sa fenêtre', async () => {
    const { expediteur, transport } = await monter();

    await expediteur.publier([message('presence')], enPleineJournee);
    expect(transport.messages).toHaveLength(0);

    const troppTot = new Date(enPleineJournee.getTime() + 10 * 60_000);
    expect(await expediteur.viderLaFile(GAELLE, troppTot)).toBe(0);

    const apresLaFenetre = new Date(
      enPleineJournee.getTime() + FENETRE_REGROUPEMENT_MS + 1000,
    );
    expect(await expediteur.viderLaFile(GAELLE, apresLaFenetre)).toBe(1);
  });
});

describe('contenu poussé', () => {
  it('ne met jamais le texte réel dans le message', async () => {
    const { expediteur, transport } = await monter();
    await expediteur.publier([message('message')], enPleineJournee);

    // Un message poussé transite par Apple et Google et s'affiche sur un écran
    // verrouillé : il incite à ouvrir l'app, il ne raconte rien.
    expect(JSON.stringify(transport.messages)).not.toContain('contenu confidentiel');
  });

  it('ne pousse rien vers un partenaire sans appareil enregistré', async () => {
    const { expediteur, transport, depot } = await monter();
    await depot.appareils.effacerPourPartenaire(GAELLE);

    await expediteur.publier([message('message')], enPleineJournee);
    expect(transport.messages).toHaveLength(0);
  });

  it('marque comme expédiée seulement ce qui est réellement parti', async () => {
    const { expediteur, depot } = await monter();

    await expediteur.publier([message('message')], enPleineNuit);
    expect(await depot.notifications.enAttente(GAELLE)).toHaveLength(1);

    await expediteur.viderLaFile(GAELLE, enPleineJournee);
    expect(await depot.notifications.enAttente(GAELLE)).toHaveLength(0);
  });
});

describe('quand le fournisseur refuse', () => {
  /** Journal muet : ces tests provoquent des échecs exprès. */
  const silence = { warn() {} };

  async function monterAvec(transport: Transport) {
    const depot: Depot = await creerDepotDeTest();
    await depot.appareils.enregistrer({
      partenaireId: GAELLE,
      jetonPush: 'push-gaelle',
      plateforme: 'ios',
    });
    return { depot, expediteur: creerExpediteur(depot, transport, silence) };
  }

  const refuse = (options: ConstructorParameters<typeof ErreurPush>[1]) => ({
    async pousser() {
      throw new ErreurPush('refus', options);
    },
  });

  it('délie l’appareil dont le jeton est mort', async () => {
    const { depot, expediteur } = await monterAvec(refuse({ jetonInvalide: true }));

    await expediteur.publier([message('message')], enPleineJournee);

    // Sinon on pousserait indéfiniment vers une app désinstallée.
    expect(await depot.appareils.parPartenaire(GAELLE)).toHaveLength(0);
  });

  it('garde l’appareil sur une panne passagère', async () => {
    const { depot, expediteur } = await monterAvec(refuse({ reessayable: true }));

    await expediteur.publier([message('message')], enPleineJournee);

    // Une panne de Google ne coûte pas son inscription à un appareil valide.
    expect(await depot.appareils.parPartenaire(GAELLE)).toHaveLength(1);
  });

  it('laisse la notification en attente au lieu de la déclarer expédiée', async () => {
    const { depot, expediteur } = await monterAvec(refuse({ reessayable: true }));

    await expediteur.publier([message('message')], enPleineJournee);

    const journal = await depot.notifications.journal(GAELLE);
    expect(journal[0]?.remise).toBe('envoyee');
    expect(journal[0]?.expedieeLe).toBeUndefined();
    // Elle reste reprenable : rien n'est perdu sur une panne réseau.
    expect(await depot.notifications.enAttente(GAELLE)).toHaveLength(1);
  });

  it('ne solde pas la file si le vidage échoue', async () => {
    const { depot, expediteur } = await monterAvec(refuse({ reessayable: true }));

    await expediteur.publier([message('message')], enPleineNuit);
    expect(await expediteur.viderLaFile(GAELLE, enPleineJournee)).toBe(0);
    expect(await depot.notifications.enAttente(GAELLE)).toHaveLength(1);
  });

  it('un appareil mort n’empêche pas l’autre de recevoir', async () => {
    const recus: string[] = [];
    const transport: Transport = {
      async pousser(m) {
        if (m.appareil.jetonPush === 'push-mort') {
          throw new ErreurPush('refus', { jetonInvalide: true });
        }
        recus.push(m.appareil.jetonPush);
      },
    };

    const depot: Depot = await creerDepotDeTest();
    for (const jetonPush of ['push-mort', 'push-vivant']) {
      await depot.appareils.enregistrer({
        partenaireId: GAELLE,
        jetonPush,
        plateforme: 'android',
      });
    }
    const expediteur = creerExpediteur(depot, transport, silence);

    await expediteur.publier([message('message')], enPleineJournee);

    expect(recus).toEqual(['push-vivant']);
    const restants = await depot.appareils.parPartenaire(GAELLE);
    expect(restants.map((a) => a.jetonPush)).toEqual(['push-vivant']);

    // Un seul appareil joint suffit : la personne a été prévenue.
    const journal = await depot.notifications.journal(GAELLE);
    expect(journal[0]?.expedieeLe).toBeDefined();
  });
});
