/**
 * Sérialise les appels concurrents à une opération : tant qu'un appel est en
 * cours, les suivants attendent son résultat au lieu d'en lancer un autre.
 *
 * C'est indispensable au rafraîchissement de jeton. Si dix requêtes se
 * prennent un 401 en même temps et déclenchent dix rotations, le serveur voit
 * un jeton de rafraîchissement déjà tourné être rejoué — il en conclut à un
 * vol, révoque toute la famille, et l'utilisateur se retrouve déconnecté par
 * son propre client.
 *
 * Isolé dans son propre module pour être testable sans embarquer les
 * dépendances natives du client HTTP.
 */
export function volUnique<T>(operation: () => Promise<T>): () => Promise<T> {
  let enCours: Promise<T> | undefined;

  return () => {
    // Le vol suivant ne repart qu'une fois celui-ci terminé, succès ou échec.
    enCours ??= operation().finally(() => {
      enCours = undefined;
    });
    return enCours;
  };
}
