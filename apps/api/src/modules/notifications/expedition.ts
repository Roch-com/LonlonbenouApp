/**
 * Exigence 4 — expédition des notifications, branchée sur `deciderRemise`.
 *
 * Point de passage unique du serveur. Aucun module ne pousse directement : tout
 * appelle `publier`, qui interroge la logique déjà écrite et testée côté
 * partagé. Le serveur n'a donc pas sa propre politique de notification — il
 * exécute la même.
 *
 * Le regroupement, lui, est bien un travail de serveur : le mobile décidait du
 * sort d'une notification mais n'avait aucun moyen de remettre plus tard ce
 * qu'il avait mis de côté. C'est `viderLaFile` qui s'en charge.
 */

import {
  deciderRemise,
  estEnSilence,
  type CategorieNotification,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type { Depot, NotificationServeur } from '../../domaine/depot.ts';
import { ErreurPush, type Transport } from './transport.ts';

export interface ANotifier {
  destinataireId: PartenaireId;
  categorie: CategorieNotification;
  texte: string;
}

/** Délai au bout duquel les notifications « groupées » partent ensemble. */
export const FENETRE_REGROUPEMENT_MS = 60 * 60_000;

/**
 * Titre du message poussé. Volontairement pauvre : le contenu réel n'a rien à
 * faire sur un écran verrouillé, ni sur les serveurs d'Apple et de Google.
 */
function titrePour(categorie: CategorieNotification): string {
  return categorie === 'sos' ? 'SOS' : 'LONLONBENU';
}

function corpsPour(categorie: CategorieNotification, nombre: number): string {
  if (categorie === 'sos') return 'Votre partenaire a besoin d’aide.';
  if (nombre > 1) return `${nombre} choses vous attendent.`;
  return 'Quelque chose vous attend.';
}

export interface Expediteur {
  publier(entrees: readonly ANotifier[], maintenant?: Date): Promise<NotificationServeur[]>;
  viderLaFile(partenaireId: PartenaireId, maintenant?: Date): Promise<number>;
}

let compteur = 0;
function identifiant(): string {
  compteur += 1;
  return `${Date.now().toString(36)}-${compteur.toString(36)}`;
}

export function creerExpediteur(
  depot: Depot,
  transport: Transport,
  journal: { warn(objet: unknown, message: string): void } = console,
): Expediteur {
  /**
   * Rend `false` seulement si le partenaire a des appareils inscrits et
   * qu'aucun n'a reçu le message. Un partenaire sans appareil n'est pas un
   * échec : il n'a simplement rien à recevoir en push, la notification reste
   * au journal comme les autres.
   */
  async function pousser(
    partenaireId: PartenaireId,
    categorie: CategorieNotification,
    nombre: number,
  ): Promise<boolean> {
    const appareils = await depot.appareils.parPartenaire(partenaireId);
    if (appareils.length === 0) return true;

    let unAuMoins = false;

    for (const appareil of appareils) {
      try {
        await transport.pousser({
          appareil,
          titre: titrePour(categorie),
          corps: corpsPour(categorie, nombre),
          regroupees: nombre,
        });
        unAuMoins = true;
      } catch (erreur) {
        // Un appareil qui refuse ne doit pas empêcher l'autre de recevoir :
        // ils appartiennent à la même personne, pas au même destin.
        if (erreur instanceof ErreurPush && erreur.jetonInvalide) {
          // App désinstallée ou jeton révoqué : on délie, sans quoi on
          // pousserait éternellement dans le vide.
          await depot.appareils.supprimerParJeton(appareil.jetonPush);
        }
        journal.warn(
          {
            plateforme: appareil.plateforme,
            statut: erreur instanceof ErreurPush ? erreur.statut : undefined,
            // Jamais le jeton ni le contenu : ces journaux se relisent à
            // plusieurs et se recopient dans des tickets.
            raison: (erreur as Error).message,
          },
          'échec d’envoi push',
        );
      }
    }

    return unAuMoins;
  }

  /**
   * Délie les appareils d'un partenaire dont le couple est dissocié, **une fois
   * que plus rien ne l'attend**. Supprimer les jetons push au moment de la
   * dissociation détruirait le canal avant que l'annonce différée ait pu
   * partir : la personne découvrirait la séparation en trouvant l'app muette.
   */
  async function nettoyerAppareilsSiTermine(
    partenaireId: PartenaireId,
  ): Promise<void> {
    const couple = await depot.couples.parPartenaire(partenaireId);
    if (!couple?.dissocieLe) return;

    const reste = await depot.notifications.enAttente(partenaireId);
    if (reste.length === 0) {
      await depot.appareils.effacerPourPartenaire(partenaireId);
    }
  }

  return {
    async publier(entrees, maintenant = new Date()) {
      const enregistrees: NotificationServeur[] = [];

      for (const entree of entrees) {
        const preferences = await depot.notifications.preferences(
          entree.destinataireId,
        );
        const decision = deciderRemise(entree.categorie, preferences, maintenant);

        const notification: NotificationServeur = {
          id: identifiant(),
          destinataireId: entree.destinataireId,
          categorie: entree.categorie,
          texte: entree.texte,
          emiseLe: maintenant.toISOString(),
          remise: decision.remise,
          raison: decision.raison,
        };

        // Même « ignoree », l'entrée reste au journal : la personne doit pouvoir
        // retrouver ce qui ne lui a pas été signalé.
        if (decision.remise === 'envoyee') {
          // Pas d'horodatage d'expédition si rien n'est parti : la notification
          // reste en attente et sera reprise par `viderLaFile`. Marquer
          // « expédiée » un message que personne n'a reçu ferait mentir le
          // journal et perdrait définitivement l'information.
          if (await pousser(entree.destinataireId, entree.categorie, 1)) {
            notification.expedieeLe = maintenant.toISOString();
          }
        }

        await depot.notifications.ajouter(notification);
        enregistrees.push(notification);
        await nettoyerAppareilsSiTermine(entree.destinataireId);
      }

      return enregistrees;
    },

    /**
     * Remet ce qui avait été mis de côté, en **un seul message** plutôt qu'en
     * rafale. Rend le nombre de notifications effectivement expédiées.
     */
    async viderLaFile(partenaireId, maintenant = new Date()) {
      const preferences = await depot.notifications.preferences(partenaireId);

      // Tant que le silence dure, on ne réveille personne.
      if (estEnSilence(preferences, maintenant)) return 0;

      const enAttente = await depot.notifications.enAttente(partenaireId);
      if (enAttente.length === 0) return 0;

      const aExpedier = enAttente.filter((notification) => {
        // Une notification retenue par le silence part dès qu'il est levé.
        if (notification.remise === 'differee') return true;
        // Un envoi immédiat que le fournisseur a refusé se retente sans
        // attendre : il devait partir tout de suite.
        if (notification.remise === 'envoyee') return true;
        // Une notification groupée attend sa fenêtre.
        return (
          maintenant.getTime() - Date.parse(notification.emiseLe) >=
          FENETRE_REGROUPEMENT_MS
        );
      });

      if (aExpedier.length === 0) return 0;

      // Même règle qu'à la publication : on ne solde pas la file si rien
      // n'est parti, sinon la vague entière disparaît sur une panne réseau.
      if (!(await pousser(partenaireId, 'rappel', aExpedier.length))) return 0;

      await depot.notifications.marquerExpediees(
        aExpedier.map((n) => n.id),
        maintenant.toISOString(),
      );
      await nettoyerAppareilsSiTermine(partenaireId);

      return aExpedier.length;
    },
  };
}
