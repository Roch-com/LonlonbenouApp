/**
 * Planificateur des rappels de la vie pratique.
 *
 * **C'est ici que les rappels vivent désormais, plus dans une boucle mobile.**
 * L'ancienne version tournait tant que l'app était ouverte : un rappel du matin
 * n'arrivait que si quelqu'un ouvrait l'app, c'est-à-dire à peu près jamais au
 * moment utile. Le serveur balaie les couples actifs, quoi que fassent les deux
 * téléphones.
 *
 * Le calcul reste `rappelsDus` du partagé — la même fonction, les mêmes
 * fenêtres, les mêmes clés d'idempotence. Et l'émission passe par
 * `expediteur.publier`, donc par `deciderRemise` : un rappel reste soumis au
 * mode ne pas déranger et aux fréquences choisies, exactement comme s'il venait
 * d'ailleurs. Le planificateur ne s'accorde aucun privilège.
 */

import { rappelsDus } from '@lonlonbenu/shared';
import type { Depot } from '../../domaine/depot.ts';
import type { Expediteur } from '../notifications/expedition.ts';

export interface RapportRappels {
  couplesBalayes: number;
  rappelsEmis: number;
}

/**
 * Un passage complet. Idempotent : les clés déjà émises sont relues avant, et
 * enregistrées après, si bien qu'un balayage toutes les cinq minutes ne redit
 * jamais la même chose.
 */
export async function executerLesRappels(
  depot: Depot,
  expediteur: Expediteur,
  maintenant: Date = new Date(),
): Promise<RapportRappels> {
  const couples = await depot.couples.actifs();
  let emis = 0;

  for (const enregistrement of couples) {
    const [evenements, projets, initiatives, dejaEmis] = await Promise.all([
      depot.viePratique.evenements(enregistrement.id),
      depot.viePratique.projets(enregistrement.id),
      depot.viePratique.initiatives(enregistrement.id),
      depot.viePratique.rappelsEmis(enregistrement.id),
    ]);

    const [a, b] = enregistrement.couple.partenaires;
    const rappels = rappelsDus(
      { evenements, projets, initiatives },
      [a.id, b.id],
      dejaEmis,
      maintenant.toISOString(),
    );
    if (rappels.length === 0) continue;

    // Un rappel s'adresse toujours aux deux : c'est `rappelsDus` qui le décide,
    // et le planificateur se contente de le respecter.
    await expediteur.publier(
      rappels.flatMap((rappel) =>
        rappel.destinataires.map((destinataireId) => ({
          destinataireId,
          categorie: 'rappel' as const,
          texte: rappel.texte,
        })),
      ),
      maintenant,
    );

    await depot.viePratique.noterRappelsEmis(
      enregistrement.id,
      rappels.map((r) => r.cle),
    );
    emis += rappels.length;
  }

  return { couplesBalayes: couples.length, rappelsEmis: emis };
}

/** Intervalle du balayage en production. */
export const INTERVALLE_RAPPELS_MS = 5 * 60_000;

/**
 * Démarre le balayage périodique. Rend une fonction d'arrêt — un serveur qui
 * ne sait pas s'arrêter proprement laisse des minuteries derrière lui.
 */
export function demarrerLePlanificateur(
  depot: Depot,
  expediteur: Expediteur,
  intervalleMs: number = INTERVALLE_RAPPELS_MS,
): () => void {
  const minuterie = setInterval(() => {
    executerLesRappels(depot, expediteur).catch((erreur) => {
      console.error('[rappels] balayage en échec', erreur);
    });
  }, intervalleMs);

  // Ne pas retenir le processus à lui seul.
  minuterie.unref?.();
  return () => clearInterval(minuterie);
}
