/**
 * Accès serveur au chat.
 *
 * Aucune de ces fonctions ne manipule de texte en clair : elles échangent des
 * enveloppes scellées. Le chiffrement et le déchiffrement ont lieu dans le
 * store, avec une clé que le serveur n'a jamais vue.
 */
import { appeler } from '@/lib/api/client';

export interface MessageScelle {
  id: string;
  auteurId: string;
  enveloppe: string;
  envoyeLe: string;
  luLe?: string;
}

export interface ClesDuCouple {
  mienne?: string;
  autre?: string;
  echangePret: boolean;
}

export async function publierClePublique(
  coupleId: string,
  clePublique: string,
): Promise<ClesDuCouple> {
  const { cles } = await appeler<{ cles: ClesDuCouple }>(
    `/couples/${coupleId}/chat/cle`,
    { methode: 'PUT', corps: { clePublique } },
  );
  return cles;
}

export async function lireCles(coupleId: string): Promise<ClesDuCouple> {
  const { cles } = await appeler<{ cles: ClesDuCouple }>(
    `/couples/${coupleId}/chat/cles`,
  );
  return cles;
}

export async function listerMessages(coupleId: string): Promise<MessageScelle[]> {
  const { messages } = await appeler<{ messages: MessageScelle[] }>(
    `/couples/${coupleId}/chat`,
  );
  return messages;
}

export async function envoyerEnveloppe(
  coupleId: string,
  enveloppe: string,
): Promise<MessageScelle> {
  const { message } = await appeler<{ message: MessageScelle }>(
    `/couples/${coupleId}/chat`,
    { methode: 'POST', corps: { enveloppe } },
  );
  return message;
}

export function marquerLusServeur(coupleId: string): Promise<void> {
  return appeler<void>(`/couples/${coupleId}/chat/lecture`, { methode: 'PUT' });
}
