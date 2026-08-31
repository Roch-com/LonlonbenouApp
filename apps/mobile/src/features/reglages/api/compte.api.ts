import { appeler } from '@/lib/api/client';

/** Ce que le serveur rend : voir `compte.service.ts` pour ce qu'il omet. */
export interface ExportServeur {
  genere_le: string;
  compte: { id: string; courriel: string };
  couple?: unknown;
  chat_scelle: { id: string; auteurId: string; enveloppe: string; envoyeLe: string }[];
  confidences: unknown[];
  axes: unknown[];
  vie_pratique: unknown;
  presence?: unknown;
  cycle?: unknown;
  notifications: unknown[];
}

export function demanderExport(): Promise<ExportServeur> {
  return appeler<ExportServeur>('/moi/export');
}

/**
 * La confirmation en toutes lettres est exigée par le serveur aussi : une
 * requête déclenchée par erreur ne doit pas suffire à effacer un compte.
 */
export function supprimerLeCompte(): Promise<void> {
  return appeler<void>('/moi', {
    methode: 'DELETE',
    corps: { confirmation: 'SUPPRIMER' },
  });
}
