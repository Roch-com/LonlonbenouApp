import { demarrerLaSurveillance } from './surveillance.ts';

// En premier, avant tout autre import applicatif : une erreur survenue pendant
// le montage du serveur est la plus difficile à diagnostiquer à distance, et
// c'est précisément celle qu'on perdrait en initialisant plus tard.
const surveille = demarrerLaSurveillance();

import { type Pool } from 'pg';
import { creerServeur } from './serveur.ts';
import { chargerPaire } from './securite/oauth/cles.ts';
import { normaliserPem } from './securite/pem.ts';
import { creerDepotPostgres, creerPool } from './domaine/depotPostgres.ts';
import { creerDepotOAuthPostgres } from './securite/oauth/depotOAuthPostgres.ts';
import { appliquerLeSchema } from './db/migrations.ts';
import { demarrerLePlanificateur } from './modules/rappels/planificateur.ts';
import { creerTransportDepuisEnv } from './modules/notifications/transportDepuisEnv.ts';
import { creerCourrierDepuisEnv } from './modules/courrier/courrier.ts';

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    console.error(
      `${nom} est requis. Aucune valeur par défaut n’est fournie : ` +
        'un secret de développement finit toujours par se retrouver en production.',
    );
    process.exit(1);
  }
  return valeur;
}

const urlBase = requis('DATABASE_URL');
const clePriveePem = requis('LONLONBENU_CLE_PRIVEE_PEM');
const emetteur = requis('LONLONBENU_OAUTH_EMETTEUR');
const audience = process.env['LONLONBENU_OAUTH_AUDIENCE'] ?? 'lonlonbenu-api';
const clients = (process.env['LONLONBENU_OAUTH_CLIENTS'] ?? 'lonlonbenu-mobile')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

/**
 * `auto` suffit dans les deux cas courants : pas de TLS vers une base locale,
 * TLS dès que l'hôte est distant. `LONLONBENU_DB_SSL` permet de forcer l'un ou
 * l'autre si un hébergeur sort de ce cadre.
 */
const modeSsl = (process.env['LONLONBENU_DB_SSL'] ?? 'auto') as
  'auto' | 'requis' | 'aucun';

const pool: Pool = creerPool({ connectionString: urlBase, ssl: modeSsl });
await appliquerLeSchema(pool);

const { clePrivee, clePublique } = chargerPaire(normaliserPem(clePriveePem));

const secretTaches = process.env['LONLONBENU_SECRET_TACHES'];

console.log(
  surveille
    ? 'Suivi des erreurs actif.'
    : 'Suivi des erreurs inactif (SENTRY_DSN absente).',
);

const { courrier, fournisseur } = creerCourrierDepuisEnv();
console.log(
  fournisseur === 'aucun'
    ? 'Aucun envoi de courriel configuré : les codes de réinitialisation ne partiront pas.'
    : `Envoi de courriel par ${fournisseur}.`,
);

const { transport, plateformes } = creerTransportDepuisEnv();
if (plateformes.length === 0) {
  console.warn(
    'Aucun transport push configuré : les notifications resteront dans le journal ' +
      'de l’app, sans jamais atteindre un écran verrouillé. ' +
      'Voir apps/api/README.md, section « Notifications push ».',
  );
} else {
  console.log(`Transport push gréé pour : ${plateformes.join(', ')}`);
}

const { app, depot, expediteur } = await creerServeur({
  depot: creerDepotPostgres(pool),
  depotOAuth: creerDepotOAuthPostgres(pool),
  oauth: { emetteur, audience, clientsAutorises: clients, clePrivee, clePublique },
  transport,
  courrier,
  ...(secretTaches ? { secretTaches } : {}),
});

/**
 * Balayage des rappels. Il tourne dans le processus du serveur, ce qui suffit
 * à une seule instance ; à plusieurs, il faudra le confier à une tâche
 * planifiée externe qui appelle `/taches/rappels` — d'où l'existence de cette
 * route. Deux instances qui balaient en parallèle ne dupliqueraient rien (les
 * clés d'idempotence sont en base), mais autant ne pas travailler pour rien.
 */
const arreterLePlanificateur = demarrerLePlanificateur(depot, expediteur);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    arreterLePlanificateur();
    void app.close().then(() => process.exit(0));
  });
}

// Les hébergeurs imposent le port par l'environnement : le coder en dur ferait
// échouer le contrôle de santé et le déploiement serait déclaré mort-né.
const port = Number(process.env['PORT'] ?? 3000);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API LONLONBENU à l’écoute sur :${port}`);
} catch (erreur) {
  console.error(erreur);
  process.exit(1);
}
