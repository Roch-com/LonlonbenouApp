/**
 * Canal de signalisation des appels, côté téléphone.
 *
 * ## Tout ce qui sort est scellé
 *
 * L'offre, la réponse et les chemins réseau candidats sont chiffrés avec la
 * clé du couple avant d'être confiés au serveur. Il relaie sans pouvoir lire,
 * et surtout sans pouvoir remplacer les empreintes cryptographiques qui
 * protègent le flux — sans quoi il pourrait s'intercaler dans l'appel.
 *
 * ## La reconnexion
 *
 * Le socket se rouvre tout seul, avec un délai qui s'allonge. Un appel dure
 * quelques minutes et une coupure de réseau en plein milieu ne doit pas
 * demander de tout recommencer à la main. Au-delà de quelques essais on
 * abandonne : insister sur un réseau absent vide la batterie sans rien
 * réparer.
 */
import {
  ouvrirMessage,
  scellerMessage,
  LONGUEUR_NONCE,
  type SignalAppel,
} from '@lonlonbenu/shared';
import * as Crypto from 'expo-crypto';
import { CONFIGURATION_API } from '@/lib/api/configuration';

/** Ce que le serveur pousse, en plus des signaux relayés. */
export type MessageRecu =
  | { sorte: 'sonne'; appel: unknown; coupleId: string }
  | { sorte: 'decroche'; appel: unknown; coupleId: string }
  | { sorte: 'fin'; appel: unknown; coupleId: string }
  /** Un message de la conversation vient de changer — nouveau, retiré, réagi. */
  | { sorte: 'message'; message: unknown; coupleId: string }
  /** L'épingle de la conversation a bougé. `epingle` est nulle si décrochée. */
  | { sorte: 'epingle'; epingle: unknown; coupleId: string }
  | (SignalAppel & { de: string });

/**
 * Abonnés au canal, par-delà les appels.
 *
 * Le socket est ouvert par la couche d'appel, qui est montée à la racine et
 * vit donc tout le temps. Le chat s'y branche plutôt que d'en ouvrir un
 * second : deux sockets doubleraient les connexions et les reconnexions pour
 * transporter des charges qui tiennent dans la même enveloppe.
 */
const abonnes = new Set<(message: MessageRecu) => void>();

export function ecouterLeCanal(
  ecouter: (message: MessageRecu) => void,
): () => void {
  abonnes.add(ecouter);
  return () => abonnes.delete(ecouter);
}

function diffuser(message: MessageRecu): void {
  for (const ecouter of abonnes) {
    try {
      ecouter(message);
    } catch {
      // Un abonné qui échoue ne doit pas priver les autres du message.
    }
  }
}

interface Options {
  jeton: string;
  onMessage: (message: MessageRecu) => void;
  onEtat?: (ouvert: boolean) => void;
}

export interface Signalisation {
  /** Envoie un signal. Rend faux si le canal n'est pas ouvert. */
  envoyer: (signal: SignalAppel & { coupleId: string }) => boolean;
  fermer: () => void;
  /** Relance tout de suite si le canal est tombé. */
  reveiller: () => void;
  ouvert: () => boolean;
}

/**
 * Attente avant reconnexion : 1 s, 2 s, 4 s… plafonnée à 15 s.
 *
 * **On n'abandonne jamais.** Une version précédente s'arrêtait après cinq
 * essais : une fois le canal perdu — réseau qui bascule, téléphone en veille,
 * serveur redémarré — il ne revenait plus, et plus aucun appel ne sonnait.
 * Rien à l'écran ne l'expliquait, et c'est la cause des appels qui
 * n'aboutissaient pas.
 */
const attente = (essai: number) => Math.min(1000 * 2 ** essai, 15_000);

/**
 * Battement de cœur.
 *
 * Un WebSocket silencieux est fermé par les intermédiaires — l'hébergeur, le
 * routeur de l'opérateur — au bout d'une minute environ. Sans trafic, le canal
 * meurt sans que personne ne le sache : le socket reste « ouvert » côté
 * téléphone alors que plus rien ne passe.
 *
 * Vingt-cinq secondes passent sous tous les seuils que l'on rencontre.
 */
const BATTEMENT_MS = 25_000;

export function ouvrirSignalisation({
  jeton,
  onMessage,
  onEtat,
}: Options): Signalisation {
  let socket: WebSocket | undefined;
  let essais = 0;
  let ferme = false;
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let coeur: ReturnType<typeof setInterval> | undefined;

  const arreterLeCoeur = () => {
    if (coeur) clearInterval(coeur);
    coeur = undefined;
  };

  const adresse = () => {
    const base = CONFIGURATION_API.base.replace(/^http/, 'ws');
    return `${base}/appels/signal?jeton=${encodeURIComponent(jeton)}`;
  };

  const connecter = () => {
    if (ferme) return;
    socket = new WebSocket(adresse());

    socket.onopen = () => {
      essais = 0;
      onEtat?.(true);
      arreterLeCoeur();
      coeur = setInterval(() => {
        if (socket?.readyState !== WebSocket.OPEN) return;
        try {
          socket.send(JSON.stringify({ sorte: 'battement' }));
        } catch {
          // Le socket est mort sans le dire : `onclose` suivra et relancera.
        }
      }, BATTEMENT_MS);
    };

    socket.onmessage = (evenement) => {
      try {
        const message = JSON.parse(String(evenement.data)) as MessageRecu;
        onMessage(message);
        diffuser(message);
      } catch {
        // Un message illisible est ignoré : il n'y a rien à réparer, et
        // laisser remonter l'erreur couperait le canal pour rien.
      }
    };

    socket.onclose = () => {
      arreterLeCoeur();
      onEtat?.(false);
      if (ferme) return;
      minuterie = setTimeout(connecter, attente(essais));
      essais += 1;
    };

    socket.onerror = () => {
      // `onclose` suit toujours : la reconnexion est gérée là, une seule fois.
    };
  };

  connecter();

  return {
    envoyer(signal) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(signal));
        return true;
      } catch {
        return false;
      }
    },
    fermer() {
      ferme = true;
      if (minuterie) clearTimeout(minuterie);
      arreterLeCoeur();
      socket?.close();
      socket = undefined;
    },
    /**
     * Force une reconnexion immédiate si le canal est tombé.
     *
     * Appelé au retour de l'application au premier plan : le téléphone a pu
     * dormir des heures, et attendre le prochain report du délai ferait
     * manquer les appels de la première minute.
     */
    reveiller() {
      if (ferme || socket?.readyState === WebSocket.OPEN) return;
      if (minuterie) clearTimeout(minuterie);
      essais = 0;
      connecter();
    },
    ouvert: () => socket?.readyState === WebSocket.OPEN,
  };
}

/** Scelle une charge de négociation avant de la confier au serveur. */
export function scellerCharge(cle: Uint8Array, valeur: unknown): string {
  const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
  return scellerMessage(cle, nonce, JSON.stringify(valeur));
}

/**
 * Ouvre une charge reçue.
 *
 * Rend `undefined` si l'enveloppe ne s'ouvre pas — ce qui, pendant un appel,
 * signifie soit un changement de clés, soit un serveur qui a tenté de
 * substituer la sienne. Dans les deux cas on n'utilise pas le contenu.
 */
export function ouvrirCharge<T>(cle: Uint8Array, charge: string): T | undefined {
  try {
    return JSON.parse(ouvrirMessage(cle, charge)) as T;
  } catch {
    return undefined;
  }
}
