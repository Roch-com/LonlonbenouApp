import { describe, expect, it } from 'vitest';
import { estimer } from './calcul';
import {
  fenetreFertile,
  lectureFertilite,
  RESERVE_FERTILITE,
} from './fertilite';
import type { Regles } from '../types/cycle';

/** Un cycle de 28 jours annoncé : l'ovulation tombe au jour 14. */
const estimations = estimer([], 28);

const regles = (dates: string[]): Regles[] =>
  dates.map((debutLe, i) => ({
    id: `r${i}`,
    debutLe,
    saisiLe: `${debutLe}T08:00:00.000Z`,
  }));

describe('fenêtre fertile', () => {
  it('s’ouvre bien avant l’ovulation', () => {
    // Les spermatozoïdes survivent jusqu'à cinq jours : une fenêtre qui
    // commencerait le jour de l'ovulation raterait l'essentiel.
    const fenetre = fenetreFertile('2026-09-01', estimations);
    expect(fenetre.ovulation).toBe('2026-09-14');
    expect(fenetre.debut).toBe('2026-09-09');
    expect(fenetre.fin).toBe('2026-09-15');
  });

  it('suit la durée annoncée du cycle', () => {
    // Un cycle de 32 jours ovule plus tard : la phase lutéale est constante,
    // c'est la première partie qui s'allonge.
    const long = fenetreFertile('2026-09-01', estimer([], 32));
    expect(long.ovulation).toBe('2026-09-18');
  });

  it('ne casse pas sur un cycle très court', () => {
    const court = fenetreFertile('2026-09-01', estimer([], 21));
    expect(court.debut < court.ovulation).toBe(true);
    expect(court.ovulation < court.fin).toBe(true);
  });
});

describe('lecture', () => {
  const AVANT = '2026-09-05T12:00:00.000Z';
  const DEDANS = '2026-09-11T12:00:00.000Z';
  const APRES = '2026-09-20T12:00:00.000Z';

  it('situe le cycle par rapport à la fenêtre', () => {
    expect(lectureFertilite('2026-09-01', estimations, AVANT).position).toBe(
      'avant',
    );
    expect(lectureFertilite('2026-09-01', estimations, DEDANS).position).toBe(
      'dedans',
    );
    expect(lectureFertilite('2026-09-01', estimations, APRES).position).toBe(
      'apres',
    );
  });

  it('ne dit jamais qu’un jour est perdu', () => {
    // Un couple qui essaie vit déjà avec assez de calendriers ; « aujourd'hui
    // c'est raté » ajouterait une pression à une période qui n'en manque pas.
    for (const quand of [AVANT, DEDANS, APRES]) {
      const lecture = lectureFertilite('2026-09-01', estimations, quand).lecture;
      expect(lecture).not.toMatch(/rat[ée]|manqu|perdu|trop tard|dommage/i);
    }
  });

  it('ne donne aucune consigne', () => {
    // « C'est le moment » se lit comme un ordre.
    const lecture = lectureFertilite('2026-09-01', estimations, DEDANS).lecture;
    expect(lecture).not.toMatch(/c’est le moment|profitez|essayez|il faut/i);
    expect(lecture).toBe('Vous êtes dans la fenêtre estimée de ce cycle.');
  });

  it('accompagne toujours l’estimation de sa réserve', () => {
    for (const quand of [AVANT, DEDANS, APRES]) {
      expect(lectureFertilite('2026-09-01', estimations, quand).reserve).toBe(
        RESERVE_FERTILITE,
      );
    }
  });

  it('ne présente jamais la fenêtre comme fiable', () => {
    expect(RESERVE_FERTILITE).toMatch(/marge de plusieurs jours/);
    expect(RESERVE_FERTILITE).toMatch(/ne remplace ni un avis médical/);
  });

  it('accorde le singulier de la veille', () => {
    expect(
      lectureFertilite('2026-09-01', estimations, '2026-09-08T12:00:00.000Z')
        .lecture,
    ).toBe('La fenêtre estimée commence demain.');
  });
});

describe('avec de vraies règles saisies', () => {
  it('se cale sur les cycles observés à défaut de durée annoncée', () => {
    // Deux cycles de 30 jours : l'ovulation se décale au jour 16.
    const observees = estimer(regles(['2026-07-01', '2026-07-31', '2026-08-30']));
    expect(fenetreFertile('2026-08-30', observees).ovulation).toBe('2026-09-14');
  });
});
