/**
 * Appliquer le schéma sans faire mourir le serveur si la base est absente.
 *
 * Le démarrage attendait la base : `await appliquerLeSchema(pool)` avant tout
 * le reste. Le jour où Neon a refusé ses connexions — quota du palier gratuit
 * épuisé —, le processus n'a plus pu démarrer du tout. On a donc perdu en même
 * temps l'application **et** tout moyen de savoir pourquoi : plus de `/sante`,
 * plus de `/sante/base`, plus de journal. Une panne de base était devenue une
 * panne totale et muette.
 *
 * Ici, une base injoignable n'empêche plus de monter. Le serveur répond, dit
 * ce qui ne va pas, et réessaie seul. Le jour où la base revient — quota remis
 * à zéro, plan changé, hébergeur rétabli —, l'application repart d'elle-même,
 * sans que personne ait à redéployer.
 *
 * Une migration fautive, en revanche, fait toujours mourir le processus : ce
 * n'est pas un état passager, et la réessayer en boucle ne ferait que cacher
 * un défaut qu'il faut voir.
 */
import type { Pool } from 'pg';
import { appliquerLeSchema } from './migrations.ts';
import { causeIndisponibilite } from './disponibilite.ts';

/** Attentes entre deux essais. On s'espace, puis on tient la minute. */
export const ATTENTES_MS = [5_000, 15_000, 30_000, 60_000] as const;

export interface EtatBase {
  /** Vrai une fois le schéma appliqué. Les routes qui lisent la base en dépendent. */
  prete: boolean;
  /** Le nom de la dernière cause d'indisponibilité, s'il y en a une. */
  cause?: string;
}

/**
 * Applique le schéma, et réessaie en tâche de fond tant que la base est
 * seulement indisponible. Rend l'état, qu'on peut consulter à tout moment.
 */
export function preparerLaBase(
  pool: Pool,
  options: {
    attentes?: readonly number[];
    dormir?: (ms: number) => Promise<void>;
    journal?: Pick<Console, 'log' | 'error'>;
    /**
     * L'application du schéma. Injectable pour que les tests décrivent une
     * base qui refuse puis revient, sans avoir à imiter les rouages de `pg`.
     */
    appliquer?: (pool: Pool) => Promise<void>;
  } = {},
): { etat: EtatBase; premierEssai: Promise<void> } {
  const attentes = options.attentes ?? ATTENTES_MS;
  const dormir =
    options.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const journal = options.journal ?? console;
  const appliquer = options.appliquer ?? appliquerLeSchema;

  const etat: EtatBase = { prete: false };

  async function essayer(rang: number): Promise<void> {
    try {
      await appliquer(pool);
      etat.prete = true;
      delete etat.cause;
      journal.log(
        rang === 0
          ? 'Schéma appliqué.'
          : `Schéma appliqué après ${rang + 1} essais — la base est revenue.`,
      );
      return;
    } catch (erreur) {
      const cause = causeIndisponibilite(erreur);
      // Pas une indisponibilité : c'est la migration qui est fautive, et
      // aucune attente n'y changera rien.
      if (!cause) throw erreur;

      etat.cause = cause;
      const attente = attentes[Math.min(rang, attentes.length - 1)] ?? 60_000;
      journal.error(
        `Base indisponible (${cause}). Le serveur démarre quand même ; ` +
          `nouvel essai dans ${attente / 1000} s. Voir /sante/base.`,
      );
      await dormir(attente);
      return essayer(rang + 1);
    }
  }

  // Le premier essai est rendu pour que les tests l'attendent ; en production
  // on ne le retient pas, c'est tout l'objet de la manœuvre.
  return { etat, premierEssai: essayer(0) };
}
