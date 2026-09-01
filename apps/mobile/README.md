# Application mobile

Expo SDK 57, expo-router, monorepo npm workspaces.

## Deux réglages qui ont une raison d'être

### `react-native-reanimated` est exclu du contrôle de version d'Expo

`expo-doctor` attend `4.5.1`, la version recommandée pour le SDK 57. La plage
déclarée ici est `~4.5.1`, ce qui laisse npm résoudre `4.5.5`.

Ce n'est pas un oubli. `expo-router` et `react-native-keyboard-controller`
exigent `react-native-reanimated` sans contrainte de version : npm hisse alors
la dernière `4.5.x` à la racine du monorepo. Épingler `4.5.1` exactement dans
ce paquet force une **seconde copie imbriquée**, et deux versions d'un même
module natif dans un binaire produisent des erreurs de build ou des
comportements inexplicables à l'exécution.

Entre un avertissement de `expo-doctor` sur un écart de correctif et un module
natif en double, le second est nettement plus dangereux. D'où l'exclusion, qui
rend le contrôle silencieux sur ce point précis plutôt que de le laisser
signaler un choix délibéré.

Après toute modification des dépendances : `npm dedupe`, puis vérifier qu'il
n'existe qu'un seul `node_modules/react-native-reanimated`.

### La version d'exécution suit `expo.version`

`runtimeVersion: { policy: 'appVersion' }`. **Monter `expo.version` dès qu'une
dépendance native change** — sans quoi une mise à jour OTA pourrait atterrir
sur un binaire qui ne l'attend pas.

La politique `fingerprint` a été essayée : plus automatique, mais elle exige
que la machine locale et EAS calculent le même hachage du projet, ce qu'un
`app.config.js` conditionnel suffit à casser. Le build échoue alors à
« Configure expo-updates », et aucune vérification locale ne le voit venir.
