/**
 * Configuration Babel.
 *
 * Le projet n'en avait aucune, et cela a tenu tant qu'aucune bibliothèque
 * n'exigeait de transformation propre. L'arrivée de `react-native-reanimated`
 * — amené par le contrôleur de clavier — a changé la donne : sa version 4
 * repose sur des « worklets », des fonctions extraites vers un second fil
 * d'exécution. Cette extraction est faite par un greffon Babel. Sans lui, le
 * code se compile sans erreur et **plante à l'exécution**, ce qui est le pire
 * des deux mondes : rien ne prévient à la construction.
 *
 * Le greffon doit rester **en dernier** dans la liste : il travaille sur le
 * résultat des autres transformations, et une transformation appliquée après
 * lui casserait les fonctions qu'il vient d'extraire.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
