import { creerPartage, type Couple } from '@lonlonbenu/shared';
import { creerDepotDeTest } from './depotDeTest.ts';
import { MODULES_SENSIBLES } from '../domaine/depot.ts';
import { creerServeur } from '../serveur.ts';
import { creerTransportFactice } from '../modules/notifications/transport.ts';
import {
  AUDIENCE,
  CLES,
  CLIENT_MOBILE,
  EMETTEUR,
  jetonDeTest,
} from './clesDeTest.ts';

export const ROCHAMBEAU = 'rochambeau';
export const GAELLE = 'gaelle';
export const INTRUS = 'intrus';
export const COUPLE_ID = 'rochaelle';

export const COUPLE: Couple = {
  id: COUPLE_ID,
  depuis: '2019-11-23',
  partenaires: [
    { id: ROCHAMBEAU, prenom: 'Rochambeau', initiales: 'R' },
    { id: GAELLE, prenom: 'Gaëlle', initiales: 'G' },
  ],
};

export const CONFIG_OAUTH = {
  emetteur: EMETTEUR,
  audience: AUDIENCE,
  clientsAutorises: [CLIENT_MOBILE],
  clePrivee: CLES.clePrivee,
  clePublique: CLES.clePublique,
};

/**
 * Jetons pré-forgés pour les identités utilisées par les tests. Signer est
 * asynchrone alors que `entete()` est appelé en ligne dans les requêtes : on
 * les prépare une fois, au chargement du module.
 */
const JETONS = new Map<string, string>(
  await Promise.all(
    [ROCHAMBEAU, GAELLE, INTRUS].map(
      async (sub) => [sub, await jetonDeTest(sub)] as const,
    ),
  ),
);

export function jetonPour(partenaireId: string): string {
  const jeton = JETONS.get(partenaireId);
  if (!jeton) {
    throw new Error(
      `Aucun jeton pré-forgé pour « ${partenaireId} » : ajoutez-le dans aide.ts`,
    );
  }
  return jeton;
}

export function entete(partenaireId: string) {
  return { authorization: `Bearer ${jetonPour(partenaireId)}` };
}

/** Serveur de test, avec un couple déjà appairé et le module `croissance` actif. */
export const SECRET_TACHES = 'secret-de-taches';

export async function monterServeur(
  options: { croissanceActive?: boolean; sansSecretTaches?: boolean } = {},
) {
  const depot = await creerDepotDeTest();
  const transport = creerTransportFactice();

  const actif = options.croissanceActive ?? true;
  await depot.couples.enregistrer({
    id: COUPLE_ID,
    couple: COUPLE,
    partages: Object.fromEntries(
      MODULES_SENSIBLES.map((module) => [
        module,
        creerPartage(
          module,
          ROCHAMBEAU,
          GAELLE,
          module === 'croissance' ? actif : false,
        ),
      ]),
    ),
  });

  for (const partenaireId of [ROCHAMBEAU, GAELLE]) {
    await depot.appareils.enregistrer({
      partenaireId,
      jetonPush: `push-${partenaireId}`,
      plateforme: 'android',
    });

    // Le silence nocturne par défaut (22:30–07:30) rendrait le résultat des
    // tests dépendant de l'heure à laquelle on les lance. Les cas qui portent
    // sur le silence le réactivent eux-mêmes.
    const preferences = await depot.notifications.preferences(partenaireId);
    await depot.notifications.definirPreferences(partenaireId, {
      ...preferences,
      silence: { ...preferences.silence, actif: false },
    });
  }

  const serveur = await creerServeur({
    depot,
    transport,
    oauth: CONFIG_OAUTH,
    ...(options.sansSecretTaches ? {} : { secretTaches: SECRET_TACHES }),
  });
  return { ...serveur, depot, transport };
}
