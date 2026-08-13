import { useEffect } from 'react';
import { usePush } from '../stores/pushStore';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Tient l'inscription push alignée sur la session.
 *
 * Rejouée à chaque ouverture de session parce qu'un jeton d'appareil n'est pas
 * acquis une fois pour toutes : Apple et Google le font tourner, et une
 * réinstallation ou une restauration de sauvegarde en délivre un nouveau. Sans
 * cette resynchronisation, le serveur pousserait vers un jeton mort — qu'il
 * finirait par délier, laissant l'appareil définitivement muet.
 *
 * Silencieuse par construction : elle ne demande jamais la permission. Si elle
 * n'a pas été accordée, il ne se passe rien, et c'est la personne qui décide de
 * revenir dessus depuis les réglages.
 */
export function useInscriptionPush(): void {
  const etat = useSessionServeur((e) => e.etat);
  const partenaireId = useSessionServeur((e) => e.partenaireId);

  useEffect(() => {
    if (etat !== 'connecte' || !partenaireId) return;
    void usePush.getState().synchroniser();
    // Le partenaire fait partie des dépendances : sur un appareil partagé, une
    // autre personne qui se connecte doit inscrire l'appareil à son nom, sinon
    // elle recevrait les notifications de la précédente.
  }, [etat, partenaireId]);
}
