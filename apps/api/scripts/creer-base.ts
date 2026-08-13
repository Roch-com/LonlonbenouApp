/**
 * Crée la base désignée par `DATABASE_URL` si elle n'existe pas.
 *
 * `CREATE DATABASE` ne s'exécute pas depuis la base qu'on veut créer : on se
 * connecte à `postgres`, la base d'administration toujours présente.
 */
import { Client } from 'pg';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL absente.');
  process.exit(1);
}

const adresse = new URL(url);
const nom = decodeURIComponent(adresse.pathname.replace(/^\//, ''));
if (!nom) {
  console.error('Aucun nom de base dans DATABASE_URL.');
  process.exit(1);
}

const administration = new URL(url);
administration.pathname = '/postgres';

const client = new Client({ connectionString: administration.toString() });
await client.connect();

const { rowCount } = await client.query(
  'SELECT 1 FROM pg_database WHERE datname = $1',
  [nom],
);

if (rowCount === 1) {
  console.log(`La base « ${nom} » existe déjà.`);
} else {
  // Le nom vient de notre propre configuration, pas d'une entrée utilisateur,
  // mais `CREATE DATABASE` n'accepte pas de paramètre lié : on cite l'identifiant.
  await client.query(`CREATE DATABASE "${nom.replace(/"/g, '""')}"`);
  console.log(`Base « ${nom} » créée sur ${adresse.host}.`);
}

await client.end();
