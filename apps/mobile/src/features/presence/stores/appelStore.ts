/**
 * L'état d'un appel, côté téléphone.
 *
 * ## Rien n'est persisté
 *
 * Un appel dure quelques minutes et n'a aucun sens ensuite. Le garder sur
 * disque reviendrait à tenir le journal de qui appelle qui et quand, ce que
 * cette application ne fait nulle part.
 *
 * ## L'ordre de la négociation
 *
 * L'appelant ouvre son micro dès qu'il compose, mais il n'envoie son offre
 * qu'**au décrochage** : émettre avant reviendrait à établir un flux vers un
 * téléphone qui n'a pas encore répondu.
 *
 * Celui qui décroche ouvre son micro à ce moment-là seulement. Tant que ça
 * sonne, sa caméra et son micro restent éteints — un téléphone qui capterait
 * pendant la sonnerie serait exactement l'outil que le cahier interdit.
 */
import { create } from 'zustand';
import {
  type Appel,
  type RaisonFin,
  type SorteAppel,
} from '@lonlonbenu/shared';
import type { MediaStream } from 'react-native-webrtc';
import { appeler } from '@/lib/api/client';
import { messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '../services/clesMessages';
import {
  accepterReponse,
  ajouterCandidat,
  creerOffre,
  creerReponse,
  ouvrirLiaison,
  type Liaison,
} from '../services/pairAPair';
import {
  ouvrirCharge,
  ouvrirSignalisation,
  scellerCharge,
  type MessageRecu,
  type Signalisation,
} from '../services/signalisation';

interface EtatAppels {
  appel?: Appel;
  /** Vrai quand c'est nous qui appelons. */
  jappelle: boolean;
  fluxLocal?: MediaStream;
  fluxDistant?: MediaStream;
  microCoupe: boolean;
  cameraCoupee: boolean;
  erreur?: string;

  /** Ouvre le canal de signalisation. À faire une fois, à la connexion. */
  brancher: (jeton: string, coupleId: string, clePubliqueAutre: string) => void;
  debrancher: () => void;

  appeler: (coupleId: string, sorte: SorteAppel) => Promise<boolean>;
  decrocher: (coupleId: string) => Promise<boolean>;
  raccrocher: (coupleId: string, raison?: RaisonFin) => Promise<void>;
  basculerMicro: () => void;
  basculerCamera: () => void;
  retournerLaCamera: () => void;
}

/**
 * Ce qui vit hors de l'état React.
 *
 * La liaison, le canal et la clé ne sont pas des données d'affichage : les
 * mettre dans le store déclencherait un rendu à chaque candidat réseau reçu,
 * soit des dizaines pendant les deux premières secondes d'un appel.
 */
let liaison: Liaison | undefined;
let canal: Signalisation | undefined;
let cle: Uint8Array | undefined;
let coupleCourant: string | undefined;
/** Candidats reçus avant que la liaison n'existe : rejoués ensuite. */
let candidatsEnAttente: unknown[] = [];

export const useAppels = create<EtatAppels>()((set, get) => {
  /** Ferme tout le matériel et remet l'écran au repos. */
  const nettoyer = () => {
    liaison?.raccrocher();
    liaison = undefined;
    candidatsEnAttente = [];
    set({
      appel: undefined,
      jappelle: false,
      fluxLocal: undefined,
      fluxDistant: undefined,
      microCoupe: false,
      cameraCoupee: false,
    });
  };

  /** Prépare micro, caméra et connexion, et branche l'envoi des candidats. */
  const preparer = async (appel: Appel): Promise<Liaison> => {
    const nouvelle = await ouvrirLiaison({
      video: appel.sorte === 'video',
      onCandidat: (candidat) => {
        if (!cle || !coupleCourant) return;
        canal?.envoyer({
          sorte: 'candidat',
          appelId: appel.id,
          charge: scellerCharge(cle, candidat),
          coupleId: coupleCourant,
        });
      },
      onFluxDistant: (flux) => set({ fluxDistant: flux }),
      onEchec: () => {
        void get().raccrocher(coupleCourant ?? '', 'echec_reseau');
      },
    });

    liaison = nouvelle;
    set({ fluxLocal: nouvelle.fluxLocal });

    // Les candidats arrivés pendant la préparation du matériel.
    for (const candidat of candidatsEnAttente) {
      void ajouterCandidat(nouvelle.connexion, candidat);
    }
    candidatsEnAttente = [];

    return nouvelle;
  };

  const surMessage = (message: MessageRecu) => {
    void (async () => {
      if (!cle) return;

      switch (message.sorte) {
        case 'sonne': {
          // On ne touche à rien : ni micro, ni caméra. L'écran d'appel entrant
          // s'affiche, et c'est le décrochage qui ouvrira le matériel.
          set({ appel: message.appel as Appel, jappelle: false });
          return;
        }

        case 'decroche': {
          // C'est nous qui appelions : l'autre vient de décrocher, on envoie
          // enfin l'offre.
          const appel = message.appel as Appel;
          set({ appel });
          const en = liaison ?? (await preparer(appel));
          const offre = await creerOffre(en.connexion);
          canal?.envoyer({
            sorte: 'accepte',
            appelId: appel.id,
            charge: scellerCharge(cle, offre),
            coupleId: coupleCourant ?? '',
          });
          return;
        }

        case 'fin': {
          nettoyer();
          return;
        }

        case 'accepte': {
          // Une offre nous parvient : nous sommes celui qui a décroché.
          const offre = ouvrirCharge<unknown>(cle, message.charge);
          if (!offre || !liaison) return;
          const reponse = await creerReponse(liaison.connexion, offre);
          canal?.envoyer({
            sorte: 'propose',
            appelId: message.appelId,
            appel: get().appel?.sorte ?? 'audio',
            charge: scellerCharge(cle, reponse),
            coupleId: coupleCourant ?? '',
          });
          return;
        }

        case 'propose': {
          // La réponse de celui qui a décroché.
          const reponse = ouvrirCharge<unknown>(cle, message.charge);
          if (!reponse || !liaison) return;
          await accepterReponse(liaison.connexion, reponse);
          return;
        }

        case 'candidat': {
          const candidat = ouvrirCharge<unknown>(cle, message.charge);
          if (!candidat) return;
          // Reçu avant que le matériel ne soit prêt : mis de côté.
          if (!liaison) candidatsEnAttente.push(candidat);
          else await ajouterCandidat(liaison.connexion, candidat);
          return;
        }
      }
    })();
  };

  return {
    jappelle: false,
    microCoupe: false,
    cameraCoupee: false,

    brancher(jeton, coupleId, clePubliqueAutre) {
      coupleCourant = coupleId;
      void cleDeMessages(clePubliqueAutre).then((derivee) => {
        cle = derivee;
      });
      canal?.fermer();
      canal = ouvrirSignalisation({ jeton, onMessage: surMessage });
    },

    debrancher() {
      canal?.fermer();
      canal = undefined;
      nettoyer();
    },

    async appeler(coupleId, sorte) {
      set({ erreur: undefined });
      try {
        const { appel } = await appeler<{ appel: Appel }>(
          `/couples/${coupleId}/appels`,
          { methode: 'POST', corps: { sorte } },
        );
        set({ appel, jappelle: true });
        // Le matériel s'ouvre tout de suite : on se voit avant que l'autre
        // décroche, comme partout. L'offre, elle, attend le décrochage.
        await preparer(appel);
        return true;
      } catch (erreur) {
        set({ erreur: messageLisible(erreur) });
        nettoyer();
        return false;
      }
    },

    async decrocher(coupleId) {
      const appel = get().appel;
      if (!appel) return false;
      try {
        // Le matériel d'abord : l'offre arrivera dans la foulée, et sans
        // connexion prête elle serait perdue.
        await preparer(appel);
        const reponse = await appeler<{ appel: Appel }>(
          `/couples/${coupleId}/appels/${appel.id}/accepter`,
          { methode: 'POST' },
        );
        set({ appel: reponse.appel });
        return true;
      } catch (erreur) {
        set({ erreur: messageLisible(erreur) });
        nettoyer();
        return false;
      }
    },

    async raccrocher(coupleId, raison = 'raccroche') {
      const appel = get().appel;
      nettoyer();
      if (!appel || !coupleId) return;
      try {
        await appeler(`/couples/${coupleId}/appels/${appel.id}/fin`, {
          methode: 'POST',
          corps: { raison },
        });
      } catch {
        // Le matériel est déjà coupé de notre côté. Le serveur finira par
        // clore l'appel de lui-même, et insister n'apporterait rien.
      }
    },

    basculerMicro() {
      const coupe = !get().microCoupe;
      liaison?.couperLeMicro(coupe);
      set({ microCoupe: coupe });
    },

    basculerCamera() {
      const coupee = !get().cameraCoupee;
      liaison?.couperLaCamera(coupee);
      set({ cameraCoupee: coupee });
    },

    retournerLaCamera() {
      liaison?.retournerLaCamera();
    },
  };
});
