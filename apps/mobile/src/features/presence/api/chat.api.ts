/**
 * Accès serveur au chat.
 *
 * Aucune de ces fonctions ne manipule de texte en clair : elles échangent des
 * enveloppes scellées. Le chiffrement et le déchiffrement ont lieu dans le
 * store, avec une clé que le serveur n'a jamais vue.
 */
import { appeler } from '@/lib/api/client';

export interface ReactionScellee {
  partenaireId: string;
  emojiScelle: string;
  majLe: string;
}

export interface MessageScelle {
  id: string;
  auteurId: string;
  enveloppe: string;
  envoyeLe: string;
  luLe?: string;
  /** Message retiré par son auteur : l'enveloppe ne contient plus rien. */
  retireLe?: string;
  reactions?: ReactionScellee[];
}

export interface EpingleServeur {
  messageId: string;
  epinglePar: string;
  epingleLe: string;
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

/** Retire un message pour les deux. Seul son auteur le peut. */
export async function retirerMessageServeur(
  coupleId: string,
  id: string,
): Promise<MessageScelle> {
  const { message } = await appeler<{ message: MessageScelle }>(
    `/couples/${coupleId}/chat/messages/${id}`,
    { methode: 'DELETE' },
  );
  return message;
}

/** Pose ou remplace sa réaction. Sans emoji, elle est retirée. */
export async function reagirServeur(
  coupleId: string,
  id: string,
  emojiScelle?: string,
): Promise<MessageScelle> {
  const { message } = await appeler<{ message: MessageScelle }>(
    `/couples/${coupleId}/chat/messages/${id}/reaction`,
    { methode: 'PUT', corps: emojiScelle ? { emojiScelle } : {} },
  );
  return message;
}

export async function lireEpingleServeur(
  coupleId: string,
): Promise<EpingleServeur | undefined> {
  const { epingle } = await appeler<{ epingle: EpingleServeur | null }>(
    `/couples/${coupleId}/chat/epingle`,
  );
  return epingle ?? undefined;
}

/** Épingle un message, ou décroche l'épingle si `messageId` est absent. */
export async function epinglerServeur(
  coupleId: string,
  messageId?: string,
): Promise<EpingleServeur | undefined> {
  const { epingle } = await appeler<{ epingle: EpingleServeur | null }>(
    `/couples/${coupleId}/chat/epingle`,
    { methode: 'PUT', corps: messageId ? { messageId } : {} },
  );
  return epingle ?? undefined;
}
