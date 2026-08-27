import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const DOSSIER = fileURLToPath(new URL('./migrations/', import.meta.url));

/**
 * Table des versions appliquées.
 *
 * Elle-même créée en `IF NOT EXISTS` : c'est le seul morceau de schéma qui ne
 * peut pas être versionné, puisqu'il porte le versionnement.
 */
const TABLE_VERSIONS = `
  CREATE TABLE IF NOT EXISTS schema_versions (
    version     text PRIMARY KEY,
    applique_le timestamptz NOT NULL DEFAULT now()
  )
`;

/**
 * Applique les migrations en attente, dans l'ordre de leur numéro.
 *
 * Le socle était appliqué par un unique `schema.sql` entièrement en
 * `IF NOT EXISTS` — idempotent, donc suffisant tant qu'il n'existait qu'une
 * version et aucune donnée réelle. Les deux conditions viennent de tomber : il
 * y a des données de couple en base, et la moindre évolution de colonne devra
 * s'appliquer une fois et une seule.
 *
 * Chaque fichier tourne **dans une transaction**. Une migration à moitié
 * appliquée laisserait une base dans un état qu'aucun code ne sait lire, et
 * qu'aucune exécution suivante ne saurait rattraper.
 */
export async function appliquerLeSchema(
  pool: Pool,
  schema?: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    if (schema) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${identifiant(schema)}`);
      await client.query(`SET search_path TO ${identifiant(schema)}`);
    }

    await client.query(TABLE_VERSIONS);

    const appliquees = await versionsAppliquees(client);
    const fichiers = await listerMigrations();

    for (const fichier of fichiers) {
      const version = fichier.replace(/\.sql$/, '');
      if (appliquees.has(version)) continue;

      const sql = await readFile(DOSSIER + fichier, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_versions (version) VALUES ($1)', [
          version,
        ]);
        await client.query('COMMIT');
      } catch (erreur) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration « ${version} » échouée, base inchangée : ${(erreur as Error).message}`,
          { cause: erreur },
        );
      }
    }
  } finally {
    client.release();
  }
}

async function versionsAppliquees(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ version: string }>(
    'SELECT version FROM schema_versions',
  );
  return new Set(rows.map((r) => r.version));
}

/**
 * Les fichiers sont triés par nom, et leur nom commence par un numéro : c'est
 * ce qui garantit un ordre stable quelle que soit la plateforme.
 */
async function listerMigrations(): Promise<string[]> {
  const entrees = await readdir(DOSSIER);
  return entrees.filter((f) => f.endsWith('.sql')).sort();
}

/** Échappement d'identifiant : jamais d'interpolation nue dans du DDL. */
export function identifiant(nom: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nom)) {
    throw new Error(`Nom de schéma refusé : ${nom}`);
  }
  return `"${nom}"`;
}
