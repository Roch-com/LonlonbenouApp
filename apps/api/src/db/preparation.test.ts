/**
 * Le démarrage face à une base absente.
 *
 * Écrit après la panne où le quota Neon épuisé a empêché le serveur de
 * démarrer : on a perdu l'application *et* tout moyen de diagnostiquer, parce
 * que le schéma s'appliquait avant que quoi que ce soit ne réponde.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { preparerLaBase } from './preparation.ts';

const MUET = { log: () => undefined, error: () => undefined };

const POOL = {} as unknown as Pool;

/** Une application de schéma qui échoue `n` fois, puis passe. */
function appliqueApres(echecs: number, code = '53000') {
  let appels = 0;
  return vi.fn(async () => {
    appels += 1;
    if (appels <= echecs) {
      throw Object.assign(new Error('quota dépassé'), { code });
    }
  });
}

describe('préparer la base', () => {
  it('rend la main tout de suite quand la base répond', async () => {
    const { etat, premierEssai } = preparerLaBase(POOL, {
      appliquer: appliqueApres(0),
      journal: MUET,
    });
    await premierEssai;
    expect(etat.prete).toBe(true);
    expect(etat.cause).toBeUndefined();
  });

  it('ne meurt pas si la base est indisponible, et nomme la cause', async () => {
    const { etat, premierEssai } = preparerLaBase(POOL, {
      appliquer: appliqueApres(2),
      attentes: [0],
      dormir: async () => undefined,
      journal: MUET,
    });
    await premierEssai;
    expect(etat.prete).toBe(true);
  });

  it('se relève seul dès que la base revient', async () => {
    const appliquer = appliqueApres(3);
    const { etat, premierEssai } = preparerLaBase(POOL, {
      appliquer,
      attentes: [0],
      dormir: async () => undefined,
      journal: MUET,
    });

    await premierEssai;
    expect(etat.prete).toBe(true);
    // Trois refus puis le passage : quatre appels, sans redéploiement.
    expect(appliquer.mock.calls.length).toBe(4);
  });

  it('meurt sur une migration fautive, au lieu de la réessayer sans fin', async () => {
    // 42601 : erreur de syntaxe. Aucune attente n'y changera rien.
    const appliquer = vi.fn(async () => {
      throw Object.assign(new Error('syntax error'), { code: '42601' });
    });

    const { premierEssai } = preparerLaBase(POOL, {
      appliquer,
      attentes: [0],
      dormir: async () => undefined,
      journal: MUET,
    });
    await expect(premierEssai).rejects.toThrow('syntax error');
    expect(appliquer.mock.calls.length).toBe(1);
  });

  it('porte la cause tant que la base manque', async () => {
    let debloquer: (() => void) | undefined;
    const barriere = new Promise<void>((r) => {
      debloquer = r;
    });

    const { etat, premierEssai } = preparerLaBase(POOL, {
      appliquer: appliqueApres(1),
      attentes: [0],
      dormir: async () => barriere,
      journal: MUET,
    });

    await vi.waitFor(() => expect(etat.cause).toBe('quota_depasse'));
    expect(etat.prete).toBe(false);
    debloquer?.();
    await premierEssai;
    expect(etat.prete).toBe(true);
  });
});
