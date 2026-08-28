import type { FastifyServerOptions } from 'fastify';

/**
 * Journalisation du serveur.
 *
 * Le serveur tournait avec `logger: false`. En développement, c'est un confort
 * — la sortie reste lisible. En production, c'est l'aveuglement complet : une
 * erreur chez le couple pilote ne laisse aucune trace, et il ne reste qu'à
 * espérer que la personne pense à la signaler.
 *
 * ## Ce qui ne doit jamais entrer dans un journal
 *
 * Un journal se relit à plusieurs, se copie dans un ticket, part chez un
 * hébergeur. Y laisser un jeton, un mot de passe ou le texte d'un message
 * annulerait le travail fait ailleurs pour que ces données restent privées.
 * D'où la liste de rédaction ci-dessous, qui remplace les valeurs sensibles
 * par un marqueur avant écriture.
 *
 * Le chat n'a de toute façon rien à craindre — le serveur n'en voit que des
 * enveloppes scellées — mais les autres pôles transitent en clair.
 */
const CHAMPS_A_MASQUER = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.motDePasse',
  'req.body.code',
  'req.body.code_verifier',
  'req.body.refresh_token',
  'req.body.jetonPush',
  'req.body.texte',
  'req.body.enveloppe',
  'req.body.ressenti',
  'req.body.besoin',
];

/**
 * Le niveau vient de l'environnement : `debug` pour chercher, `info` en
 * fonctionnement normal, `silent` pendant les tests — où des centaines de
 * requêtes injectées noieraient le résultat.
 */
function niveau(): string {
  const demande = process.env['LONLONBENU_NIVEAU_JOURNAL'];
  if (demande) return demande;
  if (process.env['NODE_ENV'] === 'test') return 'silent';
  return 'info';
}

export function optionsJournal(): FastifyServerOptions {
  // Les tests injectent des requêtes par milliers : un journal actif rendrait
  // leur sortie illisible sans rien apprendre.
  if (process.env['NODE_ENV'] === 'test') return { logger: false };

  return {
    logger: {
      level: niveau(),
      redact: { paths: CHAMPS_A_MASQUER, censor: '[masqué]' },
      // Un identifiant par requête : c'est ce qui permet de relier une erreur
      // signalée par un utilisateur à la ligne de journal correspondante.
      serializers: {
        req(requete: {
          method: string;
          url: string;
          id: string;
          headers: Record<string, unknown>;
        }) {
          return {
            id: requete.id,
            methode: requete.method,
            // La chaîne de requête peut porter un identifiant de couple : on
            // ne garde que le chemin.
            chemin: requete.url.split('?')[0],
          };
        },
      },
    },
    // Fait confiance à l'en-tête `x-forwarded-*` posé par le répartiteur de
    // l'hébergeur. Sans cela, toutes les requêtes semblent venir de la même
    // adresse interne, et la limitation de débit devient inopérante.
    trustProxy: true,
  };
}
