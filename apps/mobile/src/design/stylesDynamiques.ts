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
 * La fabrique est conservée telle quelle et la feuille construite à la
 * demande, contre le thème courant, puis mémorisée par mode. L'objet rendu
 * expose un accesseur par clé, qui résout à la lecture.
 *
 * Une première version employait un `Proxy`. Elle marchait, jusqu'à ce qu'elle
 * ne marche plus : les règles d'invariance d'un `Proxy` sont strictes — une
 * clé rapportée par `ownKeys` sans exister sur la cible, un descripteur non
 * configurable, un `Object.freeze` appliqué par React Native en développement —
 * et leur violation lève une `TypeError` à l'exécution, loin de sa cause. Des
 * accesseurs ordinaires n'ont aucune de ces contraintes et font le même
 * travail.
 *
 * ## Ce que cela suppose
 *
 * Que l'arbre soit remonté au changement de thème — c'est le rôle de la clé
 * posée par `FournisseurTheme`. Sans elle, un composant qui ne consomme pas ce
 * contexte garderait ses anciennes couleurs jusqu'à son prochain rendu.
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

  // Les clés sont les mêmes quel que soit le thème : une seule résolution
  // suffit à les connaître, et elle sert aussi de cache pour le mode courant.
  const expose = {} as T;
  for (const cle of Object.keys(resoudre()) as (keyof T)[]) {
    Object.defineProperty(expose, cle, {
      enumerable: true,
      configurable: true,
      get: () => resoudre()[cle],
    });
  }

  return expose;
}
