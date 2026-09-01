/**
 * Exigence 2 — dissociation bilatérale avec notification symétrique.
 *
 * Trois propriétés, dans cet ordre :
 *
 *   1. **Bilatérale.** La coupure vaut pour les deux, immédiatement. Il n'existe
 *      aucun état intermédiaire où celui qui a demandé la séparation
 *      continuerait de voir l'autre.
 *   2. **Symétrique dans l'annonce.** Les deux partenaires sont prévenus, avec
 *      un texte qui décrit le même fait. Une révocation silencieuse pour l'un
 *      serait exactement le mode furtif que les garde-fous interdisent.
 *   3. **Effective sur les données.** Les axes sont détruits, les appareils
 *      déliés, les consentements remis à zéro. Rendre les données orphelines ne
 *      suffit pas : elles resteraient lisibles par une requête oubliée.
 *
 * La catégorie `partage` est impérative dans `deciderRemise` : ni le mode ne pas
 * déranger, ni un réglage « jamais » ne peuvent retenir cette annonce.
 */

import { creerPartage, type PartenaireId } from '@lonlonbenu/shared';
import type { Depot } from '../../domaine/depot.ts';
import { MODULES_SENSIBLES } from '../../domaine/depot.ts';
import type { Expediteur } from '../notifications/expedition.ts';

export interface ResultatDissociation {
  ok: boolean;
  motif?: string;
  dissocieLe?: string;
  /** Toujours deux, une par partenaire. */
  notifies?: readonly PartenaireId[];
}

export interface ServiceDissociation {
  dissocier(
    coupleId: string,
    demandeurId: PartenaireId,
    maintenant?: Date,
  ): Promise<ResultatDissociation>;
}

function texteAnnonce(destinataireEstDemandeur: boolean): string {
  return destinataireEstDemandeur
    ? 'Vous avez séparé vos comptes. Les accès sont coupés des deux côtés.'
    : 'Vos comptes ont été séparés. Les accès sont coupés des deux côtés.';
}

export function creerServiceDissociation(
  depot: Depot,
  expediteur: Expediteur,
): ServiceDissociation {
  return {
    async dissocier(coupleId, demandeurId, maintenant = new Date()) {
      const enregistrement = await depot.couples.parId(coupleId);
      if (!enregistrement) return { ok: false, motif: 'introuvable' };

      const membres = enregistrement.couple.partenaires;
      if (!membres.some((p) => p.id === demandeurId)) {
        return { ok: false, motif: 'non_membre' };
      }
      if (enregistrement.dissocieLe) {
        return { ok: false, motif: 'deja_dissocie' };
      }

      const quand = maintenant.toISOString();
      const [unPartenaire, lAutre] = membres;

      // 1. La coupure d'abord : à partir d'ici, plus aucune lecture ne passe,
      //    même si les étapes suivantes échouaient.
      await depot.couples.enregistrer({
        ...enregistrement,
        dissocieLe: quand,
        partages: Object.fromEntries(
          MODULES_SENSIBLES.map((module) => [
            module,
            creerPartage(module, unPartenaire.id, lAutre.id, false),
          ]),
        ),
      });

      // 2. Les données partagées, détruites plutôt que laissées orphelines.
      await depot.axes.effacerPourCouple(coupleId);
      await depot.cycle.effacerPourCouple(coupleId);
      await depot.confidences.effacerPourCouple(coupleId);
      await depot.chat.effacerPourCouple(coupleId);
      await depot.presence.effacerPourCouple(coupleId);
      await depot.activite.effacerPourCouple(coupleId);
      await depot.souvenirs.effacerPourCouple(coupleId);
      await depot.finances.effacerPourCouple(coupleId);
      await depot.complicite.effacerPourCouple(coupleId);
      await depot.parcours.effacerPourCouple(coupleId);
      await depot.connexion.effacerPourCouple(coupleId);
      await depot.viePratique.effacerPourCouple(coupleId);

      // 3. L'annonce, aux deux. L'expéditeur délie lui-même les appareils une
      //    fois l'annonce réellement partie : les supprimer ici détruirait le
      //    canal avant la livraison si elle est différée par le silence
      //    nocturne, et la personne découvrirait la séparation en trouvant
      //    l'app muette.
      const notifications = await expediteur.publier(
        membres.map((partenaire) => ({
          destinataireId: partenaire.id,
          categorie: 'partage' as const,
          texte: texteAnnonce(partenaire.id === demandeurId),
        })),
        maintenant,
      );

      return {
        ok: true,
        dissocieLe: quand,
        notifies: notifications.map((n) => n.destinataireId),
      };
    },
  };
}
