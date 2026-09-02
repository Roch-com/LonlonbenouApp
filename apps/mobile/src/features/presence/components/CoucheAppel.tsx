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
 * ## Les clés se chargent ici, pas ailleurs
 *
 * La négociation est scellée avec la clé du couple. Une première version
 * attendait que `useChat` la fournisse — mais ce store ne la charge qu'à
 * l'ouverture de la conversation. Résultat : tant qu'on n'était pas passé par
 * le chat depuis le démarrage, le canal ne s'ouvrait jamais et **aucun appel
 * n'aboutissait**, sans que rien à l'écran ne l'explique.
 *
 * Cette couche réclame donc les clés elle-même. `preparerLesCles` republie la
 * clé publique de l'appareil, ce qui est sans effet si elle n'a pas changé et
 * répare le cas où la première publication avait échoué.
 */
export function CoucheAppel() {
  const jeton = useSessionServeur((e) => e.jetonAcces);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const clePubliqueAutre = useChat((e) => e.cles?.autre);
  const preparerLesCles = useChat((e) => e.preparerLesCles);

  const appel = useAppels((e) => e.appel);
  const brancher = useAppels((e) => e.brancher);
  const debrancher = useAppels((e) => e.debrancher);

  // Les clés d'abord, sans attendre que la conversation soit ouverte.
  useEffect(() => {
    if (!coupleId || clePubliqueAutre) return;
    void preparerLesCles(coupleId);
  }, [coupleId, clePubliqueAutre, preparerLesCles]);

  useEffect(() => {
    if (!jeton || !coupleId || !clePubliqueAutre) return;
    brancher(jeton, coupleId, clePubliqueAutre);
    return () => debrancher();
  }, [jeton, coupleId, clePubliqueAutre, brancher, debrancher]);

  if (!appel) return null;
  return <AppelEcran />;
}
