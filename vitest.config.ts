import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
  },
});
