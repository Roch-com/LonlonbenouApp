/**
 * Enregistrement et lecture des notes vocales (§8.3).
 *
 * ## L’audio ne quitte jamais le téléphone en clair
 *
 * Le fichier produit par le micro est lu, encodé en base64, puis **scellé avec
 * la clé du couple** — la même que les messages. Ce qui part sur le réseau est
 * une enveloppe, et le serveur n’en connaît que la durée.
 *
 * À la lecture, le chemin inverse : on ouvre l’enveloppe, on écrit le clair
 * dans un fichier temporaire du cache, et on le donne au lecteur. Ce fichier
 * est le seul endroit où l’audio existe en clair hors mémoire ; il vit dans le
 * cache, que le système efface, et `oublierVocal` permet de le retirer
 * explicitement.
 *
 * ## Pourquoi passer par un fichier plutôt qu’un flux
 *
 * Le lecteur d’`expo-audio` prend une URI, pas un tampon d’octets. Écrire un
 * fichier temporaire est le seul moyen de lui donner du contenu déchiffré sans
 * réécrire un décodeur.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ouvrirMessage, scellerMessage, LONGUEUR_NONCE } from '@lonlonbenu/shared';
import * as Crypto from 'expo-crypto';

/** Dossier des clairs temporaires, dans le cache et non dans les documents. */
const DOSSIER_VOCAL = `${FileSystem.cacheDirectory}vocaux/`;

async function assurerLeDossier(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOSSIER_VOCAL);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOSSIER_VOCAL, { intermediates: true });
  }
}

/**
 * Scelle le fichier enregistré, prêt à partir.
 *
 * Le fichier source est effacé aussitôt : c’est l’enregistrement brut, il n’a
 * aucune raison de rester sur le disque une fois l’enveloppe faite.
 */
export async function scellerEnregistrement(
  cle: Uint8Array,
  uri: string,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const nonce = Crypto.getRandomBytes(LONGUEUR_NONCE);
  const scelle = scellerMessage(cle, nonce, base64);

  // Le brut n'a plus lieu d'être. Un échec d'effacement ne doit pas empêcher
  // l'envoi : le cache sera nettoyé par le système de toute façon.
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);

  return scelle;
}

/**
 * Ouvre une enveloppe audio et rend un chemin lisible par le lecteur.
 *
 * Rend `undefined` si l’enveloppe ne s’ouvre pas avec la clé courante — le
 * même cas que les messages d’avant un changement de clés. L’appelant affiche
 * alors une note illisible plutôt qu’un lecteur qui ne démarre jamais.
 */
export async function ouvrirVocal(
  cle: Uint8Array,
  messageId: string,
  audioScelle: string,
): Promise<string | undefined> {
  const chemin = `${DOSSIER_VOCAL}${messageId}.m4a`;

  // Déjà déchiffré au cours de cette session : on ne recommence pas.
  const info = await FileSystem.getInfoAsync(chemin);
  if (info.exists) return chemin;

  let base64: string;
  try {
    base64 = ouvrirMessage(cle, audioScelle);
  } catch {
    return undefined;
  }

  await assurerLeDossier();
  await FileSystem.writeAsStringAsync(chemin, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return chemin;
}

/** Efface le clair d’une note. Utilisé quand un message est retiré. */
export async function oublierVocal(messageId: string): Promise<void> {
  await FileSystem.deleteAsync(`${DOSSIER_VOCAL}${messageId}.m4a`, {
    idempotent: true,
  }).catch(() => undefined);
}

/**
 * Efface tous les clairs temporaires.
 *
 * Appelé à la dissociation : les enveloppes disparaissent du serveur, mais un
 * fichier déchiffré resté dans le cache survivrait à la séparation.
 */
export async function oublierTousLesVocaux(): Promise<void> {
  await FileSystem.deleteAsync(DOSSIER_VOCAL, { idempotent: true }).catch(
    () => undefined,
  );
}
