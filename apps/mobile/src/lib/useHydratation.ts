import { useEffect, useState } from 'react';

/** La part de l'API `persist` de zustand dont dépend ce module. */
export interface StorePersiste {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (auditeur: () => void) => () => void;
  };
}

/**
 * S'abonne à la fin d'hydratation **sans perdre l'événement déjà survenu**.
 *
 * S'abonner seul comporte une course : l'hydratation peut se terminer entre le
 * moment où on constate qu'elle est en cours et celui où on s'abonne.
 * `onFinishHydration` ne rejoue pas un événement passé, si bien que plus
 * personne ne vient jamais lever l'attente — et un écran de chargement tourne
 * indéfiniment.
 *
 * La relecture qui suit l'abonnement ferme la fenêtre : à partir de là, ou
 * bien l'auditeur recevra l'événement, ou bien il a déjà eu lieu et on le
 * voit. Une seule des deux branches peut manquer, jamais les deux.
 *
 * Hors de React pour être vérifiable : c'est l'ordre des deux appels qui fait
 * la correction, et c'est cet ordre que le test fixe.
 */
export function suivreHydratation(
  store: StorePersiste,
  quandPret: () => void,
): () => void {
  const desabonner = store.persist.onFinishHydration(quandPret);
  // Rattrape l'hydratation terminée pendant qu'on s'abonnait.
  if (store.persist.hasHydrated()) quandPret();
  return desabonner;
}

/** Vrai une fois le store relu depuis le disque. */
export function useHydratation(store: StorePersiste): boolean {
  const [pret, setPret] = useState(() => store.persist.hasHydrated());

  useEffect(() => {
    if (pret) return;
    return suivreHydratation(store, () => setPret(true));
  }, [pret, store]);

  return pret;
}
