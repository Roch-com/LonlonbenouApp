/**
 * Accès serveur à la vie pratique.
 *
 * Tout part et revient en clair : ces données sont `couple` par construction,
 * il n'y a rien à filtrer ni à sceller. Le serveur pose la visibilité et
 * n'accepte pas qu'on la lui dicte.
 */
import type {
  CategorieEvenement,
  CategorieSortie,
  Evenement,
  Initiative,
  Projet,
} from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export interface VueViePratiqueServeur {
  evenements: Evenement[];
  projets: Projet[];
  initiatives: Initiative[];
}

export function lireViePratique(coupleId: string): Promise<VueViePratiqueServeur> {
  return appeler<VueViePratiqueServeur>(`/couples/${coupleId}/vie-pratique`);
}

export interface BrouillonEvenement {
  titre: string;
  categorie: CategorieEvenement;
  debut: string;
  fin?: string;
  journeeEntiere: boolean;
  lieu?: string;
  note?: string;
  rappelHeures?: number;
}

export function ajouterEvenementServeur(
  coupleId: string,
  brouillon: BrouillonEvenement,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/evenements`, {
    methode: 'POST',
    corps: brouillon,
  });
}

export function supprimerEvenementServeur(
  coupleId: string,
  id: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/evenements/${id}`, {
    methode: 'DELETE',
  });
}

export function creerProjetServeur(
  coupleId: string,
  titre: string,
  intention?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/projets`, {
    methode: 'POST',
    corps: { titre, intention },
  });
}

export function ajouterJalonServeur(
  coupleId: string,
  projetId: string,
  titre: string,
  echeance?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/projets/${projetId}/jalons`, {
    methode: 'POST',
    corps: { titre, echeance },
  });
}

export function cocherJalonServeur(
  coupleId: string,
  projetId: string,
  jalonId: string,
): Promise<unknown> {
  return appeler(
    `/couples/${coupleId}/vie-pratique/projets/${projetId}/jalons/${jalonId}`,
    { methode: 'PUT' },
  );
}

export function archiverProjetServeur(
  coupleId: string,
  projetId: string,
  archive: boolean,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/projets/${projetId}/archive`, {
    methode: 'PUT',
    corps: { archive },
  });
}

export function proposerInitiativeServeur(
  coupleId: string,
  titre: string,
  categorie: CategorieSortie,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/initiatives`, {
    methode: 'POST',
    corps: { titre, categorie },
  });
}

export function programmerInitiativeServeur(
  coupleId: string,
  id: string,
  prevuePour: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/initiatives/${id}`, {
    methode: 'PUT',
    corps: { action: 'programmer', prevuePour },
  });
}

export function vivreInitiativeServeur(
  coupleId: string,
  id: string,
  souvenir?: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/initiatives/${id}`, {
    methode: 'PUT',
    corps: { action: 'vivre', souvenir },
  });
}

export function supprimerInitiativeServeur(
  coupleId: string,
  id: string,
): Promise<unknown> {
  return appeler(`/couples/${coupleId}/vie-pratique/initiatives/${id}`, {
    methode: 'DELETE',
  });
}
