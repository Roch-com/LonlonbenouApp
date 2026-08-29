/**
 * Le cas qui bloquait l'app : l'hydratation se termine pendant qu'on s'abonne.
 */
import { describe, expect, it, vi } from 'vitest';
import { suivreHydratation, type StorePersiste } from './useHydratation';

/**
 * Store factice. `finirPendantAbonnement` reproduit la course : l'hydratation
 * s'achève à l'intérieur même de `onFinishHydration`, donc après que
 * l'appelant a constaté qu'elle courait encore, et avant que l'auditeur ne
 * soit en place.
 */
function storeFactice(options?: { finirPendantAbonnement?: boolean }) {
  let hydrate = false;
  const auditeurs: (() => void)[] = [];

  const store: StorePersiste = {
    persist: {
      hasHydrated: () => hydrate,
      onFinishHydration: (auditeur) => {
        if (options?.finirPendantAbonnement) hydrate = true;
        auditeurs.push(auditeur);
        return () => {
          auditeurs.splice(auditeurs.indexOf(auditeur), 1);
        };
      },
    },
  };

  return {
    store,
    /** Fin d'hydratation normale, après l'abonnement. */
    terminer() {
      hydrate = true;
      for (const auditeur of [...auditeurs]) auditeur();
    },
    auditeurs,
  };
}

describe('suivreHydratation', () => {
  it('rattrape une hydratation terminée pendant l’abonnement', () => {
    // Sans la relecture, personne n'appelle plus jamais `quandPret` : c'est
    // exactement l'écran vide à l'indicateur qui tourne sans fin.
    const { store } = storeFactice({ finirPendantAbonnement: true });
    const quandPret = vi.fn();

    suivreHydratation(store, quandPret);

    expect(quandPret).toHaveBeenCalled();
  });

  it('reçoit l’hydratation qui se termine après l’abonnement', () => {
    const { store, terminer } = storeFactice();
    const quandPret = vi.fn();

    suivreHydratation(store, quandPret);
    expect(quandPret).not.toHaveBeenCalled();

    terminer();
    expect(quandPret).toHaveBeenCalledTimes(1);
  });

  it('se désabonne pour de bon', () => {
    const { store, terminer, auditeurs } = storeFactice();
    const quandPret = vi.fn();

    suivreHydratation(store, quandPret)();
    expect(auditeurs).toHaveLength(0);

    terminer();
    expect(quandPret).not.toHaveBeenCalled();
  });
});
