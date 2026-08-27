import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

/**
 * Suivi des erreurs serveur.
 *
 * Sans DSN, rien n'est initialisé et le module ne coûte rien : c'est ce qui
 * permet de livrer le câblage avant que le compte n'existe, et de l'activer
 * plus tard en posant une seule variable d'environnement.
 *
 * ## Ce qui ne doit jamais sortir d'ici
 *
 * Un rapport d'erreur part chez un tiers, s'affiche dans une interface web et
 * se conserve des mois. Envoyer par mégarde le texte d'une confidence ou une
 * date de règles annulerait tout ce que le projet promet par ailleurs. Trois
 * garde-fous, du plus large au plus précis :
 *
 *  1. `sendDefaultPii: false` — ni adresse IP, ni en-têtes de requête, ni
 *     cookies. C'est le défaut, on l'inscrit pour qu'un changement d'avis soit
 *     un acte délibéré.
 *  2. `beforeSend` retire les corps de requête. Un corps porte des ressentis,
 *     des symptômes, des enveloppes de message : rien de tout cela n'aide à
 *     corriger un bogue, et tout y est sensible.
 *  3. `beforeBreadcrumb` coupe les fils d'exécution des requêtes sortantes,
 *     dont les URL contiennent des identifiants de couple.
 *
 * Ce qui reste : le type d'erreur, la pile d'appels, le fichier et la ligne.
 * C'est exactement ce qu'il faut pour corriger, et rien de plus.
 */
export function demarrerLaSurveillance(): boolean {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env['LONLONBENU_ENVIRONNEMENT'] ?? 'production',
    release: process.env['RENDER_GIT_COMMIT'] ?? undefined,

    // Échantillonnage des traces de performance. À 10 %, on voit les tendances
    // sans saturer le quota gratuit ni ralentir le service.
    tracesSampleRate: 0.1,

    sendDefaultPii: false,

    beforeSend(evenement) {
      if (evenement.request) {
        delete evenement.request.data;
        delete evenement.request.cookies;
        delete evenement.request.headers;
        // La chaîne de requête peut porter un identifiant de couple.
        if (evenement.request.url) {
          evenement.request.url = evenement.request.url.split('?')[0];
        }
      }
      // Aucun utilisateur nommé : un identifiant de partenaire suffirait à
      // relier des erreurs à une personne réelle.
      delete evenement.user;
      return evenement;
    },

    beforeBreadcrumb(fil) {
      // Les fils réseau portent des URL avec identifiants ; les fils de console
      // peuvent porter n'importe quoi qu'un `console.log` oublié aurait écrit.
      if (fil.category === 'http' || fil.category === 'console') return null;
      return fil;
    },
  });

  return true;
}

/**
 * Branche le gestionnaire d'erreurs Fastify. Sans appel, une exception dans une
 * route serait journalisée localement mais jamais remontée.
 */
export function surveillerLeServeur(app: FastifyInstance): void {
  if (!process.env['SENTRY_DSN']) return;
  Sentry.setupFastifyErrorHandler(app);
}
