import { defineConfig } from 'vitest/config';

/**
 * Contre PostgreSQL, on borne le nombre de workers.
 *
 * Pas pour la contention — c'était mon hypothèse, elle était fausse : la
 * lenteur venait du `TRUNCATE` de vidage, remplacé depuis par des `DELETE`
 * ordonnés dans `depotDeTest.ts`. Réduire les workers n'avait rien arrangé.
 *
 * La vraie raison est plus terre à terre : chaque worker crée son schéma
 * `test_w<n>`, et **aucun n'est jamais supprimé**. Sans borne, ils
 * s'accumulent au fil des exécutions — trente-sept schémas et mille six cent
 * soixante-cinq tables un jour, de quoi gonfler les catalogues de PostgreSQL
 * jusqu'à ralentir toute la suite. Quatre schémas suffisent, et restent
 * quatre.
 */
const contrePostgres = !!process.env['LONLONBENU_TEST_DATABASE_URL'];

export default defineConfig({
  test: {
    // Le serveur coupe son journal et sa limitation de débit en test :
    // des centaines de requêtes injectées noieraient la sortie et
    // déclencheraient la limite.
    env: { NODE_ENV: 'test' },
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/api/**/*.test.ts',
      // Seule la logique mobile sans dépendance native est testée ici ; le
      // reste demanderait un environnement React Native.
      'apps/mobile/src/lib/**/*.test.ts',
    ],
    // Le défaut de 5 s suppose des tests purs. Ceux de l'API montent un serveur
    // et, en mode PostgreSQL, vident treize tables avant chaque cas : sous
    // contention entre workers, quelques-uns dépassaient la limite et
    // échouaient sans la moindre assertion en cause.
    testTimeout: 30_000,
    // Le mode mémoire garde tout son parallélisme : il n'a rien à partager.
    ...(contrePostgres ? { maxWorkers: 4, minWorkers: 1 } : {}),
  },
});
