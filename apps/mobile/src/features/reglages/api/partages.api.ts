import type { ModuleSensible } from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export interface EtatPartageServeur {
  module: string;
  actif: boolean;
  monConsentement: boolean;
  consentementDeLautre: boolean;
}

export async function listerPartages(
  coupleId: string,
): Promise<EtatPartageServeur[]> {
  const { partages } = await appeler<{ partages: EtatPartageServeur[] }>(
    `/couples/${coupleId}/partages`,
  );
  return partages;
}

/** On ne bascule que son propre consentement : le serveur ignore tout le reste. */
export async function basculerPartageServeur(
  coupleId: string,
  module: ModuleSensible,
  actif: boolean,
): Promise<EtatPartageServeur> {
  const { partage } = await appeler<{ partage: EtatPartageServeur }>(
    `/couples/${coupleId}/partages/${module}`,
    { methode: 'PUT', corps: { actif } },
  );
  return partage;
}
