// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/**
 * Règles du dépôt.
 *
 * Le parti pris : peu de règles, mais aucune désactivable au cas par cas sans
 * s'en expliquer. Une configuration de cent règles dont on met la moitié en
 * `warn` ne protège de rien — elle apprend seulement à ignorer la sortie.
 *
 * Les règles retenues visent trois choses qui ont réellement coûté du temps sur
 * ce projet : les promesses non attendues, les variables mortes après un
 * remaniement, et les dépendances de hooks oubliées.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Une variable préfixée d'un souligné est intentionnellement inutilisée —
      // le reste est du code mort qu'un remaniement a laissé derrière lui.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // `any` fait taire le vérificateur au lieu de résoudre le problème.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
      // Les espaces insécables et fines sont de la matière première ici : le
      // formatage des nombres en français les manipule expressément. La règle
      // reste active pour le code, pas pour les littéraux qui les portent.
      'no-irregular-whitespace': [
        'error',
        {
          skipStrings: true,
          skipTemplates: true,
          skipRegExps: true,
          skipComments: true,
        },
      ],
    },
  },

  // Les fichiers de configuration en CommonJS : Metro n'accepte pas d'ESM ici.
  {
    files: ['**/*.config.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        // `app.config.js` lit la clé Google Maps dans l'environnement de build.
        process: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Le mobile : les hooks d'abord. Une dépendance oubliée produit un état figé
  // qui ne se voit qu'à l'usage, jamais en relisant le code.
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // Les ressources locales (images, polices) passent obligatoirement par
  // `require` : c'est Metro qui les résout à la compilation, et un `import`
  // ne lui donnerait pas le chemin.
  {
    files: ['apps/mobile/**/*.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Les tests décrivent aussi des cas absurdes : on les laisse s'exprimer.
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/api/scripts/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // En dernier : neutralise les règles de style que Prettier tranche déjà.
  prettier,
);
