/**
 * La propriété qui compte : on ne voit l'activité de l'autre qu'en montrant
 * la sienne. Aucune combinaison de réglages ne doit permettre l'inverse.
 */
import { describe, expect, it } from 'vitest';
import {
  activiteVisible,
  FENETRE_SAISIE_MS,
  finDeSaisie,
  SEUIL_EN_LIGNE_MS,
  type ActiviteBrute,
} from './activite';

const MAINTENANT = '2026-08-30T12:00:00.000Z';
const ilYA = (ms: number) =>
  new Date(Date.parse(MAINTENANT) - ms).toISOString();

const brute = (partiel: Partial<ActiviteBrute> = {}): ActiviteBrute => ({
  partenaireId: 'gaelle',
  vuLe: ilYA(1_000),
  ...partiel,
});

describe('réciprocité', () => {
  it('ne rend rien tant que le partage n’est pas actif des deux côtés', () => {
    // Pas même « hors ligne » : ce serait déjà une information.
    expect(activiteVisible(brute(), false, MAINTENANT)).toBeUndefined();
  });

  it('ne rend rien non plus quand l’autre n’a jamais été vu', () => {
    expect(activiteVisible(undefined, true, MAINTENANT)).toBeUndefined();
  });
});

describe('en ligne', () => {
  it('l’est juste avant le seuil, plus après', () => {
    const juste = activiteVisible(
      brute({ vuLe: ilYA(SEUIL_EN_LIGNE_MS - 1) }),
      true,
      MAINTENANT,
    );
    expect(juste?.enLigne).toBe(true);

    const apres = activiteVisible(
      brute({ vuLe: ilYA(SEUIL_EN_LIGNE_MS + 1) }),
      true,
      MAINTENANT,
    );
    expect(apres?.enLigne).toBe(false);
  });

  it('ne donne l’heure de dernière visite que hors ligne', () => {
    // Afficher les deux inviterait à comparer l'heure de la dernière visite
    // à celle du dernier message envoyé.
    expect(activiteVisible(brute(), true, MAINTENANT)?.vuLe).toBeUndefined();

    const parti = brute({ vuLe: ilYA(SEUIL_EN_LIGNE_MS * 3) });
    expect(activiteVisible(parti, true, MAINTENANT)?.vuLe).toBe(parti.vuLe);
  });
});

describe('saisie', () => {
  it('s’éteint toute seule à l’échéance', () => {
    // Un booléen resterait vrai pour toujours si l'appareil se tait.
    const encours = brute({ saisitJusqua: new Date(
      Date.parse(MAINTENANT) + 1_000,
    ).toISOString() });
    expect(activiteVisible(encours, true, MAINTENANT)?.ecrit).toBe(true);

    const perimee = brute({ saisitJusqua: ilYA(1) });
    expect(activiteVisible(perimee, true, MAINTENANT)?.ecrit).toBe(false);
  });

  it('ne survit pas à la déconnexion', () => {
    // Quelqu'un qui n'est plus là n'écrit pas, même si sa dernière frappe
    // déclarait une fenêtre encore ouverte.
    const partiEnEcrivant = brute({
      vuLe: ilYA(SEUIL_EN_LIGNE_MS * 2),
      saisitJusqua: new Date(Date.parse(MAINTENANT) + 60_000).toISOString(),
    });
    const vue = activiteVisible(partiEnEcrivant, true, MAINTENANT);
    expect(vue?.enLigne).toBe(false);
    expect(vue?.ecrit).toBe(false);
  });

  it('déclare une fenêtre à venir', () => {
    expect(Date.parse(finDeSaisie(MAINTENANT))).toBe(
      Date.parse(MAINTENANT) + FENETRE_SAISIE_MS,
    );
  });
});

describe('robustesse', () => {
  it('ne lève pas sur un horodatage illisible', () => {
    expect(
      activiteVisible(brute({ vuLe: 'pas une date' }), true, MAINTENANT),
    ).toBeUndefined();
  });
});
