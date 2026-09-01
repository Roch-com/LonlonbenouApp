/**
 * Pôle ① — Chat du couple. **Serveur pour le routage, appareil pour le sens.**
 *
 * Le serveur fait autorité sur l'existence et l'ordre des messages ; il ne fait
 * autorité sur aucun contenu, parce qu'il n'en a jamais vu. Le déchiffrement a
 * lieu ici, avec une clé dérivée d'un échange X25519 dont la moitié privée n'a
 * jamais quitté le trousseau.
 *
 * Le cache persisté ne contient que des **enveloppes scellées**, telles que le
 * serveur les a rendues. Le clair n'est reconstitué qu'en mémoire, à
 * l'affichage : même si le stockage local était lu, il ne livrerait rien de
 * plus que ce que le serveur possède déjà.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  empreinteDeVerification,
  LONGUEUR_NONCE,
  scellerMessage,
  type TypeMessage,
} from '@lonlonbenu/shared';
import * as Crypto from 'expo-crypto';
import { stockage } from '@/lib/stockage';
import { ErreurApi, messageLisible } from '@/lib/api/erreurs';
import {
  envoyerEnveloppe,
  epinglerServeur,
  lireCles,
  lireEpingleServeur,
  listerMessages,
  marquerLusServeur,
  publierClePublique,
  reagirServeur,
  retirerMessageServeur,
  type ClesDuCouple,
  type EpingleServeur,
  type MessageScelle,
} from '../api/chat.api';
import { cleDeMessages, paireDeLAppareil } from '../services/clesMessages';

interface EtatChat {
  /** Cache : enveloppes scellées, jamais de clair. */
  messages: MessageScelle[];
  epingle?: EpingleServeur;
  cles?: ClesDuCouple;
  cachePour?: string;
  synchroniseeLe?: string;

  chargement: boolean;
  horsLigne: boolean;
  erreur?: string;

  preparerLesCles: (coupleId: string) => Promise<void>;
  charger: (coupleId: string, moiId: string) => Promise<void>;
  envoyer: (
    coupleId: string,
    moiId: string,
    texte: string,
    type?: TypeMessage,
    /** Identifiant du message auquel on répond, s'il y en a un. */
    repondA?: string,
  ) => Promise<boolean>;
  marquerLus: (coupleId: string) => Promise<void>;
  /** Retire un message pour les deux. Seul son auteur le peut. */
  retirer: (coupleId: string, id: string) => Promise<boolean>;
  /** Pose, remplace ou retire sa réaction. `undefined` retire. */
  reagir: (coupleId: string, id: string, emoji?: string) => Promise<boolean>;
  /** Épingle un message, ou décroche l'épingle sans identifiant. */
  epingler: (coupleId: string, messageId?: string) => Promise<boolean>;
  vider: () => void;
}

export const useChat = create<EtatChat>()(
  persist(
    (set, get) => {
      /** Remplace un message dans le cache, sans tout relire. */
      const remplacer = (message: MessageScelle) =>
        set((e) => ({
          messages: e.messages.map((m) => (m.id === message.id ? message : m)),
        }));

      const relire = async (coupleId: string, moiId: string) => {
        // L'épingle vient avec : elle désigne un message de la liste, et les
        // charger séparément ferait clignoter le bandeau à chaque ouverture.
        const [messages, epingle] = await Promise.all([
          listerMessages(coupleId),
          lireEpingleServeur(coupleId).catch(() => undefined),
        ]);
        set({
          messages,
          epingle,
          cachePour: moiId,
          synchroniseeLe: new Date().toISOString(),
          horsLigne: false,
          erreur: undefined,
        });
      };

      return {
        messages: [],
        chargement: false,
        horsLigne: false,

        async preparerLesCles(coupleId) {
          try {
            const paire = await paireDeLAppareil();
            // Republier est sans effet si la clé n'a pas changé, et répare le
            // cas où la première publication avait échoué.
            set({ cles: await publierClePublique(coupleId, paire.clePublique) });
          } catch (erreur) {
            if (!(erreur instanceof ErreurApi && erreur.genre === 'hors_ligne')) {
              set({ erreur: messageLisible(erreur) });
            }
          }
        },

        async charger(coupleId, moiId) {
          if (get().cachePour && get().cachePour !== moiId) {
            set({ messages: [], cachePour: moiId, synchroniseeLe: undefined });
          }

          set({ chargement: true, erreur: undefined });
          try {
            set({ cles: await lireCles(coupleId) });
            await relire(coupleId, moiId);
          } catch (erreur) {
            if (erreur instanceof ErreurApi && erreur.genre === 'hors_ligne') {
              set({ horsLigne: true });
            } else {
              set({ erreur: messageLisible(erreur), messages: [] });
            }
          } finally {
            set({ chargement: false });
          }
        },

        async envoyer(coupleId, moiId, texte, type = 'texte', repondA) {
          const propre = texte.trim();
          if (!propre) return false;

          const cles = get().cles;
          if (!cles?.autre) {
            set({
              erreur:
                'Votre partenaire n’a pas encore ouvert la conversation sur son appareil. Sans sa clé, rien ne peut être chiffré pour lui.',
            });
            return false;
          }

          set({ erreur: undefined });
          try {
            const cle = await cleDeMessages(cles.autre);
            const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
            // Le type et la référence de réponse entrent dans l'enveloppe : le
            // serveur n'a pas à savoir si c'est une note douce, ni quel
            // message répond à quel autre. Cette dernière information paraît
            // anodine — un simple identifiant — mais elle dessine la
            // structure de la conversation, qui se lit sans le texte.
            const charge = JSON.stringify({ type, texte: propre, repondA });
            // Le clair ne sort jamais d'ici : c'est l'enveloppe qui part.
            await envoyerEnveloppe(coupleId, scellerMessage(cle, nonce, charge));
            await relire(coupleId, moiId);
            return true;
          } catch (erreur) {
            set({
              erreur:
                erreur instanceof ErreurApi && erreur.genre === 'hors_ligne'
                  ? 'Sans connexion, le message ne peut pas partir. Il est resté dans le champ.'
                  : messageLisible(erreur),
            });
            return false;
          }
        },

        async marquerLus(coupleId) {
          try {
            await marquerLusServeur(coupleId);
          } catch {
            // Repartira à la prochaine ouverture.
          }
        },

        async retirer(coupleId, id) {
          try {
            remplacer(await retirerMessageServeur(coupleId, id));
            // Retirer un message épinglé décroche l'épingle côté serveur : on
            // suit, sinon le bandeau resterait sur un message qui n'est plus.
            if (get().epingle?.messageId === id) set({ epingle: undefined });
            return true;
          } catch (erreur) {
            set({ erreur: messageLisible(erreur) });
            return false;
          }
        },

        async reagir(coupleId, id, emoji) {
          try {
            if (emoji === undefined) {
              remplacer(await reagirServeur(coupleId, id));
              return true;
            }
            // Même clé que les messages : une réaction est du texte écrit
            // dans la conversation, elle se scelle comme le reste.
            const autre = get().cles?.autre;
            if (!autre) {
              set({
                erreur:
                  'Votre partenaire n’a pas encore ouvert la conversation sur son appareil. Sans sa clé, rien ne peut être chiffré pour lui.',
              });
              return false;
            }
            const cle = await cleDeMessages(autre);
            const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
            remplacer(
              await reagirServeur(coupleId, id, scellerMessage(cle, nonce, emoji)),
            );
            return true;
          } catch (erreur) {
            set({ erreur: messageLisible(erreur) });
            return false;
          }
        },

        async epingler(coupleId, messageId) {
          try {
            set({ epingle: await epinglerServeur(coupleId, messageId) });
            return true;
          } catch (erreur) {
            set({ erreur: messageLisible(erreur) });
            return false;
          }
        },

        vider: () =>
          set({
            messages: [],
            epingle: undefined,
            cles: undefined,
            cachePour: undefined,
            synchroniseeLe: undefined,
            horsLigne: false,
            erreur: undefined,
          }),
      };
    },
    {
      name: 'lonlonbenu.chat',
      storage: stockage,
      partialize: (e) => ({
        messages: e.messages,
        epingle: e.epingle,
        cles: e.cles,
        cachePour: e.cachePour,
        synchroniseeLe: e.synchroniseeLe,
      }),
    },
  ),
);

/**
 * Nombre de vérification, à comparer de vive voix.
 * C'est la seule parade contre un serveur qui substituerait une clé publique.
 */
export function useNombreDeVerification(): string | undefined {
  const cles = useChat((e) => e.cles);
  if (!cles?.mienne || !cles.autre) return undefined;
  return empreinteDeVerification(cles.mienne, cles.autre);
}

export function useMessagesNonLus(moiId: string): number {
  return useChat(
    (e) => e.messages.filter((m) => m.auteurId !== moiId && !m.luLe).length,
  );
}
