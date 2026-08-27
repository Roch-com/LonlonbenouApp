/**
 * Normalisation des cles PEM venues de l'environnement.
 *
 * Une cle PEM est multiligne, ce qu'aucun des supports habituels ne transporte
 * proprement : un fichier `.env` ne connait pas les sauts de ligne, et le
 * formulaire d'un hebergeur les avale ou les conserve selon les cas. La
 * convention est donc d'echapper les retours en antislash-n litteraux - mais
 * rien ne garantit que la valeur recue l'ait ete.
 *
 * On accepte les deux formes. C'est trois lignes de code contre une classe
 * entiere de deploiements qui echouent sur un `error:1E08010C: unsupported`,
 * message qui ne dit rien de la cause reelle.
 */
export function normaliserPem(valeur: string): string {
  const sansGuillemets = valeur.trim().replace(/^"(.*)"$/s, '$1');
  return sansGuillemets.includes('\\n')
    ? sansGuillemets.replace(/\\n/g, '\n')
    : sansGuillemets;
}
