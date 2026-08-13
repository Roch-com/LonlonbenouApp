import { describe, expect, it } from 'vitest';
import {
  AVERTISSEMENT_MEDICAL,
  PHASES,
  RAPPEL_AU_PARTENAIRE,
  SYMPTOMES,
  type NiveauCycle,
  type Regles,
} from '../types/cycle';
import { etatDuCycle } from './calcul';
import { vuePartenaire } from './partenaire';

const MAINTENANT = '2026-03-15T12:00:00.000Z';

const regles = (debutLe: string): Regles => ({
  id: debutLe,
  debutLe,
  saisiLe: `${debutLe}T08:00:00.000Z`,
});

/** Cycle de 28 jours démarré le 15 mars : jour 1, phase menstruelle. */
const etatMenstruel = etatDuCycle([regles('2026-03-15')], MAINTENANT);
/** Jour 10 : phase folliculaire. */
const etatFolliculaire = etatDuCycle([regles('2026-03-06')], MAINTENANT);

const TOUS_NIVEAUX: NiveauCycle[] = ['aucun', 'discret', 'phases', 'complet'];

describe('respect strict du niveau', () => {
  it('ne laisse rien filtrer au niveau « aucun »', () => {
    const vue = vuePartenaire(etatMenstruel, 'aucun');
    expect(vue.partage).toBe(false);
    expect(JSON.stringify(vue)).not.toContain('menstruelle');
  });

  it('ne rend rien non plus quand il n’y a aucune donnée', () => {
    expect(vuePartenaire(undefined, 'phases').partage).toBe(false);
  });

  it('ne nomme aucune phase au niveau discret', () => {
    const vue = vuePartenaire(etatMenstruel, 'discret');
    const contenu = JSON.stringify(vue);

    for (const phase of PHASES) {
      expect(contenu).not.toContain(phase.code);
      expect(contenu).not.toContain(phase.libelle);
    }
  });

  it('n’allume son signal que sur les jours qui le méritent', () => {
    const pendantLesRegles = vuePartenaire(etatMenstruel, 'discret');
    const enPleinCycle = vuePartenaire(etatFolliculaire, 'discret');

    expect(pendantLesRegles).toMatchObject({ jourAttentionne: true });
    expect(enPleinCycle).toMatchObject({ jourAttentionne: false });
  });

  it('donne la phase et des gestes concrets au niveau « phases »', () => {
    const vue = vuePartenaire(etatFolliculaire, 'phases');
    expect(vue).toMatchObject({ niveau: 'phases', phase: 'folliculaire' });
    if (vue.niveau === 'phases') {
      expect(vue.attentions.length).toBeGreaterThan(0);
    }
  });

  it('traite « complet » comme le niveau 2 tant que le niveau 3 n’est pas ouvert', () => {
    // Sous-partager est une erreur réparable ; l'inverse ne l'est pas.
    expect(vuePartenaire(etatFolliculaire, 'complet')).toEqual(
      vuePartenaire(etatFolliculaire, 'phases'),
    );
  });
});

describe('rien de personnel ne sort, quel que soit le niveau', () => {
  it('ne laisse jamais passer un symptôme ni une date', () => {
    for (const niveau of TOUS_NIVEAUX) {
      const contenu = JSON.stringify(vuePartenaire(etatMenstruel, niveau));

      for (const symptome of SYMPTOMES) {
        expect(contenu).not.toContain(symptome.libelle);
        expect(contenu).not.toContain(symptome.code);
      }
      // Aucune date, ni saisie ni prévue.
      expect(contenu).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      // Ni le jour du cycle, qui reconstituerait les dates.
      expect(contenu).not.toContain('jourDuCycle');
    }
  });
});

describe('langage d’accompagnement, jamais clinique', () => {
  const vocabulaireClinique = [
    'symptôme',
    'diagnostic',
    'traitement',
    'pathologi',
    'trouble',
    'hormone',
    'fertil',
    'syndrome',
    'prémenstruel',
    'sécrétion',
    'muqueuse',
  ];

  const interpretations = [
    'irritab',
    'susceptible',
    'à cause de',
    'c’est normal qu’',
    'elle sera',
    'son humeur',
    'ses sautes',
  ];

  const textesPartenaire = [
    ...PHASES.map((p) => p.lecturePartenaire),
    ...PHASES.flatMap((p) => [...p.attentions]),
    RAPPEL_AU_PARTENAIRE,
  ];

  it('n’emploie aucun terme clinique', () => {
    for (const texte of textesPartenaire) {
      for (const terme of vocabulaireClinique) {
        expect(texte.toLowerCase()).not.toContain(terme);
      }
    }
  });

  it('n’interprète jamais son comportement', () => {
    for (const texte of textesPartenaire) {
      for (const terme of interpretations) {
        expect(texte.toLowerCase()).not.toContain(terme);
      }
    }
  });

  it('parle des jours, pas de la personne', () => {
    // Aucune lecture ne prétend dire comment elle va : le sujet grammatical
    // est la période, jamais elle.
    for (const phase of PHASES) {
      expect(phase.lecturePartenaire.toLowerCase()).not.toContain('elle');
    }
  });

  it('propose des gestes, pas des explications', () => {
    for (const phase of PHASES) {
      expect(phase.attentions.length).toBeGreaterThan(0);
      for (const attention of phase.attentions) {
        expect(attention.toLowerCase()).not.toContain('parce que');
      }
    }
  });

  it('rappelle au partenaire de ne rien attribuer au cycle', () => {
    expect(RAPPEL_AU_PARTENAIRE).toContain('demandez-lui');
    expect(RAPPEL_AU_PARTENAIRE.toLowerCase()).toContain('jamais');
  });

  it('accompagne toujours la vue partagée de ce rappel', () => {
    for (const niveau of ['discret', 'phases'] as const) {
      const vue = vuePartenaire(etatMenstruel, niveau);
      expect(vue.partage && vue.rappel).toBe(RAPPEL_AU_PARTENAIRE);
    }
  });
});

describe('avertissement destiné à la personne concernée', () => {
  it('dit clairement que ce n’est ni médical ni contraceptif', () => {
    const texte = AVERTISSEMENT_MEDICAL.toLowerCase();
    expect(texte).toContain('estimations');
    expect(texte).toContain('avis médical');
    expect(texte).toContain('contraception');
  });
});
