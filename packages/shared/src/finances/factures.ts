/**
 * Pôle ③ — Factures communes récurrentes (§8.11).
 *
 * « Rappels de factures communes et alertes douces de dépassement de budget. »
 *
 * ## Ce que le serveur sait, et ce qu’il ne saura pas
 *
 * Il connaît une **échéance** et une **périodicité**, en clair : sans elles, il
 * ne saurait pas quand rappeler. Le libellé et le montant restent scellés,
 * comme toute donnée financière du module.
 *
 * La conséquence est assumée : le rappel ne peut pas nommer la facture. Il dit
 * qu’une échéance approche, et l’application montre laquelle une fois ouverte.
 * L’alternative aurait été de stocker le libellé en clair pour faire une plus
 * jolie notification — c’est-à-dire d’échanger l’exigence de chiffrement du
 * §8.11 contre du confort d’affichage.
 *
 * ## L’écueil des fins de mois
 *
 * Une facture au 31 janvier ne tombe pas le 31 février. Les échéances se
 * calculent à partir du quantième d’origine, ramené au dernier jour du mois
 * quand il n’existe pas — et le quantième d’origine est **conservé**, pour
 * qu’une facture du 31 ne devienne pas une facture du 28 après un passage en
 * février.
 */

import { joursEntre } from '../temps/jours';
import type { PartenaireId } from '../types/couple';

export type Periodicite = 'mensuelle' | 'trimestrielle' | 'annuelle';

export interface DefinitionPeriodicite {
  code: Periodicite;
  libelle: string;
  /** Pas en mois. Une année vaut douze. */
  mois: number;
}

export const PERIODICITES: readonly DefinitionPeriodicite[] = [
  { code: 'mensuelle', libelle: 'Tous les mois', mois: 1 },
  { code: 'trimestrielle', libelle: 'Tous les trimestres', mois: 3 },
  { code: 'annuelle', libelle: 'Tous les ans', mois: 12 },
] as const;

export function definitionPeriodicite(
  code: Periodicite,
): DefinitionPeriodicite {
  const trouve = PERIODICITES.find((p) => p.code === code);
  if (!trouve) throw new Error(`Périodicité inconnue : ${code}`);
  return trouve;
}

/** Ce que le serveur détient : une échéance, une cadence, une enveloppe. */
export interface FactureScellee {
  id: string;
  /** `YYYY-MM-DD` — la première échéance ; les suivantes s’en déduisent. */
  premiereEcheance: string;
  periodicite: Periodicite;
  /** `m1.<nonce>.<scellé>` : libellé et montant. */
  contenuScelle: string;
  creePar: PartenaireId;
  creeLe: string;
  /**
   * Facture arrêtée. On n’efface pas : les dépenses passées y renvoient, et
   * une facture supprimée les rendrait orphelines.
   */
  arreteeLe?: string;
}

/** Le clair, tel qu’il n’existe que sur les téléphones. */
export interface ContenuFacture {
  libelle: string;
  /** En unités mineures, comme toutes les sommes du module. */
  montant: number;
}

export interface Facture extends Omit<FactureScellee, 'contenuScelle'> {
  contenu: ContenuFacture;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Dernier jour d’un mois donné, années bissextiles comprises. */
function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
}

/**
 * L’échéance à `n` périodes de la première.
 *
 * Le quantième d’origine est réappliqué à chaque fois, jamais reporté depuis
 * l’échéance précédente : sans cela, une facture du 31 tomberait au 28 dès
 * qu’elle croise un février, et y resterait pour toujours.
 */
function echeanceNumero(
  premiereEcheance: string,
  periodicite: Periodicite,
  n: number,
): string | undefined {
  if (!FORMAT_JOUR.test(premiereEcheance)) return undefined;

  const annee = Number(premiereEcheance.slice(0, 4));
  const mois = Number(premiereEcheance.slice(5, 7)) - 1;
  const quantieme = Number(premiereEcheance.slice(8, 10));
  if (!Number.isFinite(annee) || !Number.isFinite(mois)) return undefined;

  const pas = definitionPeriodicite(periodicite).mois;
  const total = mois + n * pas;
  const anneeCible = annee + Math.floor(total / 12);
  const moisCible = ((total % 12) + 12) % 12;

  const jour = Math.min(
    quantieme,
    dernierJourDuMois(anneeCible, moisCible),
  );
  return `${String(anneeCible).padStart(4, '0')}-${String(moisCible + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/**
 * La prochaine échéance à partir d’un jour donné, incluse.
 *
 * Rend `undefined` pour une facture arrêtée ou une date illisible : une
 * facture qu’on ne sait pas dater ne doit rien déclencher.
 */
export function prochaineEcheance(
  facture: Pick<
    FactureScellee,
    'premiereEcheance' | 'periodicite' | 'arreteeLe'
  >,
  jour: string,
): string | undefined {
  if (facture.arreteeLe) return undefined;
  if (!FORMAT_JOUR.test(jour)) return undefined;

  const premiere = echeanceNumero(
    facture.premiereEcheance,
    facture.periodicite,
    0,
  );
  if (!premiere) return undefined;
  if (premiere >= jour) return premiere;

  // Estimation directe plutôt qu'itération : une facture mensuelle créée il y
  // a dix ans demanderait cent-vingt tours pour rien.
  const pas = definitionPeriodicite(facture.periodicite).mois;
  const moisEcoules =
    (Number(jour.slice(0, 4)) - Number(premiere.slice(0, 4))) * 12 +
    (Number(jour.slice(5, 7)) - Number(premiere.slice(5, 7)));
  const depart = Math.max(0, Math.floor(moisEcoules / pas));

  // Deux tours de sécurité : le quantième ramené en fin de mois peut décaler
  // l'estimation d'une période dans un sens comme dans l'autre.
  for (let n = Math.max(0, depart - 1); n <= depart + 2; n += 1) {
    const candidate = echeanceNumero(
      facture.premiereEcheance,
      facture.periodicite,
      n,
    );
    if (candidate && candidate >= jour) return candidate;
  }
  return undefined;
}

/** Combien de jours avant l’échéance on prévient. */
export const PREAVIS_JOURS = 3;

export interface RappelFacture {
  cle: string;
  factureId: string;
  echeance: string;
  /** Jours restants : 0 le jour même. */
  dans: number;
}

/**
 * Les factures dont l’échéance approche.
 *
 * Une seule alerte par échéance, la clé le garantit — un rappel répété chaque
 * jour pendant trois jours ne rappelle plus rien, il agace.
 */
export function facturesAVenir(
  factures: readonly Pick<
    FactureScellee,
    'id' | 'premiereEcheance' | 'periodicite' | 'arreteeLe'
  >[],
  jour: string,
): RappelFacture[] {
  const rappels: RappelFacture[] = [];

  for (const facture of factures) {
    const echeance = prochaineEcheance(facture, jour);
    if (!echeance) continue;

    const dans = joursEntre(jour, echeance);
    if (dans < 0 || dans > PREAVIS_JOURS) continue;

    rappels.push({
      cle: `facture:${facture.id}:${echeance}`,
      factureId: facture.id,
      echeance,
      dans,
    });
  }

  return rappels.sort((a, b) => a.echeance.localeCompare(b.echeance));
}

/**
 * Le texte du rappel.
 *
 * Il ne nomme pas la facture : le serveur ne l’a jamais lue. Il ne reproche
 * rien non plus — une échéance qui approche est une information, pas une
 * sommation.
 */
export function texteRappelFacture(dans: number): string {
  if (dans === 0) return 'Une facture commune arrive à échéance aujourd’hui.';
  if (dans === 1) return 'Une facture commune arrive à échéance demain.';
  return `Une facture commune arrive à échéance dans ${dans} jours.`;
}
