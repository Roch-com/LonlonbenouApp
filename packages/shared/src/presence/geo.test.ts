import { describe, expect, it } from 'vitest';
import {
  dansLeRayon,
  direction,
  distanceEnMetres,
  distanceLisible,
  dureeApprochee,
  pointMilieu,
  type Position,
} from './geo';

const QUAND = '2026-09-01T12:00:00.000Z';
const p = (latitude: number, longitude: number): Position => ({
  latitude,
  longitude,
  releveeLe: QUAND,
});

/** Lomé et Accra : 166,6 km à vol d’oiseau, deux repères du terrain réel. */
const LOME = p(6.1319, 1.2228);
const ACCRA = p(5.6037, -0.187);

describe('distance', () => {
  it('mesure une distance connue à moins de 2 % près', () => {
    const metres = distanceEnMetres(LOME, ACCRA);
    expect(metres).toBeGreaterThan(165_000);
    expect(metres).toBeLessThan(168_000);
  });

  it('rend zéro pour un même point, et reste symétrique', () => {
    expect(distanceEnMetres(LOME, LOME)).toBe(0);
    expect(distanceEnMetres(LOME, ACCRA)).toBeCloseTo(
      distanceEnMetres(ACCRA, LOME),
      6,
    );
  });
});

describe('point de rencontre', () => {
  it('tombe à égale distance des deux', () => {
    const milieu = pointMilieu(LOME, ACCRA);
    const versLome = distanceEnMetres(milieu, LOME);
    const versAccra = distanceEnMetres(milieu, ACCRA);
    expect(Math.abs(versLome - versAccra)).toBeLessThan(50);
  });

  it('ne se trompe pas en traversant le méridien 180°', () => {
    // Moyenner naïvement les longitudes donnerait 0° — à l'exact opposé du
    // globe, ce qui n'est pas un point de rencontre très pratique.
    const milieu = pointMilieu(p(0, 179), p(0, -179));
    expect(Math.abs(milieu.longitude)).toBeGreaterThan(179);
    expect(milieu.latitude).toBeCloseTo(0, 6);
  });

  it('reste dans les bornes acceptées par une carte', () => {
    const milieu = pointMilieu(p(10, 170), p(-10, -170));
    expect(milieu.longitude).toBeGreaterThanOrEqual(-180);
    expect(milieu.longitude).toBeLessThanOrEqual(180);
  });
});

describe('direction', () => {
  it('nomme les quatre points principaux', () => {
    expect(direction(p(0, 0), p(1, 0))).toBe('nord');
    expect(direction(p(0, 0), p(-1, 0))).toBe('sud');
    expect(direction(p(0, 0), p(0, 1))).toBe('est');
    expect(direction(p(0, 0), p(0, -1))).toBe('ouest');
  });

  it('nomme une diagonale', () => {
    expect(direction(p(0, 0), p(1, 1))).toBe('nord-est');
  });
});

describe('durée approchée', () => {
  it('grandit avec la distance et selon le mode', () => {
    expect(dureeApprochee(1000, 'pied')).toBeGreaterThan(
      dureeApprochee(1000, 'voiture'),
    );
    expect(dureeApprochee(10_000)).toBeGreaterThan(dureeApprochee(1000));
  });

  it('n’invente pas de précision au-delà du quart d’heure', () => {
    // Annoncer « 23 min » à partir d'une ligne droite serait une exactitude
    // que le calcul n'a pas.
    for (const metres of [8000, 12_000, 30_000]) {
      expect(dureeApprochee(metres) % 5).toBe(0);
    }
  });

  it('ne descend jamais à zéro', () => {
    expect(dureeApprochee(5, 'pied')).toBeGreaterThanOrEqual(1);
  });
});

describe('rayon', () => {
  it('décide de l’entrée dans un lieu favori', () => {
    const maison = p(6.1319, 1.2228);
    const devantLaPorte = p(6.1320, 1.2229);
    expect(dansLeRayon(devantLaPorte, maison, 100)).toBe(true);
    expect(dansLeRayon(ACCRA, maison, 100)).toBe(false);
  });
});

describe('distance lisible', () => {
  it('ne prétend pas à une précision que le GPS n’a pas', () => {
    expect(distanceLisible(3)).toBe('à quelques pas');
    expect(distanceLisible(90)).toBe('à quelques pas');
    expect(distanceLisible(240)).toBe('à 240 m');
    expect(distanceLisible(2500)).toBe('à 2,5 km');
    expect(distanceLisible(157_000)).toBe('à 157 km');
  });
});
