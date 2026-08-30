/**
 * Pôle ③ — Rappels de la vie pratique.
 *
 * Ce module ne notifie rien : il **propose** des rappels. La décision de les
 * transmettre, de les grouper ou de les taire appartient au socle du pôle ⑥
 * (`notifications/preferences.ts`), qui reste le point de passage unique.
 *
 * Deux propriétés, testées :
 *
 *   - **Un rappel s'adresse toujours aux deux.** Le calendrier, les projets et
 *     les sorties sont partagés : il n'y a pas de raison qu'un seul soit
 *     prévenu, et prévenir l'un seulement reviendrait à lui confier la charge.
 *   - **Chaque rappel a une clé d'idempotence.** On ne redit pas deux fois la
 *     même chose : c'est ce qui distingue un rappel utile d'un harcèlement.
 */

import { joursEntre } from '../temps/jours';
import { debutEnMs } from '../calendrier/agenda';
import { jalonFait } from '../projets/avancement';
import type { PartenaireId } from '../types/couple';
import type { Evenement } from '../types/calendrier';
import type { Initiative } from '../types/initiatives';
import type { Projet } from '../types/projets';

export interface RappelPlanifie {
  /** Identifiant stable : un rappel déjà émis ne se réémet pas. */
  cle: string;
  destinataires: readonly PartenaireId[];
  texte: string;
}

export interface SourcesRappel {
  evenements: readonly Evenement[];
  projets: readonly Projet[];
  initiatives: readonly Initiative[];
}

const MS_PAR_HEURE = 3_600_000;

function heureCourte(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function rappelsDus(
  sources: SourcesRappel,
  partenaires: readonly [PartenaireId, PartenaireId],
  dejaEmis: readonly string[],
  maintenant: string = new Date().toISOString(),
): RappelPlanifie[] {
  const instant = Date.parse(maintenant);
  const jour = maintenant.slice(0, 10);
  const emis = new Set(dejaEmis);
  const rappels: RappelPlanifie[] = [];

  const ajouter = (cle: string, texte: string) => {
    if (emis.has(cle)) return;
    emis.add(cle);
    rappels.push({ cle, destinataires: partenaires, texte });
  };

  for (const evenement of sources.evenements) {
    if (evenement.rappelHeures === undefined) continue;

    const debut = debutEnMs(evenement);
    // Horodatage illisible : on ne rappelle rien. `debutEnMs` rend `NaN`, et
    // toute comparaison avec `NaN` étant fausse, la garde ci-dessous ne
    // retenait pas l'événement — elle envoyait le rappel immédiatement.
    if (!Number.isFinite(debut)) continue;

    const seuil = debut - evenement.rappelHeures * MS_PAR_HEURE;
    // Ni trop tôt, ni après coup.
    if (instant < seuil || instant >= debut) continue;

    const quand = evenement.journeeEntiere
      ? ''
      : ` à ${heureCourte(evenement.debut)}`;
    ajouter(
      `evenement:${evenement.id}:${evenement.rappelHeures}`,
      `${evenement.titre}${quand}${evenement.lieu ? ` · ${evenement.lieu}` : ''}`,
    );
  }

  for (const projet of sources.projets) {
    if (projet.archiveLe) continue;

    for (const jalon of projet.jalons) {
      if (jalonFait(jalon) || !jalon.echeance) continue;

      const ecart = joursEntre(jour, jalon.echeance);
      // La veille et le jour même. Au-delà, on n'insiste pas.
      if (ecart !== 0 && ecart !== 1) continue;

      ajouter(
        `jalon:${jalon.id}:${jour}`,
        ecart === 0
          ? `« ${jalon.titre} », c’est pour aujourd’hui — projet ${projet.titre}.`
          : `« ${jalon.titre} », c’est pour demain — projet ${projet.titre}.`,
      );
    }
  }

  for (const initiative of sources.initiatives) {
    if (initiative.etat !== 'prevue' || !initiative.prevuePour) continue;
    if (joursEntre(jour, initiative.prevuePour) !== 0) continue;

    ajouter(
      `initiative:${initiative.id}:${jour}`,
      `C’est aujourd’hui : ${initiative.titre}.`,
    );
  }

  return rappels;
}
