/**
 * Pôle ① — notes vocales (§8.3, « messagerie texte, photos, vocaux »).
 *
 * ## Pourquoi la voix tient en base et pas la photo
 *
 * Trente secondes d’Opus à 24 kbit/s pèsent une centaine de kilo-octets. Mille
 * notes vocales tiennent dans une centaine de méga-octets, ce que la base
 * absorbe sans peine — là où quelques vidéos la rempliraient à elles seules.
 *
 * C’est ce qui permet de livrer la voix maintenant, sans attendre le stockage
 * d’objets dont les photos auront besoin. Le plafond de durée n’est pas une
 * limitation arbitraire : c’est ce qui rend le calcul ci-dessus vrai, et il
 * doit être tenu côté serveur.
 *
 * ## Scellée comme le reste
 *
 * L’audio est chiffré sur le téléphone avant l’envoi, exactement comme le
 * texte. Le serveur range une enveloppe dont il ignore le contenu ; il n’en
 * connaît que la durée, qui sert à afficher la barre sans avoir à ouvrir le
 * son.
 *
 * La durée est donc en clair, et c’est un choix : sans elle, l’interface
 * devrait déchiffrer chaque note pour dessiner la liste, y compris celles
 * qu’on ne va pas écouter. Une durée seule ne dit rien de ce qui est dit.
 */

/**
 * Durée maximale d’une note vocale, en secondes.
 *
 * Deux minutes : au-delà, ce n’est plus une note, c’est un monologue qu’on
 * n’écoute pas jusqu’au bout. C’est aussi ce qui garde le poids en base
 * prévisible — voir l’en-tête de ce fichier.
 */
export const DUREE_MAX_VOCAL_S = 120;

/** En deçà, c’est un appui malencontreux sur le bouton, pas une note. */
export const DUREE_MIN_VOCAL_S = 1;

export function dureeVocalValide(secondes: number): boolean {
  return (
    Number.isFinite(secondes) &&
    secondes >= DUREE_MIN_VOCAL_S &&
    secondes <= DUREE_MAX_VOCAL_S
  );
}

/**
 * « 0:07 », « 1:45 ».
 *
 * Les minutes ne sont pas rembourrées, les secondes le sont : c’est la
 * convention de tous les lecteurs, et l’œil y lit la durée sans la déchiffrer.
 */
export function dureeLisible(secondes: number): string {
  const entier = Math.max(0, Math.round(secondes));
  const minutes = Math.floor(entier / 60);
  const reste = entier % 60;
  return `${minutes}:${String(reste).padStart(2, '0')}`;
}

/**
 * Progression d’une lecture, entre 0 et 1.
 *
 * Bornée aux deux extrémités : un lecteur qui rend une position légèrement
 * supérieure à la durée — cela arrive en fin de piste — ne doit pas faire
 * déborder la barre.
 */
export function progressionVocal(position: number, duree: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duree) || duree <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, position / duree));
}
