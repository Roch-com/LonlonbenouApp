import { describe, expect, it } from 'vitest';
import { volUnique } from './volUnique';

function differe<T>(): {
  promesse: Promise<T>;
  resoudre: (valeur: T) => void;
  rejeter: (cause: unknown) => void;
} {
  let resoudre!: (valeur: T) => void;
  let rejeter!: (cause: unknown) => void;
  const promesse = new Promise<T>((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  return { promesse, resoudre, rejeter };
}

describe('vol unique', () => {
  it('ne lance qu’une opération pour dix appels simultanés', async () => {
    let appels = 0;
    const attente = differe<string>();
    const operation = volUnique(async () => {
      appels += 1;
      return attente.promesse;
    });

    const demandes = Array.from({ length: 10 }, () => operation());
    attente.resoudre('jeton');

    expect(await Promise.all(demandes)).toEqual(Array(10).fill('jeton'));
    expect(appels).toBe(1);
  });

  it('relance une fois le vol précédent terminé', async () => {
    let appels = 0;
    const operation = volUnique(async () => {
      appels += 1;
      return appels;
    });

    expect(await operation()).toBe(1);
    expect(await operation()).toBe(2);
  });

  it('ne reste pas bloqué après un échec', async () => {
    let appels = 0;
    const operation = volUnique(async () => {
      appels += 1;
      if (appels === 1) throw new Error('réseau');
      return 'ok';
    });

    await expect(operation()).rejects.toThrow('réseau');
    // Sans le `finally`, ce second appel rendrait éternellement la promesse
    // rejetée du premier.
    expect(await operation()).toBe('ok');
  });

  it('propage le même échec à tous les appels concurrents', async () => {
    const attente = differe<string>();
    const operation = volUnique(() => attente.promesse);

    const premier = operation();
    const second = operation();
    attente.rejeter(new Error('session perdue'));

    await expect(premier).rejects.toThrow('session perdue');
    await expect(second).rejects.toThrow('session perdue');
  });
});
