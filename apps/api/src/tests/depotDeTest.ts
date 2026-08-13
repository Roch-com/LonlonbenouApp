/**
 * Fabrique de dépôt pour les tests.
 *
 * Sans variable d'environnement : dépôt en mémoire, la suite tourne partout et
 * sans dépendance. Avec `LONLONBENU_TEST_DATABASE_URL` : **la même suite, les
 * mêmes assertions**, exécutées contre PostgreSQL. C'est ce qui prouve que
 * l'adaptateur est une substitution et non une réécriture.
 *
 * Isolation : un schéma par processus de test (vitest exécute chaque fichier
 * dans son propre worker), et les tables sont vidées avant chaque test.
 */

import type pg from 'pg';
import type { Depot } from '../domaine/depot.ts';
import { creerDepotMemoire } from '../domaine/depotMemoire.ts';
import { creerDepotPostgres, creerPool } from '../domaine/depotPostgres.ts';
import { appliquerLeSchema } from '../db/migrations.ts';
import type { DepotOAuth } from '../securite/oauth/depotOAuth.ts';
import { creerDepotOAuthMemoire } from '../securite/oauth/depotOAuthMemoire.ts';
import { creerDepotOAuthPostgres } from '../securite/oauth/depotOAuthPostgres.ts';

/**
 * Tables vidées avant chaque test.
 *
 * Cette liste est déduite du schéma au lieu d'être tenue à la main : une table
 * ajoutée à `schema.sql` et oubliée ici survivrait d'un test à l'autre, et une
 * contamination de ce genre masque exactement les échecs qu'on cherche à voir.
 * C'est arrivé une fois — les clés publiques de chat restaient en place et
 * faisaient croire à un échange déjà prêt.
 */
async function tablesDuSchema(pool: pg.Pool, schema: string): Promise<string[]> {
  const { rows } = await pool.query<{ tablename: string }>(
    'SELECT tablename FROM pg_tables WHERE schemaname = $1',
    [schema],
  );
  return rows.map((r) => `"${r.tablename}"`);
}

export function urlBaseDeTest(): string | undefined {
  return process.env['LONLONBENU_TEST_DATABASE_URL'];
}

let pool: pg.Pool | undefined;
let preparation: Promise<pg.Pool> | undefined;

/** Schéma dédié au worker courant : un par processus de test. */
function schemaCourant(): string {
  return `test_w${process.env['VITEST_WORKER_ID'] ?? '0'}`;
}

async function poolPret(url: string): Promise<pg.Pool> {
  preparation ??= (async () => {
    const schema = schemaCourant();
    const nouveau = creerPool({ connectionString: url, schema });
    await appliquerLeSchema(nouveau, schema);
    pool = nouveau;
    process.once('beforeExit', () => void nouveau.end());
    return nouveau;
  })();
  return preparation;
}

export async function creerDepotDeTest(): Promise<Depot> {
  const url = urlBaseDeTest();
  if (!url) return creerDepotMemoire();

  const actif = await poolPret(url);
  const tables = await tablesDuSchema(actif, schemaCourant());
  if (tables.length > 0) {
    await actif.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  }
  return creerDepotPostgres(actif);
}

/**
 * Dépôt OAuth de test. À appeler **après** `creerDepotDeTest`, qui vide les
 * tables : l'ordre inverse effacerait les comptes tout juste créés.
 */
export async function creerDepotOAuthDeTest(): Promise<DepotOAuth> {
  const url = urlBaseDeTest();
  if (!url) return creerDepotOAuthMemoire();
  return creerDepotOAuthPostgres(await poolPret(url));
}

/** Ferme le pool ; appelé par le teardown global de vitest. */
export async function fermerLeDepotDeTest(): Promise<void> {
  await pool?.end();
  pool = undefined;
  preparation = undefined;
}
