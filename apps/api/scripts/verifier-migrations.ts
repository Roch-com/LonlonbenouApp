/**
 * Applique les migrations deux fois de suite et vérifie que la seconde ne
 * refait rien. C'est la propriété qui compte au redémarrage d'un service :
 * l'hébergeur relance le processus sans prévenir, et le schéma ne doit pas
 * être rejoué à chaque fois.
 */
import { Client } from 'pg';
import { creerPool } from '../src/domaine/depotPostgres.ts';
import { appliquerLeSchema } from '../src/db/migrations.ts';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL absente.');
  process.exit(1);
}

const pool = creerPool({ connectionString: url });
const client = new Client({ connectionString: url });
await client.connect();

console.log('— première application');
await appliquerLeSchema(pool);
const premiere = await client.query<{ version: string }>(
  'SELECT version FROM schema_versions ORDER BY version',
);
console.log('  versions :', premiere.rows.map((r) => r.version).join(', '));

console.log('— seconde application');
await appliquerLeSchema(pool);
const seconde = await client.query<{ version: string }>(
  'SELECT version FROM schema_versions ORDER BY version',
);

const tables = await client.query<{ n: number }>(
  "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'",
);

console.log('  versions :', seconde.rows.map((r) => r.version).join(', '));
console.log(`  tables en base : ${tables.rows[0]!.n}`);

const stable = premiere.rowCount === seconde.rowCount;
console.log(
  stable
    ? '\n✅ Idempotent.'
    : '\n❌ La seconde application a rejoué une migration.',
);

await client.end();
await pool.end();
process.exit(stable ? 0 : 1);
