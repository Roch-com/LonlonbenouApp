/**
 * Ouverture des enveloppes, pour l'affichage seulement.
 *
 * Le clair n'existe que dans le retour de ces hooks, en mémoire, le temps du
 * rendu. Ni le cache local, ni le serveur n'en détiennent de copie.
 */
import { useEffect, useMemo, useState } from 'react';
import { ouvrirMessage, type TypeMessage } from '@lonlonbenu/shared';
import { cleDeMessages } from '../services/clesMessages';
import { useChat } from '../stores/chatStore';
import { usePresence } from '../stores/presenceStore';

/** Charge la clé du couple une fois, puis la garde en mémoire. */
function useCleDuCouple(): Uint8Array | undefined {
  const clePubliqueAutre = useChat((e) => e.cles?.autre);
  const [cle, setCle] = useState<Uint8Array>();

  useEffect(() => {
    let annule = false;
    if (!clePubliqueAutre) {
      setCle(undefined);
      return;
    }
    void cleDeMessages(clePubliqueAutre).then((derivee) => {
      if (!annule) setCle(derivee);
    });
    return () => {
      annule = true;
    };
  }, [clePubliqueAutre]);

  return cle;
}

/** Ouvre un texte scellé, ou rend `undefined` : jamais de chiffré à l'écran. */
function ouvrir(cle: Uint8Array | undefined, scelle?: string): string | undefined {
  if (!cle || !scelle) return undefined;
  try {
    return ouvrirMessage(cle, scelle);
  } catch {
    return undefined;
  }
}

export interface ReactionLisible {
  partenaireId: string;
  emoji: string;
}

export interface MessageLisible {
  id: string;
  auteurId: string;
  type: TypeMessage;
  texte: string;
  envoyeLe: string;
  luLe?: string;
  /** Message auquel celui-ci répond. Vient du chiffré, jamais du serveur. */
  repondA?: string;
  /** L'enveloppe n'a pas pu être ouverte avec la clé courante. */
  illisible: boolean;
  /** Retiré par son auteur : il n'y a plus de texte, seulement la trace. */
  retire: boolean;
  reactions: readonly ReactionLisible[];
  /**
   * Note vocale, encore scellée.
   *
   * Elle n'est pas déchiffrée ici : ouvrir chaque audio du fil écrirait sur le
   * disque autant de fichiers qu'il y a de notes, y compris celles qu'on ne va
   * pas écouter. C'est le lecteur qui l'ouvre, au moment où on appuie.
   */
  vocal?: { audioScelle: string; dureeS: number };
}

export function useFilLisible(): MessageLisible[] {
  const messages = useChat((e) => e.messages);
  const cle = useCleDuCouple();

  return useMemo(
    () =>
      messages.map((m) => {
        // Un message retiré n'a plus d'enveloppe à ouvrir : essayer
        // produirait un « illisible », qui se lit comme une panne de clé
        // alors que rien n'est cassé.
        if (m.retireLe) {
          return {
            id: m.id,
            auteurId: m.auteurId,
            type: 'texte' as TypeMessage,
            texte: '',
            envoyeLe: m.envoyeLe,
            luLe: m.luLe,
            illisible: false,
            retire: true,
            reactions: [],
          };
        }

        const clair = ouvrir(cle, m.enveloppe);
        let type: TypeMessage = 'texte';
        let texte = clair ?? '';
        let repondA: string | undefined;

        if (clair) {
          try {
            const charge = JSON.parse(clair) as {
              type?: TypeMessage;
              texte?: string;
              repondA?: string;
            };
            if (charge?.texte !== undefined) {
              type = charge.type ?? 'texte';
              texte = charge.texte;
              repondA = charge.repondA;
            }
          } catch {
            // Message d'une version antérieure : le clair est le texte.
          }
        }

        return {
          id: m.id,
          auteurId: m.auteurId,
          type,
          texte,
          envoyeLe: m.envoyeLe,
          luLe: m.luLe,
          repondA,
          illisible: clair === undefined,
          retire: false,
          ...(m.vocal ? { vocal: m.vocal } : {}),
          // Une réaction qu'on ne sait plus ouvrir est écartée : afficher un
          // carré vide à côté d'un message n'apprend rien à personne.
          reactions: (m.reactions ?? []).flatMap((r) => {
            const emoji = ouvrir(cle, r.emojiScelle);
            return emoji ? [{ partenaireId: r.partenaireId, emoji }] : [];
          }),
        };
      }),
    [messages, cle],
  );
}

export interface PresenceLisible {
  partageActif: boolean;
  mien?: { code: string; note?: string; majLe: string };
  autre?: { code: string; note?: string; majLe: string };
  monHumeur?: { code: string; mot?: string; majLe: string };
  humeurDeLautre?: { code: string; mot?: string; majLe: string };
  checkIns: {
    id: string;
    partenaireId: string;
    lieu: string;
    mot?: string;
    faitLe: string;
  }[];
  alertes: {
    id: string;
    partenaireId: string;
    lieu?: string;
    message?: string;
    etat: 'actif' | 'resolu';
    emiseLe: string;
    vueLe?: string;
  }[];
}

export function usePresenceLisible(): PresenceLisible {
  const vue = usePresence((e) => e.vue);
  const cle = useCleDuCouple();

  return useMemo(() => {
    const statut = (
      s: typeof vue extends undefined ? never : NonNullable<typeof vue>['mien'],
    ) =>
      s
        ? { code: s.code, note: ouvrir(cle, s.noteScellee), majLe: s.majLe }
        : undefined;
    const humeur = (s: NonNullable<typeof vue>['mien']) =>
      s?.humeurCode
        ? {
            code: s.humeurCode,
            mot: ouvrir(cle, s.motHumeurScelle),
            majLe: s.humeurMajLe ?? s.majLe,
          }
        : undefined;

    return {
      partageActif: vue?.partageActif ?? false,
      mien: statut(vue?.mien),
      autre: statut(vue?.autre),
      monHumeur: humeur(vue?.mien),
      humeurDeLautre: humeur(vue?.autre),
      checkIns: (vue?.checkIns ?? []).map((c) => ({
        id: c.id,
        partenaireId: c.partenaireId,
        lieu: ouvrir(cle, c.lieuScelle) ?? '—',
        mot: ouvrir(cle, c.motScelle),
        faitLe: c.faitLe,
      })),
      alertes: (vue?.alertes ?? []).map((a) => ({
        id: a.id,
        partenaireId: a.partenaireId,
        lieu: ouvrir(cle, a.lieuScelle),
        message: ouvrir(cle, a.messageScelle),
        etat: a.etat,
        emiseLe: a.emiseLe,
        vueLe: a.vueLe,
      })),
    };
  }, [vue, cle]);
}
