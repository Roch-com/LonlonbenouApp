/**
 * Envoi de courriel.
 *
 * Même forme que le transport de notifications : un port, des adaptateurs, et
 * rien qui décide à la place du métier. Le serveur n'envoie qu'une seule sorte
 * de courriel pour l'instant — le code de réinitialisation — mais il n'y a
 * aucune raison de lier ce besoin à un fournisseur particulier.
 */

export interface Message {
  destinataire: string;
  sujet: string;
  /** Texte seul. Voir l'adaptateur Resend pour la raison. */
  corps: string;
}

export interface Courrier {
  envoyer(message: Message): Promise<void>;
}

export class ErreurCourrier extends Error {
  readonly statut?: number;
  constructor(message: string, statut?: number) {
    super(message);
    this.name = 'ErreurCourrier';
    this.statut = statut;
  }
}

/** Adaptateur de test : garde tout en mémoire. */
export function creerCourrierFactice(): Courrier & { messages: Message[] } {
  const messages: Message[] = [];
  return {
    messages,
    async envoyer(message) {
      messages.push(message);
    },
  };
}

/**
 * Adaptateur de développement : note l'envoi au journal sans rien expédier.
 *
 * Il rend le parcours vérifiable sans compte chez un fournisseur. En
 * production, sa mention au démarrage doit alerter : elle signifie que personne
 * ne recevra jamais son code.
 */
export function creerCourrierJournal(
  journal: { warn(objet: unknown, message: string): void } = console,
): Courrier {
  return {
    async envoyer(message) {
      // Le corps ne va pas au journal : il porte le code, et un journal se
      // relit à plusieurs.
      journal.warn(
        { destinataire: message.destinataire, sujet: message.sujet },
        'courriel non expédié — aucun fournisseur configuré',
      );
    },
  };
}

export interface ConfigurationResend {
  cle: string;
  /** Adresse d'expédition, vérifiée chez le fournisseur. */
  expediteur: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Adaptateur Resend.
 *
 * Retenu pour son palier gratuit durable et son inscription sans carte
 * bancaire. Le corps part en **texte seul**, délibérément : un courriel tout en
 * HTML atterrit plus volontiers dans les indésirables, et il n'y a rien à mettre
 * en forme dans un code de huit caractères. Un code qui n'arrive pas est un
 * compte perdu.
 */
export function creerCourrierResend(config: ConfigurationResend): Courrier {
  const appeler = config.fetch ?? globalThis.fetch;

  return {
    async envoyer(message) {
      const reponse = await appeler('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.cle}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: config.expediteur,
          to: [message.destinataire],
          subject: message.sujet,
          text: message.corps,
        }),
      });

      if (reponse.ok) return;

      const detail = await reponse.text().catch(() => '');
      throw new ErreurCourrier(
        `Envoi de courriel refusé (${reponse.status}) ${detail.slice(0, 200)}`,
        reponse.status,
      );
    },
  };
}

/** Monte l'adaptateur que l'environnement permet. */
export function creerCourrierDepuisEnv(env: NodeJS.ProcessEnv = process.env): {
  courrier: Courrier;
  fournisseur: string;
} {
  const cle = env['RESEND_API_KEY'];
  const expediteur = env['LONLONBENU_COURRIEL_EXPEDITEUR'];

  if (cle && expediteur) {
    return {
      courrier: creerCourrierResend({ cle, expediteur }),
      fournisseur: 'resend',
    };
  }
  return { courrier: creerCourrierJournal(), fournisseur: 'aucun' };
}
