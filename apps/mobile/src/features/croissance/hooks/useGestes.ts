/**
 * Rassemble les gestes observables du couple à partir de ce que les autres
 * modules ont déjà enregistré. Rien n'est journalisé en plus pour le score :
 * on ne mesure que des actions qui existaient déjà, et jamais leur contenu.
 *
 * Depuis la bascule serveur, le score se calcule sur ce que **cet appareil**
 * peut voir. Les messages sont comptés à partir des enveloppes reçues : leur
 * existence et leur date suffisent, et c'est heureux — le serveur n'en connaît
 * pas davantage.
 *
 * Deux exclusions volontaires :
 *   - les brouillons de lettres, qui sont privés — les compter ferait fuiter
 *     leur existence par le score ;
 *   - tout ce qui n'est pas daté.
 */
import { useMemo } from 'react';
import type { Geste } from '@lonlonbenu/shared';
import { useChat } from '@/features/presence/stores/chatStore';
import { usePresence } from '@/features/presence/stores/presenceStore';
import { useFilLisible } from '@/features/presence/hooks/useLecturesDechiffrees';
import { useAxes } from '../stores/axesStore';
import { useConfidences } from '../stores/confidencesStore';

export function useGestes(): Geste[] {
  const fil = useFilLisible();
  const vuePresence = usePresence((e) => e.vue);
  const confidences = useConfidences((e) => e.confidences);
  const axes = useAxes((e) => e.axes);
  const messagesBruts = useChat((e) => e.messages);

  return useMemo(() => {
    const gestes: Geste[] = [];

    for (const m of fil) {
      gestes.push({
        auteurId: m.auteurId,
        type: m.type === 'note_douce' ? 'note_douce' : 'message',
        faitLe: m.envoyeLe,
      });
    }

    const statuts = [vuePresence?.mien, vuePresence?.autre].filter(
      (s): s is NonNullable<typeof s> => !!s,
    );
    for (const s of statuts) {
      gestes.push({ auteurId: s.partenaireId, type: 'statut', faitLe: s.majLe });
      if (s.humeurCode) {
        gestes.push({
          auteurId: s.partenaireId,
          type: 'humeur',
          faitLe: s.humeurMajLe ?? s.majLe,
        });
      }
    }

    for (const c of vuePresence?.checkIns ?? []) {
      gestes.push({ auteurId: c.partenaireId, type: 'check_in', faitLe: c.faitLe });
    }

    for (const c of confidences) {
      // Un brouillon n'est pas un geste : il n'a été offert à personne. Il
      // n'atteint d'ailleurs jamais le serveur, donc jamais cette liste.
      if (!c.envoyeeLe) continue;
      gestes.push({
        auteurId: c.auteurId,
        type: c.type === 'gratitude' ? 'gratitude' : 'lettre',
        faitLe: c.envoyeeLe,
      });
    }

    for (const axe of axes) {
      gestes.push({
        auteurId: axe.ouvertPar,
        type: 'axe_ouvert',
        faitLe: axe.ouvertLe,
      });
      for (const contribution of axe.contributions) {
        gestes.push({
          auteurId: contribution.partenaireId,
          type: 'axe_contribution',
          faitLe: contribution.majLe,
        });
      }
    }

    return gestes;
    // `messagesBruts` participe pour que le calcul reparte quand le fil change
    // sans que son déchiffrement ait encore abouti.
  }, [fil, messagesBruts, vuePresence, confidences, axes]);
}
