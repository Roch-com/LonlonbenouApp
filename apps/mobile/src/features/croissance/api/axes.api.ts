/**
 * Accès serveur aux axes de croissance.
 *
 * Le serveur rend des `AxeVisible` **déjà filtrés** : la contribution de
 * l'autre n'est pas dans la réponse tant que le miroir est incomplet. Le
 * client n'a donc plus rien à masquer, et surtout plus rien à oublier de
 * masquer — c'était toute la faiblesse du filtrage local.
 */
import type {
  AxeVisible,
  NiveauImportance,
  ThemeAxe,
} from '@lonlonbenu/shared';
import { appeler } from '@/lib/api/client';

export async function listerAxes(coupleId: string): Promise<AxeVisible[]> {
  const { axes } = await appeler<{ axes: AxeVisible[] }>(
    `/couples/${coupleId}/axes`,
  );
  return axes;
}

export async function ouvrirAxeServeur(
  coupleId: string,
  theme: ThemeAxe,
  titre: string,
  importance?: NiveauImportance,
): Promise<AxeVisible> {
  const { axe } = await appeler<{ axe: AxeVisible }>(`/couples/${coupleId}/axes`, {
    methode: 'POST',
    corps: { theme, titre, ...(importance ? { importance } : {}) },
  });
  return axe;
}

/** Reconnaître un progrès (§8.5). On reconnaît celui de l'autre, jamais le sien. */
export async function reconnaitreProgresServeur(
  coupleId: string,
  axeId: string,
): Promise<AxeVisible> {
  const { axe } = await appeler<{ axe: AxeVisible }>(
    `/couples/${coupleId}/axes/${axeId}/progres`,
    { methode: 'POST' },
  );
  return axe;
}

export async function contribuerServeur(
  coupleId: string,
  axeId: string,
  ressenti: string,
  besoin: string,
): Promise<AxeVisible> {
  const { axe } = await appeler<{ axe: AxeVisible }>(
    `/couples/${coupleId}/axes/${axeId}/contribution`,
    { methode: 'POST', corps: { ressenti, besoin } },
  );
  return axe;
}

export async function cloturerServeur(
  coupleId: string,
  axeId: string,
  cloture: boolean,
): Promise<AxeVisible> {
  const { axe } = await appeler<{ axe: AxeVisible }>(
    `/couples/${coupleId}/axes/${axeId}/cloture`,
    { methode: 'PUT', corps: { cloture } },
  );
  return axe;
}
