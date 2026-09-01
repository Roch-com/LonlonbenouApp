import { describe, expect, it } from 'vitest';
import {
  appelActif,
  dureeAppel,
  DUREE_SONNERIE_S,
  lectureAppel,
  sonnerieExpiree,
  type Appel,
} from './appels';

const MOI = 'rochambeau';
const AUTRE = 'gaelle';
const T0 = '2026-09-01T20:00:00.000Z';

const appel = (reste: Partial<Appel> = {}): Appel => ({
  id: 'a1',
  sorte: 'audio',
  appelantId: MOI,
  etat: 'sonne',
  proposeeLe: T0,
  ...reste,
});

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

describe('état', () => {
  it('reconnaît un appel vivant', () => {
    expect(appelActif(appel())).toBe(true);
    expect(appelActif(appel({ etat: 'en_cours' }))).toBe(true);
    expect(appelActif(appel({ etat: 'termine' }))).toBe(false);
    expect(appelActif(undefined)).toBe(false);
  });
});

describe('sonnerie', () => {
  it('n’expire pas avant le délai', () => {
    expect(sonnerieExpiree(appel(), '2026-09-01T20:00:30.000Z')).toBe(false);
  });

  it('expire au délai', () => {
    const fin = new Date(Date.parse(T0) + DUREE_SONNERIE_S * 1000).toISOString();
    expect(sonnerieExpiree(appel(), fin)).toBe(true);
  });

  it('ne concerne pas un appel décroché', () => {
    const tard = '2026-09-01T21:00:00.000Z';
    expect(sonnerieExpiree(appel({ etat: 'en_cours' }), tard)).toBe(false);
  });

  it('ne se déclenche pas sur une date illisible', () => {
    expect(sonnerieExpiree(appel({ proposeeLe: 'bientôt' }), T0)).toBe(false);
  });
});

describe('durée', () => {
  it('compte à partir du décrochage, pas de la proposition', () => {
    // Sans ça, les secondes de sonnerie compteraient comme de la conversation.
    const a = appel({
      etat: 'termine',
      decrocheLe: '2026-09-01T20:00:10.000Z',
      termineLe: '2026-09-01T20:02:10.000Z',
    });
    expect(dureeAppel(a)).toBe(120);
  });

  it('n’en rend aucune pour un appel jamais décroché', () => {
    const a = appel({ etat: 'termine', termineLe: T0, raison: 'sans_reponse' });
    expect(dureeAppel(a)).toBeUndefined();
  });
});

describe('ce que l’appel laisse dans la conversation', () => {
  it('affiche la durée quand on a parlé', () => {
    const a = appel({
      etat: 'termine',
      decrocheLe: '2026-09-01T20:00:10.000Z',
      termineLe: '2026-09-01T20:01:15.000Z',
      raison: 'raccroche',
    });
    expect(lectureAppel(a, MOI, mmss).detail).toBe('1:05');
  });

  it('distingue la vidéo', () => {
    const a = appel({ sorte: 'video', etat: 'termine', raison: 'refuse' });
    expect(lectureAppel(a, MOI, mmss).titre).toBe('Appel vidéo');
  });

  it('ne reproche rien à celui qui n’a pas répondu', () => {
    const a = appel({ etat: 'termine', raison: 'sans_reponse' });
    // Celui qu'on appelait voit « manqué », pas « vous n'avez pas répondu ».
    expect(lectureAppel(a, AUTRE, mmss).detail).toBe('Appel manqué');
    expect(lectureAppel(a, MOI, mmss).detail).toBe('Sans réponse');
  });

  it('ne dit pas qui a décliné', () => {
    // Celui qui l'a fait le sait ; le rappeler à l'autre n'apporte rien.
    const a = appel({ etat: 'termine', raison: 'refuse' });
    expect(lectureAppel(a, MOI, mmss).detail).toBe('Appel décliné');
    expect(lectureAppel(a, AUTRE, mmss).detail).toBe('Appel décliné');
  });

  it('n’emploie aucun ton culpabilisant', () => {
    const raisons = ['raccroche', 'refuse', 'sans_reponse', 'annule', 'echec_reseau'] as const;
    for (const raison of raisons) {
      for (const qui of [MOI, AUTRE]) {
        const lecture = lectureAppel(appel({ etat: 'termine', raison }), qui, mmss);
        expect(`${lecture.titre} ${lecture.detail ?? ''}`).not.toMatch(
          /ignor|refus\u00e9 de|jamais|toujours|devriez/i,
        );
      }
    }
  });
});
