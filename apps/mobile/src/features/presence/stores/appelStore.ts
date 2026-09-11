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
import { dureeLisible, lectureAppel } from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';
import { useChat } from './chatStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '../services/clesMessages';
import {
  accepterReponse,
  ajouterCandidat,
  creerOffre,
  creerReponse,
  ouvrirLiaison,
  PermissionRefusee,
  router,
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
  /** Son au haut-parleur plutôt qu'à l'écouteur. */
  hautParleur: boolean;
  /** Vrai pendant qu'on allume la caméra : le bouton ne doit pas repartir. */
  passageEnVideo: boolean;
  erreur?: string;

  /**
   * Ouvre le canal de signalisation.
   *
   * **La clé n'est pas requise pour ouvrir.** Une version précédente attendait
   * les clés du couple : tant qu'elles n'étaient pas chargées, aucun socket
   * n'existait, donc aucun appel ne sonnait — et rien à l'écran ne le disait.
   * Le canal s'ouvre maintenant dès qu'on a un jeton ; la clé arrive à part et
   * ne sert qu'à sceller la négociation.
   */
  brancher: (jeton: string, coupleId: string) => void;
  /** Fournit la clé du couple, quand elle est connue. */
  definirCle: (clePubliqueAutre: string) => void;
  debrancher: () => void;
  /**
   * Relance le canal s'il est tombé.
   *
   * Appelé au retour de l'application au premier plan : le téléphone a pu
   * dormir des heures, et sans cela on attendrait le prochain report du délai
   * de reconnexion — assez pour manquer un appel.
   */
  reveillerLeCanal: () => void;

  appeler: (coupleId: string, sorte: SorteAppel) => Promise<boolean>;
  decrocher: (coupleId: string) => Promise<boolean>;
  raccrocher: (coupleId: string, raison?: RaisonFin) => Promise<void>;
  basculerMicro: () => void;
  basculerCamera: () => void;
  basculerHautParleur: () => void;
  retournerLaCamera: () => void;
  /**
   * Allume sa caméra au milieu d'un appel audio.
   *
   * Ajouter une piste ne suffit pas : il faut renégocier, sinon elle ne
   * traverse jamais. On réutilise pour cela l'échange offre/réponse du
   * décrochage, qui n'a rien de propre au premier établissement.
   *
   * On n'attend pas l'accord de l'autre : c'est *sa* caméra qu'on allume, pas
   * la sienne. Lui décide de la sienne avec le même bouton.
   */
  passerEnVideo: (coupleId: string) => Promise<void>;
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
/** Notre identifiant, retenu à l'ouverture du canal. */
let partenaireCourant: string | undefined;
/** Candidats reçus avant que la liaison n'existe : rejoués ensuite. */
let candidatsEnAttente: unknown[] = [];

/**
 * Le message à montrer.
 *
 * Un refus de micro porte déjà sa propre explication : la passer à
 * `messageLisible` la remplacerait par « réessayez dans un instant », ce qui
 * n'aide personne à trouver le réglage.
 */
function lireLErreur(erreur: unknown): string {
  if (erreur instanceof PermissionRefusee) return erreur.message;
  return messageLisible(erreur);
}

export const useAppels = create<EtatAppels>()((set, get) => {
  /**
   * Dépose la trace de l'appel dans la conversation.
   *
   * Seul **l'appelant** l'écrit. Si les deux le faisaient, chaque appel
   * laisserait deux lignes ; et c'est lui qui connaît la sorte d'appel dès le
   * départ, là où celui qu'on appelle peut n'avoir jamais décroché.
   *
   * Un échec d'écriture ne remonte nulle part : l'appel a eu lieu, et un
   * message d'erreur après avoir raccroché n'apprendrait rien d'utile.
   */
  const laisserLaTrace = (appel: Appel) => {
    const coupleId = coupleCourant;
    const moiId = appel.appelantId;
    if (!coupleId) return;

    const lecture = lectureAppel(appel, moiId, dureeLisible);
    const texte = lecture.detail
      ? `${lecture.titre} · ${lecture.detail}`
      : lecture.titre;

    void useChat.getState().envoyer(coupleId, moiId, texte, 'appel');
  };

  /** Ferme tout le matériel et remet l'écran au repos. */
  const nettoyer = () => {
    liaison?.raccrocher();
    liaison = undefined;
    candidatsEnAttente = [];
    // Sans cela, la musique jouée après l'appel sortirait de l'écouteur.
    void router(false);
    set({
      appel: undefined,
      jappelle: false,
      fluxLocal: undefined,
      fluxDistant: undefined,
      microCoupe: false,
      cameraCoupee: false,
      hautParleur: false,
      passageEnVideo: false,
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
      onFluxDistant: (flux) => {
        // Une piste vidéo qui arrive fait passer l'appel en vidéo de ce
        // côté-ci : l'autre a allumé sa caméra, on doit la montrer.
        const avecVideo = flux.getVideoTracks().length > 0;
        const courant = get().appel;
        set({
          fluxDistant: flux,
          ...(avecVideo && courant && courant.sorte !== 'video'
            ? { appel: { ...courant, sorte: 'video' as const } }
            : {}),
        });
      },
      onEchec: () => {
        void get().raccrocher(coupleCourant ?? '', 'echec_reseau');
      },
    });

    liaison = nouvelle;
    // Un appel vidéo démarre au haut-parleur, un appel audio à l'écouteur.
    const hautParleur = appel.sorte === 'video';
    void router(hautParleur);
    set({ fluxLocal: nouvelle.fluxLocal, hautParleur });

    // Les candidats arrivés pendant la préparation du matériel.
    for (const candidat of candidatsEnAttente) {
      void ajouterCandidat(nouvelle.connexion, candidat);
    }
    candidatsEnAttente = [];

    return nouvelle;
  };

  const surMessage = (message: MessageRecu) => {
    void (async () => {
      // La clé ne sert qu'à ouvrir une négociation scellée. Un garde global
      // sur `cle` jetait **tout**, sonnerie comprise : le socket recevait bien
      // l'appel, et le téléphone le mettait à la poubelle sans rien afficher.
      // C'est la raison pour laquelle rien ne sonnait.
      const scelle =
        message.sorte === 'accepte' ||
        message.sorte === 'propose' ||
        message.sorte === 'candidat';
      if (scelle && !cle) {
        set({
          erreur:
            'Vos clés de chiffrement ne sont pas encore échangées. Ouvrez la conversation une fois sur chacun de vos téléphones.',
        });
        return;
      }

      switch (message.sorte) {
        case 'sonne': {
          // On ne touche à rien : ni micro, ni caméra. L'écran d'appel entrant
          // s'affiche, et c'est le décrochage qui ouvrira le matériel.
          set({
            appel: message.appel as Appel,
            jappelle: false,
            erreur: undefined,
          });
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
            charge: scellerCharge(cle!, offre),
            coupleId: coupleCourant ?? '',
          });
          return;
        }

        case 'fin': {
          // C'est l'autre qui a raccroché ou décliné : le serveur nous rend
          // l'appel clos, avec sa raison. On laisse la trace si c'est nous qui
          // appelions.
          // Le serveur pousse l'appel clos ; un signal « fin » relayé de
          // téléphone à téléphone n'en porte pas.
          const clos = (message as { appel?: unknown }).appel as Appel | undefined;
          if (clos && clos.appelantId === partenaireCourant) laisserLaTrace(clos);
          nettoyer();
          return;
        }

        case 'accepte': {
          // Une offre nous parvient : nous sommes celui qui a décroché.
          const offre = ouvrirCharge<unknown>(cle!, message.charge);
          if (!offre || !liaison) return;
          const reponse = await creerReponse(liaison.connexion, offre);
          canal?.envoyer({
            sorte: 'propose',
            appelId: message.appelId,
            appel: get().appel?.sorte ?? 'audio',
            charge: scellerCharge(cle!, reponse),
            coupleId: coupleCourant ?? '',
          });
          return;
        }

        case 'propose': {
          // La réponse de celui qui a décroché.
          const reponse = ouvrirCharge<unknown>(cle!, message.charge);
          if (!reponse || !liaison) return;
          await accepterReponse(liaison.connexion, reponse);
          return;
        }

        case 'candidat': {
          const candidat = ouvrirCharge<unknown>(cle!, message.charge);
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
    hautParleur: false,
    passageEnVideo: false,

    brancher(jeton, coupleId) {
      coupleCourant = coupleId;
      partenaireCourant = useSessionServeur.getState().partenaireId;
      canal?.fermer();
      canal = ouvrirSignalisation({ jeton, onMessage: surMessage });
    },

    definirCle(clePubliqueAutre) {
      void cleDeMessages(clePubliqueAutre).then((derivee) => {
        cle = derivee;
      });
    },

    reveillerLeCanal() {
      canal?.reveiller();
    },

    debrancher() {
      canal?.fermer();
      canal = undefined;
      nettoyer();
    },

    async appeler(coupleId, sorte) {
      set({ erreur: undefined });

      // Sans canal ouvert, l'appel partirait côté serveur mais aucun signal ne
      // circulerait : ça sonnerait dans le vide, sans rien à l'écran pour
      // l'expliquer. On refuse en le disant.
      if (!canal?.ouvert()) {
        set({
          erreur:
            'La liaison d’appel n’est pas encore prête. Réessayez dans quelques secondes.',
        });
        return false;
      }
      if (!cle) {
        set({
          erreur: `Vos clés de chiffrement ne sont pas encore échangées. Ouvrez la conversation une fois sur chacun de vos téléphones.`,
        });
        return false;
      }

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
        set({ erreur: lireLErreur(erreur) });
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
        // On garde l'écran d'appel : sans lui, un refus de micro ferait tout
        // disparaître et la personne ne saurait pas pourquoi elle n'a pas pu
        // décrocher. `preparer` n'a rien laissé derrière lui s'il a échoué —
        // le bouton rouge reste là pour décliner.
        set({ erreur: lireLErreur(erreur) });
        return false;
      }
    },

    async raccrocher(coupleId, raison = 'raccroche') {
      const appel = get().appel;
      const jappelais = get().jappelle;
      nettoyer();
      if (!appel || !coupleId) return;
      try {
        const { appel: clos } = await appeler<{ appel: Appel }>(
          `/couples/${coupleId}/appels/${appel.id}/fin`,
          { methode: 'POST', corps: { raison } },
        );
        if (jappelais) laisserLaTrace(clos);
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

    basculerHautParleur() {
      const vers = !get().hautParleur;
      void router(vers);
      set({ hautParleur: vers });
    },

    retournerLaCamera() {
      liaison?.retournerLaCamera();
    },

    async passerEnVideo(coupleId) {
      const appel = get().appel;
      if (!appel || !liaison || get().passageEnVideo) return;

      set({ passageEnVideo: true, erreur: undefined });
      try {
        const flux = await liaison.allumerLaCamera();
        if (!flux) {
          set({
            erreur:
              'La caméra n’a pas pu être allumée. Vous pouvez l’autoriser dans les réglages du téléphone.',
          });
          return;
        }

        // Un appel vidéo se tient devant soi, pas contre l'oreille.
        if (!get().hautParleur) {
          void router(true);
          set({ hautParleur: true });
        }

        set({ fluxLocal: flux, appel: { ...appel, sorte: 'video' } });

        if (!cle) return;
        const offre = await creerOffre(liaison.connexion);
        canal?.envoyer({
          sorte: 'accepte',
          appelId: appel.id,
          charge: scellerCharge(cle, offre),
          coupleId,
        });
      } catch (erreur) {
        set({ erreur: lireLErreur(erreur) });
      } finally {
        set({ passageEnVideo: false });
      }
    },
  };
});
