/**
 * Pôle ⑥ — Nom de l'espace du couple.
 *
 * Le nom n'est pas un détail décoratif : c'est la première chose que le couple
 * fabrique ensemble dans l'app, et il s'affiche partout ensuite. On propose des
 * mélanges des deux prénoms — « Rochambeau » + « Gaëlle » donne « Rochaelle » —
 * sans jamais imposer : le champ libre reste maître.
 */

const LONGUEUR_MIN = 2;
const LONGUEUR_MAX = 24;

const VOYELLES = 'aeiouyàâäéèêëîïôöùûü';

function sansAccents(mot: string): string {
  return mot.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function capitaliser(mot: string): string {
  return mot.length === 0 ? mot : mot[0]!.toUpperCase() + mot.slice(1);
}

function positionsVoyelles(mot: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < mot.length; i++) {
    if (VOYELLES.includes(mot[i]!.toLowerCase())) positions.push(i);
  }
  return positions;
}

/**
 * Position de la n-ième voyelle (1 = la première), ou de la dernière
 * disponible sur un prénom trop court. C'est la charnière du mélange : couper
 * à la deuxième voyelle donne « Rocha » + « elle », là où couper à la dernière
 * donnerait « Rochambea » + « aëlle ».
 */
function charniere(mot: string, rang: number): number {
  const positions = positionsVoyelles(mot);
  if (positions.length === 0) return -1;
  return positions[Math.min(rang, positions.length) - 1]!;
}

/** Une jonction est ratée si elle empile trois voyelles ou triple une lettre. */
function jonctionAcceptable(candidat: string): boolean {
  const lettres = [...candidat.toLowerCase()];
  let voyellesDeSuite = 0;

  for (let i = 0; i < lettres.length; i++) {
    voyellesDeSuite = VOYELLES.includes(lettres[i]!) ? voyellesDeSuite + 1 : 0;
    if (voyellesDeSuite >= 3) return false;
    if (i >= 2 && lettres[i] === lettres[i - 1] && lettres[i] === lettres[i - 2]) {
      return false;
    }
  }
  return true;
}

/** « Rochambeau » + « Gaëlle » → « Rochaelle ». */
function melanger(debut: string, fin: string): string | undefined {
  const a = sansAccents(debut);
  const b = sansAccents(fin);

  const coupeA = charniere(a, 2);
  const coupeB = charniere(b, 2);
  if (coupeA < 0 || coupeB < 0) return undefined;

  const candidat = capitaliser(a.slice(0, coupeA + 1) + b.slice(coupeB));
  return jonctionAcceptable(candidat) && candidat.length >= LONGUEUR_MIN
    ? candidat
    : undefined;
}

/**
 * Propositions de noms d'espace à partir des deux prénoms.
 * Toujours au moins une proposition, même sur des prénoms courts ou exotiques.
 */
export function propositionsNomEspace(prenomA: string, prenomB: string): string[] {
  const a = prenomA.trim();
  const b = prenomB.trim();
  if (!a || !b) return [];

  const propositions: string[] = [];

  for (const melange of [melanger(a, b), melanger(b, a)]) {
    if (melange) propositions.push(melange);
  }

  propositions.push(`${capitaliser(a)} & ${capitaliser(b)}`);
  propositions.push('Notre espace');

  // Dédoublonnage insensible aux accents et à la casse, ordre préservé.
  const vus = new Set<string>();
  return propositions.filter((p) => {
    const cle = sansAccents(p).toLowerCase();
    if (vus.has(cle) || p.length > LONGUEUR_MAX) return false;
    vus.add(cle);
    return true;
  });
}

export interface ControleNom {
  valide: boolean;
  message?: string;
}

export function controlerNomEspace(nom: string): ControleNom {
  const propre = nom.trim();
  if (propre.length < LONGUEUR_MIN) {
    return { valide: false, message: 'Un nom un peu plus long, même court.' };
  }
  if (propre.length > LONGUEUR_MAX) {
    return {
      valide: false,
      message: `${LONGUEUR_MAX} caractères au maximum, pour qu’il tienne à l’écran.`,
    };
  }
  return { valide: true };
}
