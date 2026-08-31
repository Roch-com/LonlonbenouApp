import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import limiteDebit from '@fastify/rate-limit';
import type { KeyObject } from 'node:crypto';
import type { CategorieNotification, ThemeAxe } from '@lonlonbenu/shared';
import { creerDepotMemoire } from './domaine/depotMemoire.ts';
import type { Depot } from './domaine/depot.ts';
import { creerServiceAxes } from './modules/axes/axes.service.ts';
import { creerServiceAppairage } from './modules/appairage/appairage.service.ts';
import { creerServiceDissociation } from './modules/dissociation/dissociation.service.ts';
import { creerServicePartages } from './modules/partages/partages.service.ts';
import { creerServiceCompte } from './modules/compte/compte.service.ts';
import { enregistrerRoutesCompte } from './modules/compte/compte.routes.ts';
import { enregistrerIdempotence } from './securite/idempotence.ts';
import { creerServiceActivite } from './modules/activite/activite.service.ts';
import { enregistrerRoutesActivite } from './modules/activite/activite.routes.ts';
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
import {
  creerTransportFactice,
  type Transport,
} from './modules/notifications/transport.ts';
import { enregistrerRoutesOAuth } from './modules/oauth/oauth.routes.ts';
import { creerAuthentification } from './securite/authentification.ts';
import { optionsJournal } from './observabilite.ts';
import {
  creerCourrierFactice,
  type Courrier,
} from './modules/courrier/courrier.ts';
import { enregistrerRoutesMotDePasse } from './modules/courrier/motDePasse.routes.ts';
import { surveillerLeServeur } from './surveillance.ts';
import { genererPaire } from './securite/oauth/cles.ts';
import { creerDepotOAuthMemoire } from './securite/oauth/depotOAuthMemoire.ts';
import type { DepotOAuth } from './securite/oauth/depotOAuth.ts';
import { creerServeurAutorisation } from './securite/oauth/serveurAutorisation.ts';

export interface OptionsServeur {
  depot?: Depot;
  depotOAuth?: DepotOAuth;
  transport?: Transport;
  courrier?: Courrier;
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

export async function creerServeur(options: OptionsServeur = {}) {
  const depot = options.depot ?? creerDepotMemoire();
  const depotOAuth = options.depotOAuth ?? creerDepotOAuthMemoire();
  const transport = options.transport ?? creerTransportFactice();
  const courrier = options.courrier ?? creerCourrierFactice();

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
  const compte = creerServiceCompte(depot, depotOAuth, dissociation);
  const partages = creerServicePartages(depot, expediteur);
  const activite = creerServiceActivite(depot);
  const cycle = creerServiceCycle(depot);
  const confidences = creerServiceConfidences(depot);
  const chat = creerServiceChat(depot);
  const presence = creerServicePresence(depot);
  const viePratique = creerServiceViePratique(depot);
  const authentifier = creerAuthentification(autorisation, depot);

  const app: FastifyInstance = Fastify(optionsJournal());

  /**
   * En-têtes de sécurité. L'API ne sert pas de pages, mais elle répond à un
   * navigateur si on l'y invite : ces en-têtes évitent qu'une réponse JSON soit
   * interprétée comme du contenu exécutable.
   *
   * `contentSecurityPolicy` est désactivée : elle ne régit que du HTML, et sa
   * valeur par défaut ajouterait un en-tête inutile à chaque réponse.
   */
  await app.register(helmet, { contentSecurityPolicy: false });

  /**
   * Limitation de débit.
   *
   * Le point sensible est l'appairage : un code à six caractères se devine par
   * force brute si rien ne freine les tentatives. Le service compte déjà les
   * essais et brûle le code au cinquième — mais ce compteur est par invitation,
   * et n'empêche pas d'essayer en masse sur des invitations différentes.
   *
   * La limite porte sur l'adresse d'origine, et laisse passer largement de quoi
   * couvrir un usage normal : personne n'envoie cent requêtes par minute en
   * consultant son agenda.
   */
  // `await` et non `void` : sans attendre le chargement du plugin, ses crochets
  // s'installent APRÈS l'enregistrement des routes, et la limitation ne
  // s'applique alors à aucune d'entre elles. Le serveur démarre, les en-têtes
  // n'apparaissent pas, et rien ne signale que le garde-fou est inerte.
  await app.register(limiteDebit, {
    max: Number(process.env['LONLONBENU_LIMITE_REQUETES'] ?? 120),
    timeWindow: '1 minute',
    // Les tests injectent des centaines de requêtes depuis la même origine.
    enableDraftSpec: true,
    allowList: () => process.env['NODE_ENV'] === 'test',
    // L'objet rendu ici est **levé** par le plugin, pas simplement sérialisé :
    // sans `statusCode`, Fastify le traite en erreur inattendue et répond 500.
    // Le client verrait une panne serveur là où il a seulement été freiné.
    // `contexte.after` est formaté en anglais par le plugin : on n'expose pas
    // « 58 seconds » dans une application francophone. La fenêtre étant fixe,
    // une phrase constante dit la même chose sans mélanger les langues.
    errorResponseBuilder: () => ({
      statusCode: 429,
      motif: 'trop_de_requetes',
      message: 'Trop de tentatives. Réessayez dans une minute.',
    }),
  });

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

  /**
   * Dernier rempart avant le client.
   *
   * Sans lui, une erreur non rattrapée part telle quelle : un doublon en base
   * répondait `duplicate key value violates unique constraint
   * "comptes_courriel_key"` — nom de table et de contrainte compris. C'est deux
   * problèmes à la fois. Pour qui utilise l'app, un message technique en
   * anglais ne dit rien de ce qu'il faut faire ; pour qui l'attaque, il dessine
   * gratuitement le schéma de la base.
   *
   * Les erreurs déjà qualifiées — celles qui portent un code HTTP inférieur à
   * 500, posées volontairement par une route — passent inchangées. Seules les
   * autres sont remplacées par un message neutre, le détail restant au journal.
   */
  // Posé avant les routes : le client rejoue une requête expirée pour survivre
  // au réveil du serveur, et sans cela le rejeu créait un second message.
  enregistrerIdempotence(app);

  app.setErrorHandler((brute, requete, reponse) => {
    const erreur = brute as {
      statusCode?: number;
      code?: string;
      message?: string;
      motif?: string;
    };
    const statut = erreur.statusCode ?? 500;

    if (statut < 500) {
      return reponse.code(statut).send({
        motif: erreur.motif ?? erreur.code,
        message: erreur.message,
      });
    }

    requete.log.error({ err: brute }, 'erreur non rattrapée');

    return reponse.code(500).send({
      motif: 'erreur_serveur',
      message: 'Quelque chose n’a pas fonctionné de notre côté. Réessayez.',
    });
  });

  // Après les plugins, avant les routes : le gestionnaire doit être en place
  // quand la première d'entre elles lève.
  surveillerLeServeur(app);

  enregistrerRoutesOAuth(app, autorisation, depot);
  enregistrerRoutesMotDePasse(app, autorisation, depotOAuth, courrier);
  enregistrerRoutesCompte(app, compte, authentifier);
  enregistrerRoutesActivite(app, activite, authentifier);
  enregistrerRoutesCycle(app, cycle, authentifier);
  enregistrerRoutesConfidences(app, confidences, authentifier);
  enregistrerRoutesChat(app, chat, authentifier);
  enregistrerRoutesPresence(app, presence, authentifier);
  enregistrerRoutesViePratique(app, viePratique, authentifier);

  // ------------------------------------------------------- exigence 3 : appairage

  app.post(
    '/appairages',
    { preHandler: authentifier },
    async (requete, reponse) => {
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
    },
  );

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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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
      const resultat = await partages.lister(
        coupleId,
        requete.identite!.partenaireId,
      );
      if (!resultat.ok) {
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
      }
      return { partage: resultat.partage };
    },
  );

  /**
   * Date d'origine du couple.
   *
   * Le serveur la fixe au jour de l'appairage, faute de mieux — mais un couple
   * ne commence pas le jour où il installe une application. Sans ce correctif,
   * le compteur affiche une durée fausse, et c'est le premier chiffre que les
   * deux voient en ouvrant l'app.
   *
   * Chacun peut la modifier, sans validation de l'autre : c'est une donnée
   * commune, pas une donnée personnelle, et exiger un accord à deux pour
   * corriger une faute de saisie serait de la cérémonie.
   */
  app.put(
    '/couples/:coupleId/depuis',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { depuis?: string };

      if (!corps?.depuis || !/^\d{4}-\d{2}-\d{2}$/.test(corps.depuis)) {
        return reponse
          .code(400)
          .send({
            motif: 'date_invalide',
            message: 'Format attendu : AAAA-MM-JJ.',
          });
      }

      const jour = new Date(`${corps.depuis}T00:00:00.000Z`);
      if (Number.isNaN(jour.getTime())) {
        return reponse
          .code(400)
          .send({ motif: 'date_invalide', message: 'Cette date n’existe pas.' });
      }
      // Une date future donnerait un compteur négatif : mieux vaut refuser que
      // d'afficher « ensemble depuis -12 jours ».
      if (jour.getTime() > Date.now()) {
        return reponse.code(400).send({
          motif: 'date_future',
          message: 'Cette date n’est pas encore arrivée.',
        });
      }

      const couple = await depot.couples.parId(coupleId);
      if (!couple || couple.dissocieLe) {
        return reponse.code(410).send({ motif: 'couple_dissocie' });
      }
      // L'appartenance se vérifie contre le dépôt, jamais contre le corps de
      // la requête : c'est la règle suivie par toutes les autres routes.
      const membre = couple.couple.partenaires.some(
        (p) => p.id === requete.identite!.partenaireId,
      );
      if (!membre) return reponse.code(403).send({ motif: 'non_membre' });

      await depot.couples.enregistrer({
        ...couple,
        couple: { ...couple.couple, depuis: corps.depuis },
      });

      return { depuis: corps.depuis };
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
        return reponse
          .code(CODES[resultat.motif ?? ''] ?? 400)
          .send({ motif: resultat.motif });
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

  app.post(
    '/notifications',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const corps = requete.body as {
        destinataireId?: string;
        categorie?: CategorieNotification;
        texte?: string;
      };
      if (!corps?.destinataireId || !corps.categorie || !corps.texte) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const couple = await depot.couples.parPartenaire(
        requete.identite!.partenaireId,
      );
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
    },
  );

  app.post(
    '/notifications/vidage',
    { preHandler: authentifier },
    async (requete) => {
      const expediees = await expediteur.viderLaFile(
        requete.identite!.partenaireId,
      );
      return { expediees };
    },
  );

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
      const fourni = entete?.startsWith('Bearer ')
        ? entete.slice(7).trim()
        : undefined;
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
    courrier,
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
