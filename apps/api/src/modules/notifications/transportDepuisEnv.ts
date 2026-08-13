/**
 * Assemblage du transport à partir de l'environnement.
 *
 * Chaque plateforme se configure indépendamment : on peut très bien démarrer
 * avec Android seul le temps d'obtenir les clés Apple. Ce qui n'est pas
 * configuré n'est pas monté, et un envoi vers cette plateforme échouera de
 * façon visible plutôt que de disparaître.
 */

import { creerTransportParPlateforme, type Transport } from './transport.ts';
import { creerTransportFcm } from './transportFcm.ts';
import { creerTransportApns } from './transportApns.ts';

export interface RapportTransport {
  transport: Transport;
  /** Plateformes réellement gréées, pour le journal de démarrage. */
  plateformes: ('ios' | 'android')[];
}

/**
 * Les clés PEM passent mal dans un `.env` : on accepte les `\n` littéraux
 * autant que les vrais sauts de ligne.
 */
function pem(valeur: string): string {
  return valeur.includes('\\n') ? valeur.replace(/\\n/g, '\n') : valeur;
}

export function creerTransportDepuisEnv(
  env: NodeJS.ProcessEnv = process.env,
): RapportTransport {
  const adaptateurs: { ios?: Transport; android?: Transport } = {};
  const plateformes: ('ios' | 'android')[] = [];

  const projetId = env['LONLONBENU_FCM_PROJET_ID'];
  const courriel = env['LONLONBENU_FCM_COURRIEL_COMPTE_SERVICE'];
  const cleFcm = env['LONLONBENU_FCM_CLE_PRIVEE_PEM'];
  if (projetId && courriel && cleFcm) {
    adaptateurs.android = creerTransportFcm({
      projetId,
      courrielCompteService: courriel,
      clePriveePem: pem(cleFcm),
    });
    plateformes.push('android');
  }

  const cleP8 = env['LONLONBENU_APNS_CLE_P8'];
  const idCle = env['LONLONBENU_APNS_ID_CLE'];
  const idEquipe = env['LONLONBENU_APNS_ID_EQUIPE'];
  const sujet = env['LONLONBENU_APNS_SUJET'];
  if (cleP8 && idCle && idEquipe && sujet) {
    adaptateurs.ios = creerTransportApns({
      cleP8: pem(cleP8),
      idCle,
      idEquipe,
      sujet,
      // Le bac à sable est le défaut : pousser un build de développement vers
      // la production Apple échoue silencieusement, et on cherche longtemps.
      production: env['LONLONBENU_APNS_PRODUCTION'] === 'true',
    });
    plateformes.push('ios');
  }

  return { transport: creerTransportParPlateforme(adaptateurs), plateformes };
}
