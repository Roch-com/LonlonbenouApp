import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { reveillerLeServeur } from '@/lib/api/client';
import { useSessionServeur } from '../stores/sessionServeurStore';
import { useAppels } from '@/features/presence/stores/appelStore';

/**
 * Ce qu'il faut faire quand l'application revient au premier plan.
 *
 * ## Le problème que ça résout
 *
 * Le serveur s'endort après un quart d'heure sans requête, et la première
 * requête ensuite paie la trentaine de secondes de son démarrage. Comme
 * l'application n'agissait qu'au moment où l'on touchait quelque chose,
 * cette attente tombait toujours au pire moment : on ouvrait la conversation,
 * et rien ne venait.
 *
 * On sonne donc **dès le retour à l'écran**, avant que quoi que ce soit ne
 * soit demandé. Le démarrage du serveur court pendant qu'on regarde
 * l'accueil, et la conversation s'ouvre sur un serveur déjà debout.
 *
 * ## Et la session
 *
 * Le jeton d'accès n'est jamais persisté : il se regagne au démarrage. Après
 * plusieurs heures en arrière-plan il a expiré, et la première requête
 * échouait avant de se rejouer. On le renouvelle ici, à froid, plutôt que de
 * le découvrir au premier geste.
 */
export function useRepriseAuPremierPlan(): void {
  /** Dernier réveil, pour ne pas sonner à chaque bascule d'écran. */
  const dernierReveil = useRef(0);

  useEffect(() => {
    const reprendre = () => {
      const maintenant = Date.now();
      // Passer d'un écran à l'autre fait osciller `AppState` sur certains
      // téléphones : sans ce garde, on sonnerait plusieurs fois par minute.
      if (maintenant - dernierReveil.current < DELAI_ENTRE_REVEILS_MS) return;
      dernierReveil.current = maintenant;

      reveillerLeServeur();
      void useSessionServeur.getState().restaurer();
      // Et le canal des appels : sans lui, rien ne sonne, et rien à l'écran ne
      // dit pourquoi.
      useAppels.getState().reveillerLeCanal();
    };

    // Au montage aussi : l'ouverture depuis zéro est le cas le plus fréquent,
    // et c'est celui où le serveur a le plus de chances de dormir.
    reprendre();

    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') reprendre();
    });
    return () => abonnement.remove();
  }, []);
}

/**
 * Deux minutes entre deux réveils.
 *
 * Assez court pour qu'un retour après une pause déjeuner sonne, assez long
 * pour qu'un aller-retour vers l'appareil photo ne sonne pas.
 */
const DELAI_ENTRE_REVEILS_MS = 120_000;
