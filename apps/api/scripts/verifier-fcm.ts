/**
 * Vérification des identifiants FCM, sans appareil.
 *
 * Deux choses à prouver :
 *   1. le compte de service obtient bien un jeton d'accès chez Google ;
 *   2. l'API Cloud Messaging accepte nos envois.
 *
 * On pousse vers un jeton d'appareil volontairement faux : si Google répond
 * « ce jeton n'existe pas », c'est que tout le reste — authentification,
 * projet, permissions — est bon.
 */
import { creerTransportFcm } from '../src/modules/notifications/transportFcm.ts';
import { ErreurPush } from '../src/modules/notifications/transport.ts';

const projetId = process.env['LONLONBENU_FCM_PROJET_ID'];
const courriel = process.env['LONLONBENU_FCM_COURRIEL_COMPTE_SERVICE'];
const cle = process.env['LONLONBENU_FCM_CLE_PRIVEE_PEM'];

if (!projetId || !courriel || !cle) {
  console.error('Variables LONLONBENU_FCM_* absentes.');
  process.exit(1);
}

console.log(`Projet  : ${projetId}`);
console.log(`Compte  : ${courriel}`);

const transport = creerTransportFcm({
  projetId,
  courrielCompteService: courriel,
  clePriveePem: cle.includes('\\n') ? cle.replace(/\\n/g, '\n') : cle,
});

try {
  await transport.pousser({
    appareil: {
      partenaireId: 'verification',
      jetonPush: 'jeton-volontairement-invalide-pour-verification',
      plateforme: 'android',
    },
    titre: 'LONLONBENU',
    corps: 'Quelque chose vous attend.',
    regroupees: 1,
  });
  console.log('\nEnvoi accepté — inattendu avec un faux jeton, mais tout marche.');
} catch (erreur) {
  if (erreur instanceof ErreurPush && erreur.jetonInvalide) {
    console.log('\n✅ Identifiants valides.');
    console.log('   Google a authentifié le compte de service et rejeté le');
    console.log(`   faux jeton d'appareil, comme attendu : ${erreur.message}`);
    process.exit(0);
  }
  console.log('\n❌ Échec :', (erreur as Error).message);
  if (erreur instanceof ErreurPush) {
    console.log(`   statut ${erreur.statut}, réessayable : ${erreur.reessayable}`);
  }
  process.exit(1);
}
