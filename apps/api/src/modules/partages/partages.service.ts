/**
 * Consentements réciproques, côté serveur.
 *
 * Sans cet endpoint, la tranche verticale des axes ne peut pas exister : le
 * module `croissance` resterait inactif pour toujours et toute lecture
 * répondrait `partage_inactif`.
 *
 * Comme partout ailleurs, le serveur **rejoue** `basculerConsentement` plutôt
 * que de réécrire la règle. C'est ce qui garantit que les deux notifications
 * symétriques partent aussi côté serveur — un consentement modifié en silence
 * serait le mode furtif que le garde-fou n°3 interdit.
 */

import {
  basculerConsentement,
  creerPartage,
  estPartageActif,
  type ModuleSensible,
  type PartageReciproque,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';
import { MODULES_SENSIBLES } from '../../domaine/depot.ts';
import type { Expediteur } from '../notifications/expedition.ts';

export type RefusPartage =
  'couple_introuvable' | 'non_membre' | 'couple_dissocie' | 'module_inconnu';

export interface EtatPartage {
  module: string;
  actif: boolean;
  /** Mon propre consentement — le seul que je puisse changer. */
  monConsentement: boolean;
  /** Celui de l'autre : lisible, pour qu'on sache où en est le partage. */
  consentementDeLautre: boolean;
}

export interface ServicePartages {
  lister(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{ ok: boolean; motif?: RefusPartage; partages?: EtatPartage[] }>;
  basculer(
    coupleId: string,
    moiId: PartenaireId,
    module: string,
    actif: boolean,
  ): Promise<{ ok: boolean; motif?: RefusPartage; partage?: EtatPartage }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusPartage }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

function versEtat(partage: PartageReciproque, moiId: PartenaireId): EtatPartage {
  const moi = partage.consentements.find((c) => c.partenaireId === moiId);
  const autre = partage.consentements.find((c) => c.partenaireId !== moiId);
  return {
    module: partage.module,
    actif: estPartageActif(partage),
    monConsentement: !!moi?.actif,
    consentementDeLautre: !!autre?.actif,
  };
}

/**
 * Partage existant, ou partage neuf et éteint.
 *
 * `MODULES_SENSIBLES` grandit avec l'application ; les enregistrements de
 * couple, eux, sont figés au moment de l'appairage. Sans cette fonction, tout
 * module ajouté ensuite serait inaccessible aux couples déjà formés — ce qui
 * est exactement arrivé à `activite`.
 *
 * Le partage neuf est éteint des deux côtés : personne n'a consenti à quoi que
 * ce soit en installant une mise à jour.
 */
function partageOuNeuf(
  enregistrement: CoupleServeur,
  module: ModuleSensible,
): PartageReciproque {
  const existant = enregistrement.partages[module];
  if (existant) return existant;

  const [a, b] = enregistrement.couple.partenaires;
  return creerPartage(module, a!.id, b!.id, false);
}

export function creerServicePartages(
  depot: Depot,
  expediteur: Expediteur,
): ServicePartages {
  return {
    async lister(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // La liste des modules fait autorité, pas l'enregistrement du couple.
      // Un couple appairé avant l'ajout d'un module n'a aucune ligne pour lui :
      // s'en tenir à ce qui est stocké le rendait invisible à l'écran, donc
      // impossible à activer — l'interrupteur s'affichait mais restait grisé,
      // faute d'état à montrer.
      return {
        ok: true,
        partages: MODULES_SENSIBLES.map((module) =>
          versEtat(partageOuNeuf(acces.couple, module), lecteurId),
        ),
      };
    },

    async basculer(coupleId, moiId, module, actif) {
      if (!MODULES_SENSIBLES.includes(module as ModuleSensible)) {
        return { ok: false, motif: 'module_inconnu' };
      }

      const acces = await autoriser(depot, coupleId, moiId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      // Créé à la volée s'il manque : un module ajouté après l'appairage doit
      // pouvoir s'activer, sinon il reste mort pour les couples existants.
      const partage = partageOuNeuf(acces.couple, module as ModuleSensible);

      const moi = acces.couple.couple.partenaires.find((p) => p.id === moiId);
      const resultat = basculerConsentement(
        partage,
        moiId,
        actif,
        moi?.prenom ?? '',
      );

      await depot.couples.enregistrer({
        ...acces.couple,
        partages: { ...acces.couple.partages, [module]: resultat.partage },
      });

      // Les deux partenaires sont prévenus. Catégorie impérative : aucun
      // réglage ne peut rendre ce changement silencieux.
      await expediteur.publier(
        resultat.notifications.map((n) => ({
          destinataireId: n.destinataireId,
          categorie: 'partage' as const,
          texte: n.texte,
        })),
      );

      return { ok: true, partage: versEtat(resultat.partage, moiId) };
    },
  };
}
