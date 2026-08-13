import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const CHEMIN_SCHEMA = fileURLToPath(new URL('./schema.sql', import.meta.url));

/**
 * Applique `schema.sql`. Toutes les instructions sont `IF NOT EXISTS`, donc
 * l'appel est idempotent — c'est suffisant tant qu'il n'y a qu'une version du
 * schéma. Dès la première migration destructive, il faudra une vraie table de
 * versions ; l'écrire maintenant serait de la cérémonie sans contenu.
 */
export async function appliquerLeSchema(pool: Pool, schema?: string): Promise<void> {
  const sql = await readFile(CHEMIN_SCHEMA, 'utf8');
  const client = await pool.connect();
  try {
    if (schema) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${identifiant(schema)}`);
      await client.query(`SET search_path TO ${identifiant(schema)}`);
    }
    await client.query(sql);
  } finally {
    client.release();
  }
}

/** Échappement d'identifiant : jamais d'interpolation nue dans du DDL. */
export function identifiant(nom: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nom)) {
    throw new Error(`Nom de schéma refusé : ${nom}`);
  }
  return `"${nom}"`;
}
