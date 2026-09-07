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
 * ajoutée aux migrations et oubliée ici survivrait d'un test à l'autre, et une
 * contamination de ce genre masque exactement les échecs qu'on cherche à voir.
 * C'est arrivé une fois — les clés publiques de chat restaient en place et
 * faisaient croire à un échange déjà prêt.
 */
async function tablesDuSchema(pool: pg.Pool, schema: string): Promise<string[]> {
  const { rows } = await pool.query<{ tablename: string }>(
    // `schema_versions` est exclue : elle n'appartient pas au domaine mais au
    // mécanisme de migration. La vider ferait rejouer tout le schéma entre deux
    // cas de test, pour rien.
    `SELECT tablename FROM pg_tables
      WHERE schemaname = $1 AND tablename <> 'schema_versions'`,
    [schema],
  );
  return rows.map((r) => `"${r.tablename}"`);
}

/**
 * Ordre de vidage : les tables qui référencent avant celles qui sont
 * référencées.
 *
 * `TRUNCATE … CASCADE` réglait cette question tout seul, mais il recrée un
 * fichier par table et force une synchronisation disque à chaque appel. Mesuré
 * sur ce schéma : **4995 ms pour 45 tables**, avant *chaque* test. Les mêmes
 * tables vidées par `DELETE` en un aller-retour : **57 ms**.
 *
 * `DELETE`, lui, ne gère pas les dépendances : effacer un couple avant les
 * messages qui le référencent viole la clé étrangère. D'où ce tri, calculé une
 * fois par worker à partir du catalogue.
 */
async function ordreDeVidage(pool: pg.Pool, schema: string): Promise<string[]> {
  const tables = await tablesDuSchema(pool, schema);
  const nues = tables.map((t) => t.replaceAll('"', ''));

  const { rows } = await pool.query<{ enfant: string; parent: string }>(
    `SELECT source.relname AS enfant, cible.relname AS parent
       FROM pg_constraint c
       JOIN pg_class source ON source.oid = c.conrelid
       JOIN pg_class cible  ON cible.oid  = c.confrelid
       JOIN pg_namespace n  ON n.oid      = source.relnamespace
      WHERE c.contype = 'f' AND n.nspname = $1`,
    [schema],
  );

  // Profondeur d'une table : celle de son parent le plus profond, plus un. On
  // vide des plus profondes vers les racines.
  const parents = new Map<string, string[]>();
  for (const { enfant, parent } of rows) {
    if (enfant === parent) continue; // auto-référence : sans effet sur l'ordre
    parents.set(enfant, [...(parents.get(enfant) ?? []), parent]);
  }

  const profondeurs = new Map<string, number>();
  const profondeur = (table: string, vus: Set<string>): number => {
    const connue = profondeurs.get(table);
    if (connue !== undefined) return connue;
    // Un cycle de clés étrangères ne se trie pas : on s'arrête plutôt que de
    // boucler, et le repli sur TRUNCATE prendra le relais si besoin.
    if (vus.has(table)) return 0;
    vus.add(table);
    const calculee = Math.max(
      0,
      ...(parents.get(table) ?? []).map((p) => profondeur(p, vus) + 1),
    );
    profondeurs.set(table, calculee);
    return calculee;
  };

  return [...nues]
    .sort((a, b) => profondeur(b, new Set()) - profondeur(a, new Set()))
    .map((t) => `"${t}"`);
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

/** Calculé une fois par worker : le catalogue ne bouge pas pendant la suite. */
let ordreCache: string[] | undefined;

export async function creerDepotDeTest(): Promise<Depot> {
  const url = urlBaseDeTest();
  if (!url) return creerDepotMemoire();

  const actif = await poolPret(url);
  ordreCache ??= await ordreDeVidage(actif, schemaCourant());

  if (ordreCache.length > 0) {
    const vidage = ordreCache.map((t) => `DELETE FROM ${t}`).join('; ');
    try {
      await actif.query(vidage);
    } catch {
      // Repli : un cycle de clés étrangères, ou une table apparue depuis le
      // calcul de l'ordre. Lent mais toujours correct — mieux vaut une suite
      // lente qu'une suite qui laisse des données d'un test à l'autre.
      await actif.query(`TRUNCATE ${ordreCache.join(', ')} CASCADE`);
    }
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
