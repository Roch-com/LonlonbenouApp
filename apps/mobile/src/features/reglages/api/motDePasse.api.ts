import { appeler } from '@/lib/api/client';

/**
 * Demande un code de réinitialisation.
 *
 * Le serveur répond toujours de la même façon, que le compte existe ou non :
 * l'écran ne peut donc pas — et ne doit pas — dire à qui l'utilise si l'adresse
 * saisie correspond à un compte.
 */
export async function demanderUnCode(courriel: string): Promise<string> {
  const { message } = await appeler<{ message: string }>(
    '/mot-de-passe/demandes',
    { methode: 'POST', corps: { courriel } },
  );
  return message;
}

/** Confirme le code et pose le nouveau mot de passe. */
export async function reinitialiserLeMotDePasse(
  code: string,
  motDePasse: string,
): Promise<string> {
  const { message } = await appeler<{ message: string }>(
    '/mot-de-passe/reinitialisations',
    { methode: 'POST', corps: { code, motDePasse } },
  );
  return message;
}
