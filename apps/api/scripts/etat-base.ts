/** Inventaire des tables : confirme que le schéma s'est bien appliqué. */
import { Client } from 'pg';

const client = new Client({ connectionString: process.env['DATABASE_URL'] });
await client.connect();

const { rows } = await client.query<{ tablename: string }>(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
);

console.log(`${rows.length} tables`);
for (const { tablename } of rows) console.log(`  ${tablename}`);

await client.end();
