import { useEffect } from 'react';
import { useAppels } from '../stores/appelStore';
import { useChat } from '../stores/chatStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { AppelEcran } from '../screens/AppelEcran';

/**
 * Tient le canal de signalisation ouvert et pose l'écran d'appel par-dessus
 * tout le reste.
 *
 * ## Pourquoi à la racine
 *
 * Un appel entrant doit s'afficher quel que soit l'écran où l'on se trouve.
 * Brancher le canal dans la conversation ne ferait sonner que si elle est
 * ouverte, ce qui n'est jamais le cas au moment où l'on est appelé.
 *
 * ## Sans clé, pas de canal
 *
 * La négociation est scellée avec la clé du couple. Tant que les deux n'ont
 * pas publié leur clé publique, il n'y aurait rien pour la sceller : on
 * n'ouvre pas le canal, et les boutons d'appel restent sans effet plutôt que
 * de lancer un appel qui n'aboutirait jamais.
 */
export function CoucheAppel() {
  const jeton = useSessionServeur((e) => e.jetonAcces);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const clePubliqueAutre = useChat((e) => e.cles?.autre);

  const appel = useAppels((e) => e.appel);
  const brancher = useAppels((e) => e.brancher);
  const debrancher = useAppels((e) => e.debrancher);

  useEffect(() => {
    if (!jeton || !coupleId || !clePubliqueAutre) return;
    brancher(jeton, coupleId, clePubliqueAutre);
    return () => debrancher();
  }, [jeton, coupleId, clePubliqueAutre, brancher, debrancher]);

  if (!appel) return null;
  return <AppelEcran />;
}
