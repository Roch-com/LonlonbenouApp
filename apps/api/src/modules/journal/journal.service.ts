/**
 * Pôle ⑤ — Journal du couple, côté serveur (§8.17).
 *
 * ## Un service qui ne possède rien
 *
 * Il ne lit que ce que les autres modules détiennent, et n’écrit nulle part.
 * La dissociation n’a donc rien à effacer ici : ce qui disparaît ailleurs
 * disparaît de la frise par construction.
 *
 * ## La moitié que le serveur ne peut pas composer
 *
 * Les souvenirs sont scellés : le serveur n’en connaît que la date. Il rend
 * donc une frise incomplète, et le mobile y ajoute les souvenirs qu’il vient
 * d’ouvrir, en réutilisant `trierJournal` pour que les deux moitiés se rangent
 * selon la même règle.
 *
 * ## Les projets surprise
 *
 * `projetsVisiblesPar` est appliqué **avant** la construction. Un projet
 * surprise terminé mais pas encore révélé n’a rien à faire dans la frise de
 * celui à qui on le prépare — la frise ne doit pas être la fuite par laquelle
 * la surprise s’évente.
 */

import {
  construireJournal,
  parcoursParId,
  projetsVisiblesPar,
  type EntreeJournal,
  type ParcoursAcheve,
  type PartenaireId,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusJournal =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie';

export interface ServiceJournal {
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{
    ok: boolean;
    motif?: RefusJournal;
    entrees?: EntreeJournal[];
  }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusJournal }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceJournal(depot: Depot): ServiceJournal {
  return {
    async lire(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const [projets, axes, initiatives, engages] = await Promise.all([
        depot.viePratique.projets(coupleId),
        depot.axes.parCouple(coupleId),
        depot.viePratique.initiatives(coupleId),
        depot.parcours.engages(coupleId),
      ]);

      // Un parcours n'entre dans la frise que terminé, et son titre vient du
      // catalogue : la base ne stocke que l'identifiant.
      const parcours: ParcoursAcheve[] = [];
      for (const engage of engages) {
        if (!engage.termineLe) continue;
        const definition = parcoursParId(engage.parcoursId);
        if (!definition) continue;
        parcours.push({
          parcoursId: engage.parcoursId,
          titre: definition.titre,
          termineLe: engage.termineLe,
        });
      }

      return {
        ok: true,
        entrees: construireJournal({
          ...(acces.couple.couple.depuis
            ? { depuis: acces.couple.couple.depuis }
            : {}),
          projets: projetsVisiblesPar(projets, lecteurId),
          axes,
          initiatives,
          parcours,
        }),
      };
    },
  };
}
