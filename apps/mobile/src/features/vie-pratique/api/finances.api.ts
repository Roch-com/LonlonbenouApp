import { appeler } from '@/lib/api/client';

/** Réglages du module, tels que le serveur les détient. */
export interface ReglagesFinancesServeur {
  actif: boolean;
  devise: string;
  /** Parts de répartition, scellées : elles disent les revenus de chacun. */
  reglesScellees?: string;
  majLe: string;
}

/** Une dépense côté serveur : une enveloppe et une date, rien d'autre. */
export interface DepenseScellee {
  id: string;
  jour: string;
  contenuScelle: string;
  creePar: string;
  creeLe: string;
}

/** Une facture côté serveur : une échéance, une cadence, une enveloppe. */
export interface FactureScelleeServeur {
  id: string;
  premiereEcheance: string;
  periodicite: 'mensuelle' | 'trimestrielle' | 'annuelle';
  contenuScelle: string;
  creePar: string;
  creeLe: string;
  arreteeLe?: string;
}

/** L'enveloppe d'un projet. Le montant est scellé comme le reste. */
export interface BudgetProjetScelleServeur {
  projetId: string;
  montantScelle: string;
  majLe: string;
}

export interface VueFinancesServeur {
  reglages: ReglagesFinancesServeur;
  depenses: DepenseScellee[];
  factures: FactureScelleeServeur[];
  budgets: BudgetProjetScelleServeur[];
}

export function lireFinances(coupleId: string): Promise<VueFinancesServeur> {
  return appeler<VueFinancesServeur>(`/couples/${coupleId}/finances`);
}

export async function definirReglagesServeur(
  coupleId: string,
  modifications: {
    actif?: boolean;
    devise?: string;
    /** `null` efface les règles et revient au partage égal. */
    reglesScellees?: string | null;
  },
): Promise<ReglagesFinancesServeur> {
  const { reglages } = await appeler<{ reglages: ReglagesFinancesServeur }>(
    `/couples/${coupleId}/finances/reglages`,
    { methode: 'PUT', corps: modifications },
  );
  return reglages;
}

export function ajouterDepenseServeur(
  coupleId: string,
  jour: string,
  contenuScelle: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/finances/depenses`, {
    methode: 'POST',
    corps: { jour, contenuScelle },
  });
}

export function supprimerDepenseServeur(
  coupleId: string,
  id: string,
): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/finances/depenses/${id}`, {
    methode: 'DELETE',
  });
}

export function ajouterFactureServeur(
  coupleId: string,
  premiereEcheance: string,
  periodicite: string,
  contenuScelle: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/finances/factures`, {
    methode: 'POST',
    corps: { premiereEcheance, periodicite, contenuScelle },
  });
}

/** Arrêt, jamais suppression : des dépenses passées renvoient à la facture. */
export function arreterFactureServeur(
  coupleId: string,
  id: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/finances/factures/${id}/arreter`, {
    methode: 'POST',
  });
}

export function definirBudgetServeur(
  coupleId: string,
  projetId: string,
  montantScelle: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/finances/budgets/${projetId}`, {
    methode: 'PUT',
    corps: { montantScelle },
  });
}

export function supprimerBudgetServeur(
  coupleId: string,
  projetId: string,
): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/finances/budgets/${projetId}`, {
    methode: 'DELETE',
  });
}
