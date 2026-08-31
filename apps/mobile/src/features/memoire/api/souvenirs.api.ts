import type { SorteSouvenir, SouvenirScelle } from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

/**
 * Accès serveur au pôle ⑤.
 *
 * Le contenu voyage scellé : ces fonctions ne voient jamais un titre ni des
 * coordonnées. L'ouverture et le scellement se font dans le store, avec la
 * clé du couple.
 */
export async function listerSouvenirs(
  coupleId: string,
): Promise<SouvenirScelle[]> {
  const { souvenirs } = await appeler<{ souvenirs: SouvenirScelle[] }>(
    `/couples/${coupleId}/souvenirs`,
  );
  return souvenirs;
}

export async function ajouterSouvenirServeur(
  coupleId: string,
  sorte: SorteSouvenir,
  jour: string,
  contenuScelle: string,
): Promise<SouvenirScelle> {
  const { souvenir } = await appeler<{ souvenir: SouvenirScelle }>(
    `/couples/${coupleId}/souvenirs`,
    { methode: 'POST', corps: { sorte, jour, contenuScelle } },
  );
  return souvenir;
}

export function supprimerSouvenirServeur(
  coupleId: string,
  id: string,
): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/souvenirs/${id}`, {
    methode: 'DELETE',
  });
}
