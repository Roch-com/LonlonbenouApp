/**
 * Exigence 3 — protocole d'appairage rejoué côté serveur.
 *
 * Le mobile simulait l'appairage faute de serveur, mais le protocole était
 * écrit pour être rejoué tel quel. C'est ce que fait ce service : il appelle
 * `creerInvitation` et `verifierInvitation` de `@lonlonbenu/shared`, sans en
 * réécrire une ligne.
 *
 * Deux responsabilités qui, elles, n'appartiennent qu'au serveur :
 *
 *   1. **Détenir le vérificateur.** Le code en clair n'est rendu qu'une fois, à
 *      l'émission, et n'est jamais stocké.
 *   2. **Persister chaque tentative.** `verifierInvitation` rend une invitation
 *      mise à jour ; si le serveur oubliait de l'enregistrer, le compteur
 *      d'essais resterait à zéro et le plafond de cinq tentatives ne servirait
 *      à rien. C'est le piège classique de ce genre de protocole.
 */

import { randomUUID, randomBytes } from 'node:crypto';
import {
  codeDepuisAlea,
  creerInvitation,
  creerPartage,
  formaterCode,
  LONGUEUR_CODE,
  secondesAvantExpiration,
  verifierInvitation,
  type Couple,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type { Depot } from '../../domaine/depot.ts';
import { MODULES_SENSIBLES } from '../../domaine/depot.ts';

export interface InvitationEmise {
  invitationId: string;
  /** Rendu une seule fois. Le serveur ne le conserve pas. */
  code: string;
  codeFormate: string;
  expireDansSecondes: number;
}

export interface ResultatAppairage {
  ok: boolean;
  motif?: string;
  message?: string;
  coupleId?: string;
}

export interface ServiceAppairage {
  emettre(emetteur: { id: PartenaireId; prenom: string }): Promise<InvitationEmise>;
  accepter(
    invitationId: string,
    code: string,
    invite: { id: PartenaireId; prenom: string },
  ): Promise<ResultatAppairage>;
}

function initialesDe(prenom: string): string {
  return (prenom.trim()[0] ?? '?').toUpperCase();
}

export function creerServiceAppairage(depot: Depot): ServiceAppairage {
  return {
    async emettre(emetteur) {
      const code = codeDepuisAlea(randomBytes(LONGUEUR_CODE));
      const sel = randomBytes(16);
      const invitationId = randomUUID();

      await depot.invitations.enregistrer({
        id: invitationId,
        // `creerInvitation` ne range que le vérificateur dérivé.
        invitation: creerInvitation(code, sel, emetteur.id),
      });

      const enregistree = await depot.invitations.parId(invitationId);
      return {
        invitationId,
        code,
        codeFormate: formaterCode(code),
        expireDansSecondes: secondesAvantExpiration(enregistree!.invitation),
      };
    },

    async accepter(invitationId, code, invite) {
      const entree = await depot.invitations.parId(invitationId);
      if (!entree) {
        return {
          ok: false,
          motif: 'introuvable',
          message: 'Cette invitation n’existe pas ou plus.',
        };
      }

      const resultat = verifierInvitation(entree.invitation, code);

      // À enregistrer dans tous les cas : c'est ce qui fait vivre le compteur
      // d'essais et la consommation du code.
      await depot.invitations.enregistrer({
        ...entree,
        invitation: resultat.invitation,
      });

      if (!resultat.ok) {
        return { ok: false, motif: resultat.motif, message: resultat.message };
      }

      const emetteurId = entree.invitation.emisePar;
      if (emetteurId === invite.id) {
        return {
          ok: false,
          motif: 'meme_personne',
          message: 'Ce code a été créé depuis ce compte.',
        };
      }

      const coupleId = randomUUID();
      const couple: Couple = {
        id: coupleId,
        depuis: new Date().toISOString().slice(0, 10),
        partenaires: [
          {
            id: emetteurId,
            prenom: '',
            initiales: '?',
          },
          {
            id: invite.id,
            prenom: invite.prenom,
            initiales: initialesDe(invite.prenom),
          },
        ],
      };

      await depot.couples.enregistrer({
        id: coupleId,
        couple,
        // Aucun partage n'est actif à la création : l'opt-in est symétrique et
        // se fait à l'onboarding, des deux côtés.
        partages: Object.fromEntries(
          MODULES_SENSIBLES.map((module) => [
            module,
            creerPartage(module, emetteurId, invite.id, false),
          ]),
        ),
      });

      await depot.invitations.enregistrer({
        ...entree,
        invitation: resultat.invitation,
        coupleId,
      });

      return { ok: true, coupleId };
    },
  };
}
