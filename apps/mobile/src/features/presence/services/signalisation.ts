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
  | (SignalAppel & { de: string });

interface Options {
  jeton: string;
  onMessage: (message: MessageRecu) => void;
  onEtat?: (ouvert: boolean) => void;
}

export interface Signalisation {
  /** Envoie un signal. Rend faux si le canal n'est pas ouvert. */
  envoyer: (signal: SignalAppel & { coupleId: string }) => boolean;
  fermer: () => void;
  ouvert: () => boolean;
}

const ESSAIS_MAX = 5;

/** Attente avant reconnexion : 1 s, 2 s, 4 s… plafonnée à 10 s. */
const attente = (essai: number) => Math.min(1000 * 2 ** essai, 10_000);

export function ouvrirSignalisation({
  jeton,
  onMessage,
  onEtat,
}: Options): Signalisation {
  let socket: WebSocket | undefined;
  let essais = 0;
  let ferme = false;
  let minuterie: ReturnType<typeof setTimeout> | undefined;

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
    };

    socket.onmessage = (evenement) => {
      try {
        onMessage(JSON.parse(String(evenement.data)) as MessageRecu);
      } catch {
        // Un message illisible est ignoré : il n'y a rien à réparer, et
        // laisser remonter l'erreur couperait le canal pour rien.
      }
    };

    socket.onclose = () => {
      onEtat?.(false);
      if (ferme || essais >= ESSAIS_MAX) return;
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
      socket?.close();
      socket = undefined;
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
