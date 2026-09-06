/**
 * Le canal temps réel, partagé par tous les modules.
 *
 * ## Un seul socket par personne
 *
 * Il est né pour la signalisation des appels, qui ne pouvait pas s'en passer.
 * Le chat s'y branche à son tour : ouvrir un second socket doublerait les
 * connexions, les reconnexions et les jetons à vérifier, pour transporter des
 * charges qui tiennent dans la même enveloppe.
 *
 * ## Ce qui y transite
 *
 * Des enveloppes scellées et des identifiants de routage. Le serveur sait
 * qu'un message existe et pour qui ; il ne sait pas ce qu'il dit. Rien de ce
 * qui passe ici n'est conservé.
 *
 * ## Le routage est explicite
 *
 * On pousse vers un partenaire nommé, jamais « vers tous les autres ». Une
 * première version des appels diffusait les fins d'appel à tous les sockets
 * ouverts : c'était une fuite vers les autres couples.
 */

import type { WebSocket } from 'ws';

export interface CanalTempsReel {
  /** Attache un socket à une personne. Remplace le précédent s'il y en a un. */
  attacher(partenaireId: string, socket: WebSocket): void;
  detacher(partenaireId: string, socket: WebSocket): void;
  /** Pousse une charge. Rend faux si la personne n'est pas connectée. */
  pousser(partenaireId: string, charge: unknown): boolean;
  /** Vrai si la personne a un socket ouvert. */
  present(partenaireId: string): boolean;
}

export function creerCanalTempsReel(): CanalTempsReel {
  const sockets = new Map<string, WebSocket>();

  return {
    attacher(partenaireId, socket) {
      // Une connexion plus récente remplace la précédente : sans cela, un
      // socket resté ouvert après une coupure réseau capterait les messages
      // sans que personne ne les reçoive.
      const precedent = sockets.get(partenaireId);
      if (precedent && precedent !== socket) precedent.close(4000, 'remplace');
      sockets.set(partenaireId, socket);
    },

    detacher(partenaireId, socket) {
      // On ne retire que si c'est bien le socket courant : sinon la fermeture
      // tardive d'une connexion remplacée effacerait la nouvelle.
      if (sockets.get(partenaireId) === socket) sockets.delete(partenaireId);
    },

    pousser(partenaireId, charge) {
      const socket = sockets.get(partenaireId);
      if (!socket || socket.readyState !== socket.OPEN) return false;
      try {
        socket.send(JSON.stringify(charge));
        return true;
      } catch {
        return false;
      }
    },

    present(partenaireId) {
      const socket = sockets.get(partenaireId);
      return !!socket && socket.readyState === socket.OPEN;
    },
  };
}
