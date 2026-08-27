/** Aiguillage par plateforme. */
import { describe, expect, it } from 'vitest';
import type { Appareil } from '../../domaine/depot.ts';
import {
  creerTransportFactice,
  creerTransportParPlateforme,
  ErreurPush,
  type MessagePousse,
} from './transport.ts';

const message = (plateforme: Appareil['plateforme']): MessagePousse => ({
  appareil: {
    partenaireId: 'gaelle',
    jetonPush: `jeton-${plateforme}`,
    plateforme,
  },
  titre: 'LONLONBENU',
  corps: 'Quelque chose vous attend.',
  regroupees: 1,
});

describe('creerTransportParPlateforme', () => {
  it('envoie chaque appareil chez son fournisseur', async () => {
    const ios = creerTransportFactice();
    const android = creerTransportFactice();
    const transport = creerTransportParPlateforme({ ios, android });

    await transport.pousser(message('ios'));
    await transport.pousser(message('android'));

    expect(ios.messages.map((m) => m.appareil.jetonPush)).toEqual(['jeton-ios']);
    expect(android.messages.map((m) => m.appareil.jetonPush)).toEqual([
      'jeton-android',
    ]);
  });

  it('échoue franchement plutôt que d’avaler en silence une plateforme non configurée', async () => {
    const transport = creerTransportParPlateforme({
      android: creerTransportFactice(),
    });

    await expect(transport.pousser(message('ios'))).rejects.toBeInstanceOf(
      ErreurPush,
    );
  });
});
