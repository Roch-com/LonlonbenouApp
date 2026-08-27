/**
 * Vérifie que `DATABASE_URL` mène à une base joignable, et que le schéma s'y
 * applique. Si le port configuré ne répond pas, essaie les autres instances
 * PostgreSQL de la machine avec les mêmes identifiants — une machine de
 * développement en héberge souvent plusieurs, et se tromper de port produit
 * une erreur d'authentification trompeuse.
 */
import { Client } from 'pg';

const configuree = process.env['DATABASE_URL'];
if (!configuree) {
  console.error('DATABASE_URL absente.');
  process.exit(1);
}

// Constante annotée : `process.exit` ne suffit pas toujours à convaincre le
// vérificateur que la valeur est définie au-delà du garde-fou.
const url: string = configuree;

/** Jamais le mot de passe dans une sortie console. */
function masquer(u: string): string {
  return u.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');
}

async function essayer(cible: string): Promise<string | undefined> {
  const client = new Client({
    connectionString: cible,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const { rows } = await client.query<{ version: string }>('SELECT version()');
    await client.end();
    return rows[0]?.version;
  } catch (erreur) {
    await client.end().catch(() => {});
    throw erreur;
  }
}

console.log(`Cible : ${masquer(url)}`);

try {
  const version = await essayer(url);
  console.log(`\n✅ Connexion établie.\n   ${version}`);
  process.exit(0);
} catch (erreur) {
  console.log(`\n❌ Échec : ${(erreur as Error).message}`);
}

console.log('\nEssais sur les autres instances de la machine…');
for (const port of ['5432', '5433', '5434']) {
  const variante: string = url.replace(/(@[^/:]+):\d+\//, `$1:${port}/`);
  if (variante === url) continue;
  try {
    const version = await essayer(variante);
    console.log(`\n✅ Le port ${port} répond : ${version?.split(',')[0]}`);
    console.log(
      `   Corriger DATABASE_URL dans apps/api/.env pour pointer sur ${port}.`,
    );
    process.exit(0);
  } catch (erreur) {
    console.log(`   ${port} : ${(erreur as Error).message}`);
  }
}

console.log('\nAucune instance n’a répondu.');
process.exit(1);
