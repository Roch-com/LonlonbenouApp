/**
 * Exigence 4 — transport des notifications (FCM / APNs).
 *
 * Le transport ne décide de rien. Il reçoit ce que `deciderRemise` a laissé
 * passer et le pousse, point. Toute la politique — SOS impératif, ne pas
 * déranger, fréquences — reste dans `@lonlonbenu/shared`, exécutée par
 * `expedition.ts`.
 *
 * **Contrainte qui gouverne toutes les implémentations** : le corps d'une
 * notification poussée ne contient jamais de contenu. Il transite par les
 * serveurs d'Apple et de Google et s'affiche sur un écran verrouillé. On y met
 * de quoi inciter à ouvrir l'app, jamais ce qui a été écrit — et ce serait de
 * toute façon impossible pour le chat, dont le serveur n'a que des enveloppes
 * scellées.
 */

import type { Appareil } from '../../domaine/depot.ts';

export interface MessagePousse {
  appareil: Appareil;
  titre: string;
  corps: string;
  /** Nombre de notifications regroupées dans ce message. */
  regroupees: number;
}

export interface Transport {
  /** Lève une `ErreurPush` en cas d'échec. */
  pousser(message: MessagePousse): Promise<void>;
}

/**
 * Échec d'envoi, qualifié pour que l'appelant sache quoi en faire.
 *
 * La distinction compte : un jeton mort doit être retiré du dépôt — sinon on
 * réessaie éternellement vers un appareil désinstallé — alors qu'une panne
 * passagère ne doit surtout pas coûter son inscription à un appareil valide.
 */
export class ErreurPush extends Error {
  /** L'appareil n'existe plus : à délier définitivement. */
  readonly jetonInvalide: boolean;
  /** Panne passagère : on peut réessayer plus tard. */
  readonly reessayable: boolean;
  readonly statut?: number;

  constructor(
    message: string,
    options: {
      jetonInvalide?: boolean;
      reessayable?: boolean;
      statut?: number;
    } = {},
  ) {
    super(message);
    this.name = 'ErreurPush';
    this.jetonInvalide = options.jetonInvalide ?? false;
    this.reessayable = options.reessayable ?? false;
    this.statut = options.statut;
  }
}

/** Transport de test et de développement : garde tout en mémoire. */
export function creerTransportFactice(): Transport & {
  messages: MessagePousse[];
} {
  const messages: MessagePousse[] = [];
  return {
    messages,
    async pousser(message) {
      messages.push(message);
    },
  };
}

/**
 * Aiguillage par plateforme. Un appareil dont la plateforme n'a pas
 * d'adaptateur configuré échoue franchement plutôt que d'être ignoré en
 * silence : une notification qui disparaît sans trace est pire qu'une erreur.
 */
export function creerTransportParPlateforme(adaptateurs: {
  ios?: Transport;
  android?: Transport;
}): Transport {
  return {
    async pousser(message) {
      const adaptateur = adaptateurs[message.appareil.plateforme];
      if (!adaptateur) {
        throw new ErreurPush(
          `Aucun transport configuré pour la plateforme ${message.appareil.plateforme}`,
        );
      }
      await adaptateur.pousser(message);
    },
  };
}
