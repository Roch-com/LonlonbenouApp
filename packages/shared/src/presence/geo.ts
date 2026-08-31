/**
 * Pôle ① — géométrie de la présence (§8.2 du cahier).
 *
 * ## Pourquoi tout se calcule ici, et non sur le serveur
 *
 * Le §9.5 range la position parmi les données chiffrées de bout en bout. Le
 * serveur ne reçoit donc que des enveloppes : il ne peut ni mesurer une
 * distance, ni proposer un point de rencontre, ni décider qu'on vient
 * d'arriver quelque part. Ces fonctions vivent dans le paquet partagé pour
 * tourner sur l'appareil, après ouverture — c'est la contrepartie directe du
 * chiffrement, et non un choix d'architecture arbitraire.
 *
 * ## Ce qu'on ne fait pas
 *
 * Aucun itinéraire, aucun appel à un service de routage. Une durée de trajet
 * réelle demanderait d'envoyer les deux positions à un tiers, ce qui viderait
 * le chiffrement de son sens. On rend donc une estimation à vol d'oiseau,
 * annoncée comme telle : « environ 20 min » est utile, « 18 min » serait un
 * mensonge précis.
 */

/** Position ouverte, telle qu'elle sort de son enveloppe. */
export interface Position {
  latitude: number;
  longitude: number;
  /** Rayon d'incertitude en mètres, tel que rendu par le téléphone. */
  precisionM?: number;
  /** ISO 8601. */
  releveeLe: string;
}

const RAYON_TERRE_M = 6_371_000;

const versRadians = (degres: number): number => (degres * Math.PI) / 180;
const versDegres = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Distance à vol d'oiseau, en mètres (formule de haversine).
 *
 * La Terre est traitée comme une sphère : l'écart avec l'ellipsoïde réel
 * atteint 0,5 %, soit cinq mètres sur un kilomètre. Aucune décision de ce
 * module ne se joue à cette précision-là.
 */
export function distanceEnMetres(a: Position, b: Position): number {
  const dLat = versRadians(b.latitude - a.latitude);
  const dLon = versRadians(b.longitude - a.longitude);
  const lat1 = versRadians(a.latitude);
  const lat2 = versRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Point de rencontre à mi-chemin (§8.2).
 *
 * Milieu géographique réel, calculé en coordonnées cartésiennes puis reprojeté :
 * moyenner naïvement les longitudes donne un point faux dès qu'on approche du
 * méridien 180°, et franchement absurde en le traversant.
 */
export function pointMilieu(a: Position, b: Position): Position {
  const lat1 = versRadians(a.latitude);
  const lat2 = versRadians(b.latitude);
  const dLon = versRadians(b.longitude - a.longitude);

  const bx = Math.cos(lat2) * Math.cos(dLon);
  const by = Math.cos(lat2) * Math.sin(dLon);

  const latitude = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  );
  const longitude =
    versRadians(a.longitude) + Math.atan2(by, Math.cos(lat1) + bx);

  return {
    latitude: versDegres(latitude),
    // Ramené dans [-180, 180] : au-delà, aucune carte n'accepte le point.
    longitude: ((versDegres(longitude) + 540) % 360) - 180,
    releveeLe: a.releveeLe,
  };
}

export type PointCardinal =
  | 'nord'
  | 'nord-est'
  | 'est'
  | 'sud-est'
  | 'sud'
  | 'sud-ouest'
  | 'ouest'
  | 'nord-ouest';

const CARDINAUX: readonly PointCardinal[] = [
  'nord',
  'nord-est',
  'est',
  'sud-est',
  'sud',
  'sud-ouest',
  'ouest',
  'nord-ouest',
];

/** Direction approximative de `vers` depuis `depuis`. */
export function direction(depuis: Position, vers: Position): PointCardinal {
  const lat1 = versRadians(depuis.latitude);
  const lat2 = versRadians(vers.latitude);
  const dLon = versRadians(vers.longitude - depuis.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const cap = (versDegres(Math.atan2(y, x)) + 360) % 360;
  return CARDINAUX[Math.round(cap / 45) % 8]!;
}

export type ModeDeplacement = 'pied' | 'voiture';

/** Vitesses moyennes en ville, volontairement prudentes. */
const VITESSES_M_PAR_MIN: Record<ModeDeplacement, number> = {
  pied: 75,
  voiture: 400,
};

/**
 * Estimation de durée, à vol d'oiseau. **Ce n'est pas un ETA d'itinéraire.**
 *
 * Le détour réel allonge presque toujours le trajet ; le facteur ci-dessous
 * corrige grossièrement cette sous-estimation systématique. Le résultat est
 * arrondi à cinq minutes au-delà d'un quart d'heure : annoncer « 23 min » à
 * partir d'une ligne droite serait une précision inventée.
 */
const FACTEUR_DETOUR = 1.3;

export function dureeApprochee(
  metres: number,
  mode: ModeDeplacement = 'voiture',
): number {
  const minutes = (metres * FACTEUR_DETOUR) / VITESSES_M_PAR_MIN[mode];
  if (minutes < 15) return Math.max(1, Math.round(minutes));
  return Math.round(minutes / 5) * 5;
}

/** Vrai si la position tombe dans le rayon annoncé autour du centre. */
export function dansLeRayon(
  position: Position,
  centre: Position,
  rayonM: number,
): boolean {
  return distanceEnMetres(position, centre) <= rayonM;
}

/**
 * Distance en toutes lettres, à la précision qu'elle mérite.
 *
 * On ne descend pas sous les dix mètres : le GPS d'un téléphone ne les
 * distingue pas, et afficher « 3 m » laisserait croire à une exactitude que
 * l'appareil n'a pas.
 */
export function distanceLisible(metres: number): string {
  if (metres < 100) return 'à quelques pas';
  if (metres < 1000) return `à ${Math.round(metres / 10) * 10} m`;
  if (metres < 10_000) return `à ${(metres / 1000).toFixed(1).replace('.', ',')} km`;
  return `à ${Math.round(metres / 1000)} km`;
}
