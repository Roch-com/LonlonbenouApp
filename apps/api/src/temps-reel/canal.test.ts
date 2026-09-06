/**
 * Le canal temps réel.
 *
 * Ce qui compte ici est le routage : une charge poussée ne doit atteindre que
 * la personne nommée. Une première version des appels diffusait « à tous les
 * sockets ouverts sauf le mien », ce qui fuitait vers les autres couples
 * connectés au même serveur.
 */
import { describe, expect, it } from 'vitest';
import { creerCanalTempsReel } from './canal.ts';

/** Un socket de test, réduit à ce dont le canal se sert. */
function socketFactice(ouvert = true) {
  const envoyes: string[] = [];
  return {
    OPEN: 1,
    readyState: ouvert ? 1 : 3,
    envoyes,
    ferme: undefined as { code: number; raison: string } | undefined,
    send(charge: string) {
      envoyes.push(charge);
    },
    close(code: number, raison: string) {
      this.ferme = { code, raison };
      this.readyState = 3;
    },
  };
}

type Socket = ReturnType<typeof socketFactice>;
const attacher = (
  canal: ReturnType<typeof creerCanalTempsReel>,
  id: string,
  s: Socket,
) => canal.attacher(id, s as never);

describe('routage', () => {
  it('pousse à la personne nommée, et à elle seule', async () => {
    const canal = creerCanalTempsReel();
    const gaelle = socketFactice();
    const rochambeau = socketFactice();
    const ailleurs = socketFactice();

    attacher(canal, 'gaelle', gaelle);
    attacher(canal, 'rochambeau', rochambeau);
    attacher(canal, 'quelquun-dun-autre-couple', ailleurs);

    canal.pousser('rochambeau', { sorte: 'message' });

    expect(rochambeau.envoyes).toHaveLength(1);
    expect(gaelle.envoyes).toHaveLength(0);
    // Le cas qui compte : aucun débordement vers un autre couple.
    expect(ailleurs.envoyes).toHaveLength(0);
  });

  it('rend faux pour quelqu’un qui n’est pas connecté', () => {
    const canal = creerCanalTempsReel();
    expect(canal.pousser('personne', { sorte: 'message' })).toBe(false);
    expect(canal.present('personne')).toBe(false);
  });

  it('rend faux sur un socket fermé', () => {
    const canal = creerCanalTempsReel();
    const mort = socketFactice(false);
    attacher(canal, 'gaelle', mort);

    expect(canal.pousser('gaelle', {})).toBe(false);
    expect(canal.present('gaelle')).toBe(false);
  });
});

describe('remplacement d’une connexion', () => {
  it('ferme la précédente', () => {
    // Un socket resté ouvert après une coupure capterait les messages sans
    // que personne ne les reçoive.
    const canal = creerCanalTempsReel();
    const ancien = socketFactice();
    const nouveau = socketFactice();

    attacher(canal, 'gaelle', ancien);
    attacher(canal, 'gaelle', nouveau);

    expect(ancien.ferme?.raison).toBe('remplace');
    canal.pousser('gaelle', {});
    expect(nouveau.envoyes).toHaveLength(1);
    expect(ancien.envoyes).toHaveLength(0);
  });

  it('ne se ferme pas lui-même si on rattache le même', () => {
    const canal = creerCanalTempsReel();
    const socket = socketFactice();

    attacher(canal, 'gaelle', socket);
    attacher(canal, 'gaelle', socket);

    expect(socket.ferme).toBeUndefined();
    expect(canal.present('gaelle')).toBe(true);
  });
});

describe('détachement', () => {
  it('retire le socket courant', () => {
    const canal = creerCanalTempsReel();
    const socket = socketFactice();
    attacher(canal, 'gaelle', socket);

    canal.detacher('gaelle', socket as never);
    expect(canal.present('gaelle')).toBe(false);
  });

  it('ignore la fermeture tardive d’un socket remplacé', () => {
    // Sans ce garde, la fermeture de l'ancien effacerait le nouveau et la
    // personne cesserait de recevoir sans que rien ne l'explique.
    const canal = creerCanalTempsReel();
    const ancien = socketFactice();
    const nouveau = socketFactice();

    attacher(canal, 'gaelle', ancien);
    attacher(canal, 'gaelle', nouveau);
    canal.detacher('gaelle', ancien as never);

    expect(canal.present('gaelle')).toBe(true);
    canal.pousser('gaelle', {});
    expect(nouveau.envoyes).toHaveLength(1);
  });
});
