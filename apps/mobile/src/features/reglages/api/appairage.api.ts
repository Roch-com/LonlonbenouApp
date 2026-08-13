import { appeler } from '@/lib/api/client';

export interface InvitationEmise {
  invitationId: string;
  /** Rendu une seule fois par le serveur : à transmettre, pas à conserver. */
  code: string;
  codeFormate: string;
  expireDansSecondes: number;
}

export async function emettreInvitation(prenom: string): Promise<InvitationEmise> {
  return appeler<InvitationEmise>('/appairages', {
    methode: 'POST',
    corps: { prenom },
  });
}

export async function accepterInvitation(
  invitationId: string,
  code: string,
  prenom: string,
): Promise<{ coupleId: string }> {
  return appeler<{ coupleId: string }>(`/appairages/${invitationId}/acceptation`, {
    methode: 'POST',
    corps: { code, prenom },
  });
}
