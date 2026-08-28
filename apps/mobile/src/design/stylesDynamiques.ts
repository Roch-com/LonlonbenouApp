import { StyleSheet } from 'react-native';
import { themeClair, type Theme } from '@lonlonbenu/shared';

/**
 * Feuille de styles qui suit le thème, sans modifier le corps des composants.
 *
 * ## Le problème
 *
 * `StyleSheet.create` s'exécute au chargement du module et fige les couleurs
 * qu'il contient. Une feuille écrite ainsi ne changera jamais de thème. La
 * réponse habituelle — un hook appelé dans chaque composant — imposait de
 * remanier quarante-six fichiers, chacun offrant une occasion de casser
 * quelque chose sans que rien ne le signale.
 *
 * ## Ce qui est fait à la place
 *
 * La fabrique est conservée telle quelle et la feuille n'est construite qu'au
 * premier accès, contre le thème courant, puis mémorisée par mode. L'objet
 * rendu est un mandataire : `styles.carte` déclenche la construction si elle
 * n'a pas eu lieu, et rend ensuite la valeur en cache.
 *
 * ## Ce que cela suppose
 *
 * Que l'arbre soit remonté au changement de thème — c'est le rôle de la clé
 * posée par `FournisseurTheme`. Sans elle, un composant qui ne consomme pas le
 * contexte garderait ses anciennes couleurs jusqu'à son prochain rendu. Le
 * changement de thème étant un geste rare et délibéré, une remontée complète
 * est un prix négligeable pour quarante-six fichiers laissés intacts.
 */
let themeCourant: Theme = themeClair;

export function appliquerLeTheme(theme: Theme): void {
  themeCourant = theme;
}

export function themeActif(): Theme {
  return themeCourant;
}

export function stylesDynamiques<T extends StyleSheet.NamedStyles<T>>(
  fabrique: (theme: Theme) => T,
): T {
  const cache = new Map<string, T>();

  const resoudre = (): T => {
    const existante = cache.get(themeCourant.mode);
    if (existante) return existante;
    const construite = StyleSheet.create(fabrique(themeCourant));
    cache.set(themeCourant.mode, construite);
    return construite;
  };

  return new Proxy({} as T, {
    get: (_cible, propriete) => resoudre()[propriete as keyof T],
    has: (_cible, propriete) => propriete in resoudre(),
    ownKeys: () => Reflect.ownKeys(resoudre()),
    getOwnPropertyDescriptor: (_cible, propriete) =>
      Object.getOwnPropertyDescriptor(resoudre(), propriete),
  });
}
