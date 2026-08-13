import Fastify, { type FastifyInstance } from 'fastify';
import type { KeyObject } from 'node:crypto';
import type { CategorieNotification, ThemeAxe } from '@lonlonbenu/shared';
import { creerDepotMemoire } from './domaine/depotMemoire.ts';
import type { Depot } from './domaine/depot.ts';
import { creerServiceAxes } from './modules/axes/axes.service.ts';
import { creerServiceAppairage } from './modules/appairage/appairage.service.ts';
import { creerServiceDissociation } from './modules/dissociation/dissociation.service.ts';
import { creerServicePartages } from './modules/partages/partages.service.ts';
import { creerServiceCycle } from './modules/cycle/cycle.service.ts';
import { enregistrerRoutesCycle } from './modules/cycle/cycle.routes.ts';
import { creerServiceConfidences } from './modules/confidences/confidences.service.ts';
import { enregistrerRoutesConfidences } from './modules/confidences/confidences.routes.ts';
import { creerServiceChat } from './modules/chat/chat.service.ts';
import { creerServicePresence } from './modules/presence/presence.service.ts';
import {
  enregistrerRoutesChat,
  enregistrerRoutesPresence,
} from './modules/chat/chat.routes.ts';
import { creerServiceViePratique } from './modules/vie-pratique/viePratique.service.ts';
import { enregistrerRoutesViePratique } from './modules/vie-pratique/viePratique.routes.ts';
import { executerLesRappels } from './modules/rappels/planificateur.ts';
import { creerExpediteur } from './modules/notifications/expedition.ts';
import { creerTransportFactice, type Transport } from './modules/notifications/transport.ts';
import { enregistrerRoutesOAuth } from './modules/oauth/oauth.routes.ts';
import { creerAuthentification } from './securite/authentification.ts';
import { genererPaire } from './securite/oauth/cles.ts';
import { creerDepotOAuthMemoire } from './securite/oauth/depotOAuthMemoire.ts';
import type { DepotOAuth } from './securite/oauth/depotOAuth.ts';
import { creerServeurAutorisation } from './securite/oauth/serveurAutorisation.ts';

export interface OptionsServeur {
  depot?: Depot;
  depotOAuth?: DepotOAuth;
  transport?: Transport;
  /** Secret du déclencheur de tâches planifiées. Sans lui, la route n'existe pas. */
  secretTaches?: string;
  oauth?: {
    emetteur: string;
    audience: string;
    clientsAutorises: readonly string[];
    clePrivee: KeyObject;
    clePublique: KeyObject;
  };
}

/** Correspondance entre motif de refus et code HTTP. */
const CODES: Record<string, number> = {
  couple_introuvable: 404,
  module_inconnu: 404,
  axe_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  partage_inactif: 403,
  deja_dissocie: 409,
  meme_personne: 409,
  expiree: 410,
  deja_utilisee: 410,
  trop_d_essais: 429,
  code_incorrect: 401,
};

export function creerServeur(options: OptionsServeur = {}) {
  const depot = options.depot ?? creerDepotMemoire();
  const depotOAuth = options.depotOAuth ?? creerDepotOAuthMemoire();
  const transport = options.transport ?? creerTransportFactice();

  const paire = options.oauth ?? {
    emetteur: 'https://auth.lonlonbenu.local',
    audience: 'lonlonbenu-api',
    clientsAutorises: ['lonlonbenu-mobile'],
    ...genererPaire(),
  };

  const autorisation = creerServeurAutorisation(depotOAuth, paire);
  const expediteur = creerExpediteur(depot, transport);
  const axes = creerServiceAxes(depot);
  const appairage = creerServiceAppairage(depot);
  const dissociation = creerServiceDissociation(depot, expediteur);
  const partages = creerServicePartages(depot, expediteur);
  const cycle = creerServiceCycle(depot);
  const confidences = creerServiceConfidences(depot);
  const chat = creerServiceChat(depot);
  const presence = creerServicePresence(depot);
  const viePratique = creerServiceViePratique(depot);
  const authentifier = creerAuthentification(autorisation, depot);

  const app: FastifyInstance = Fastify({ logger: false });

  /**
   * Un POST sans corps est légitime — une dissociation, une révocation n'ont
   * rien à transmettre. Par défaut Fastify le refuse dès que le client annonce
   * `application/json`, ce qui n'apparaît jamais en test injecté et casse à la
   * première requête réelle.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_requete, corps, fait) => {
      const texte = (corps as string).trim();
      if (!texte) return fait(null, undefined);
      try {
        fait(null, JSON.parse(texte));
      } catch (erreur) {
        fait(erreur as Error, undefined);
      }
    },
  );

  enregistrerRoutesOAuth(app, autorisation, depot);
  enregistrerRoutesCycle(app, cycle, authentifier);
  enregistrerRoutesConfidences(app, confidences, authentifier);
  enregistrerRoutesChat(app, chat, authentifier);
  enregistrerRoutesPresence(app, presence, authentifier);
  enregistrerRoutesViePratique(app, viePratique, authentifier);

  // ------------------------------------------------------- exigence 3 : appairage

  app.post('/appairages', { preHandler: authentifier }, async (requete, reponse) => {
    const corps = requete.body as { prenom?: string };
    if (!corps?.prenom) {
      return reponse.code(400).send({ motif: 'champs_manquants' });
    }

    // L'émetteur est celui du jeton, jamais celui du corps de la requête.
    const emise = await appairage.emettre({
      id: requete.identite!.partenaireId,
      prenom: corps.prenom,
    });
    // Le code n'est rendu qu'ici, une seule fois.
    return reponse.code(201).send(emise);
  });

  app.post(
    '/appairages/:invitationId/acceptation',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { invitationId } = requete.params as { invitationId: string };
      const corps = requete.body as { prenom?: string; code?: string };
      if (!corps?.prenom || !corps.code) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await appairage.accepter(invitationId, corps.code, {
        id: requete.identite!.partenaireId,
        prenom: corps.prenom,
      });

      if (!resultat.ok) {
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif, message: resultat.message });
      }
      // Aucun jeton à réémettre : l'appartenance au couple est résolue en base
      // à chaque requête, donc le jeton existant vaut immédiatement.
      return reponse.code(201).send({ coupleId: resultat.coupleId });
    },
  );

  // ------------------------------------------------------------ exigence 1 : axes

  app.get(
    '/couples/:coupleId/axes',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await axes.lister(coupleId, requete.identite!.partenaireId);

      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { axes: resultat.axes };
    },
  );

  app.post(
    '/couples/:coupleId/axes',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { theme?: ThemeAxe; titre?: string };
      if (!corps?.theme || !corps.titre) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await axes.ouvrir(
        coupleId,
        requete.identite!.partenaireId,
        corps.theme,
        corps.titre,
      );
      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ axe: resultat.axe });
    },
  );

  app.post(
    '/couples/:coupleId/axes/:axeId/contribution',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, axeId } = requete.params as {
        coupleId: string;
        axeId: string;
      };
      const corps = requete.body as { ressenti?: string; besoin?: string };

      const resultat = await axes.contribuer(
        coupleId,
        requete.identite!.partenaireId,
        axeId,
        corps?.ressenti ?? '',
        corps?.besoin ?? '',
      );
      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { axe: resultat.axe };
    },
  );

  app.put(
    '/couples/:coupleId/axes/:axeId/cloture',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, axeId } = requete.params as {
        coupleId: string;
        axeId: string;
      };
      const corps = requete.body as { cloture?: boolean };
      if (typeof corps?.cloture !== 'boolean') {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await axes.cloturer(
        coupleId,
        requete.identite!.partenaireId,
        axeId,
        corps.cloture,
      );
      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { axe: resultat.axe };
    },
  );

  // ------------------------------------------------- consentements réciproques

  app.get(
    '/couples/:coupleId/partages',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await partages.lister(coupleId, requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { partages: resultat.partages };
    },
  );

  app.put(
    '/couples/:coupleId/partages/:module',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, module } = requete.params as {
        coupleId: string;
        module: string;
      };
      const corps = requete.body as { actif?: boolean };
      if (typeof corps?.actif !== 'boolean') {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      // On ne bascule que son propre consentement : l'identité vient du jeton.
      const resultat = await partages.basculer(
        coupleId,
        requete.identite!.partenaireId,
        module,
        corps.actif,
      );
      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { partage: resultat.partage };
    },
  );

  // ---------------------------------------------------- exigence 2 : dissociation

  app.post(
    '/couples/:coupleId/dissociation',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await dissociation.dissocier(
        coupleId,
        requete.identite!.partenaireId,
      );

      if (!resultat.ok) {
        return reponse.code(CODES[resultat.motif ?? ''] ?? 400).send({ motif: resultat.motif });
      }
      return { dissocieLe: resultat.dissocieLe, notifies: resultat.notifies };
    },
  );

  // --------------------------------------------------- exigence 4 : notifications

  app.post('/appareils', { preHandler: authentifier }, async (requete, reponse) => {
    const corps = requete.body as {
      jetonPush?: string;
      plateforme?: 'ios' | 'android';
    };
    if (!corps?.jetonPush || !corps.plateforme) {
      return reponse.code(400).send({ motif: 'champs_manquants' });
    }

    await depot.appareils.enregistrer({
      partenaireId: requete.identite!.partenaireId,
      jetonPush: corps.jetonPush,
      plateforme: corps.plateforme,
    });
    return reponse.code(201).send({ enregistre: true });
  });

  app.post('/notifications', { preHandler: authentifier }, async (requete, reponse) => {
    const corps = requete.body as {
      destinataireId?: string;
      categorie?: CategorieNotification;
      texte?: string;
    };
    if (!corps?.destinataireId || !corps.categorie || !corps.texte) {
      return reponse.code(400).send({ motif: 'champs_manquants' });
    }

    const couple = await depot.couples.parPartenaire(requete.identite!.partenaireId);
    if (!couple || couple.dissocieLe) {
      return reponse.code(410).send({ motif: 'couple_dissocie' });
    }
    if (!couple.couple.partenaires.some((p) => p.id === corps.destinataireId)) {
      return reponse.code(403).send({ motif: 'non_membre' });
    }

    const [notification] = await expediteur.publier([
      {
        destinataireId: corps.destinataireId,
        categorie: corps.categorie,
        texte: corps.texte,
      },
    ]);
    return reponse
      .code(202)
      .send({ remise: notification!.remise, raison: notification!.raison });
  });

  app.post('/notifications/vidage', { preHandler: authentifier }, async (requete) => {
    const expediees = await expediteur.viderLaFile(requete.identite!.partenaireId);
    return { expediees };
  });

  /**
   * Déclenchement du balayage des rappels, pour une tâche planifiée externe.
   * Protégé par un secret dédié : ce n'est pas une route d'utilisateur, et
   * l'exposer sans garde permettrait de faire sonner les téléphones à volonté.
   * Non enregistrée si aucun secret n'est configuré — mieux vaut une route
   * absente qu'une route ouverte.
   */
  if (options.secretTaches) {
    app.post('/taches/rappels', async (requete, reponse) => {
      const entete = requete.headers.authorization;
      const fourni = entete?.startsWith('Bearer ') ? entete.slice(7).trim() : undefined;
      if (fourni !== options.secretTaches) {
        return reponse.code(401).send({ motif: 'non_authentifie' });
      }
      return executerLesRappels(depot, expediteur);
    });
  }

  app.get('/sante', async () => ({ etat: 'ok' }));

  return {
    app,
    depot,
    depotOAuth,
    expediteur,
    transport,
    autorisation,
    services: {
      axes,
      appairage,
      dissociation,
      partages,
      cycle,
      confidences,
      chat,
      presence,
      viePratique,
    },
  };
}
