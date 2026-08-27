import { describe, expect, it } from 'vitest';
import { ajouterJours } from '../temps/jours';
import { GESTES, type Geste, type TypeGeste } from './gestes';
import * as moduleScore from './score';
import {
  FENETRE_JOURS,
  LIBELLES_BANDE,
  monElan,
  scoreDuCouple,
  suggestionsPrivees,
} from './score';

const ROCHAMBEAU = 'rochambeau';
const GAELLE = 'gaelle';
const COUPLE = [ROCHAMBEAU, GAELLE] as const;
const MAINTENANT = '2026-03-15T12:00:00.000Z';

/** Un geste posé il y a `recul` jours. */
const geste = (auteurId: string, type: TypeGeste, recul: number): Geste => ({
  auteurId,
  type,
  faitLe: `${ajouterJours(MAINTENANT, -recul)}T09:00:00.000Z`,
});

const score = (gestes: Geste[]) => scoreDuCouple(gestes, COUPLE, MAINTENANT);

describe('ce n’est jamais une note d’une personne', () => {
  it('n’expose aucune fonction de score individuel ni de classement', () => {
    const interdits = /individuel|classement|palmares|comparer|meilleur/i;
    const exports = Object.keys(moduleScore);

    expect(exports.filter((nom) => interdits.test(nom))).toEqual([]);
    // Le score de couple ne prend pas de lecteur : impossible d'en servir deux
    // versions différentes.
    expect(scoreDuCouple.length).toBeLessThanOrEqual(4);
  });

  it('donne le même score quel que soit l’ordre des partenaires', () => {
    const gestes = [
      geste(ROCHAMBEAU, 'message', 1),
      geste(GAELLE, 'gratitude', 2),
      geste(ROCHAMBEAU, 'check_in', 3),
    ];

    expect(scoreDuCouple(gestes, [ROCHAMBEAU, GAELLE], MAINTENANT)).toEqual(
      scoreDuCouple(gestes, [GAELLE, ROCHAMBEAU], MAINTENANT),
    );
  });

  it('ne fait peser aucun geste plus qu’un autre', () => {
    const avecMessage = score([geste(ROCHAMBEAU, 'message', 0)]);
    const avecLettre = score([geste(ROCHAMBEAU, 'lettre', 0)]);

    expect(avecMessage.valeur).toBe(avecLettre.valeur);
  });

  it('ne se gonfle pas à coups de volume', () => {
    const unSeul = score([geste(ROCHAMBEAU, 'message', 0)]);
    const cinquante = score(
      Array.from({ length: 50 }, () => geste(ROCHAMBEAU, 'message', 0)),
    );

    expect(cinquante.valeur).toBe(unSeul.valeur);
  });
});

describe('composantes du score de couple', () => {
  it('mesure la régularité en jours vivants, pas en nombre de gestes', () => {
    const troisJours = score([
      geste(ROCHAMBEAU, 'message', 0),
      geste(ROCHAMBEAU, 'message', 1),
      geste(ROCHAMBEAU, 'message', 2),
    ]);

    expect(troisJours.joursVivants).toBe(3);
    expect(
      troisJours.composantes.find((c) => c.code === 'regularite')?.valeur,
    ).toBe(Math.round((3 / FENETRE_JOURS) * 100));
  });

  it('met l’élan partagé à zéro quand un seul agit, à cent quand les rythmes se valent', () => {
    const seul = score([
      geste(ROCHAMBEAU, 'message', 0),
      geste(ROCHAMBEAU, 'message', 1),
    ]);
    const aDeux = score([
      geste(ROCHAMBEAU, 'message', 0),
      geste(ROCHAMBEAU, 'message', 1),
      geste(GAELLE, 'humeur', 0),
      geste(GAELLE, 'humeur', 1),
    ]);

    expect(seul.composantes.find((c) => c.code === 'elan_partage')?.valeur).toBe(0);
    expect(aDeux.composantes.find((c) => c.code === 'elan_partage')?.valeur).toBe(
      100,
    );
  });

  it('ignore ce qui est sorti de la fenêtre', () => {
    const vieux = score([geste(ROCHAMBEAU, 'message', FENETRE_JOURS + 1)]);
    expect(vieux.valeur).toBe(0);
    expect(vieux.bande).toBe('silencieux');
  });

  it('reste à zéro sans jamais reprocher le silence', () => {
    const vide = score([]);
    expect(vide.valeur).toBe(0);
    expect(vide.libelle).toBe(LIBELLES_BANDE.silencieux);
    expect(vide.libelle).toContain('dans l’app');
  });
});

describe('élan personnel : je me compare à moi, jamais à l’autre', () => {
  const monRetrait = [
    geste(ROCHAMBEAU, 'humeur', 15),
    geste(ROCHAMBEAU, 'humeur', 17),
    geste(ROCHAMBEAU, 'humeur', 19),
    geste(ROCHAMBEAU, 'humeur', 21),
    geste(ROCHAMBEAU, 'message', 2),
  ];

  it('détecte mon retrait par rapport à mon propre passé', () => {
    const elan = monElan(monRetrait, ROCHAMBEAU, MAINTENANT);
    expect(elan.joursActifs).toBe(1);
    expect(elan.joursActifsAvant).toBe(4);
    expect(elan.tendance).toBe('en_retrait');
  });

  it('ne bouge pas d’un iota quand l’activité de l’autre change', () => {
    const avecGaelleTresActive = [
      ...monRetrait,
      ...Array.from({ length: 12 }, (_, i) => geste(GAELLE, 'message', i)),
    ];

    expect(monElan(avecGaelleTresActive, ROCHAMBEAU, MAINTENANT)).toEqual(
      monElan(monRetrait, ROCHAMBEAU, MAINTENANT),
    );
  });

  it('reste stable quand rien ne change vraiment', () => {
    const constant = [geste(GAELLE, 'message', 1), geste(GAELLE, 'message', 15)];
    expect(monElan(constant, GAELLE, MAINTENANT).tendance).toBe('stable');
  });
});

describe('suggestions privées', () => {
  const monRetrait = [
    geste(ROCHAMBEAU, 'humeur', 15),
    geste(ROCHAMBEAU, 'humeur', 17),
    geste(ROCHAMBEAU, 'humeur', 19),
    geste(ROCHAMBEAU, 'humeur', 21),
    geste(ROCHAMBEAU, 'message', 2),
  ];

  it('ne dit rien tant que je ne me suis pas retiré', () => {
    const stable = [geste(GAELLE, 'message', 1), geste(GAELLE, 'message', 15)];
    expect(suggestionsPrivees(stable, GAELLE, MAINTENANT)).toEqual([]);

    const enHausse = [
      geste(GAELLE, 'message', 0),
      geste(GAELLE, 'message', 1),
      geste(GAELLE, 'message', 2),
      geste(GAELLE, 'message', 20),
    ];
    expect(suggestionsPrivees(enHausse, GAELLE, MAINTENANT)).toEqual([]);
  });

  it('ne relance jamais un couple simplement peu actif depuis toujours', () => {
    expect(suggestionsPrivees([], ROCHAMBEAU, MAINTENANT)).toEqual([]);
  });

  it('propose au plus deux gestes, et les plus légers d’abord', () => {
    const suggestions = suggestionsPrivees(monRetrait, ROCHAMBEAU, MAINTENANT);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.geste)).toEqual(['note_douce', 'gratitude']);
    // Un axe de croissance n'est pas ce qu'on propose à quelqu'un qui s'éloigne.
    expect(suggestions.map((s) => s.geste)).not.toContain('axe_ouvert');
  });

  it('ne propose pas un geste encore frais', () => {
    const suggestions = suggestionsPrivees(monRetrait, ROCHAMBEAU, MAINTENANT);
    // « message » date de 2 jours : il n'a pas à être relancé.
    expect(suggestions.map((s) => s.geste)).not.toContain('message');
  });

  it('ne dépend en rien de ce que fait ou ne fait pas l’autre', () => {
    const sansGaelle = suggestionsPrivees(monRetrait, ROCHAMBEAU, MAINTENANT);

    const gaelleAbsente = suggestionsPrivees(monRetrait, ROCHAMBEAU, MAINTENANT);
    const gaelleDebordante = suggestionsPrivees(
      [
        ...monRetrait,
        ...Array.from({ length: 14 }, (_, i) => geste(GAELLE, 'gratitude', i)),
      ],
      ROCHAMBEAU,
      MAINTENANT,
    );

    expect(gaelleAbsente).toEqual(sansGaelle);
    expect(gaelleDebordante).toEqual(sansGaelle);
  });

  it('ne suggère rien à celui qui n’a pas décroché, même si l’autre a décroché', () => {
    // Rochambeau se retire, Gaëlle tient son rythme : c'est à lui que la
    // suggestion s'adresse, jamais à elle.
    const gestes = [
      ...monRetrait,
      geste(GAELLE, 'message', 1),
      geste(GAELLE, 'message', 15),
    ];

    expect(suggestionsPrivees(gestes, GAELLE, MAINTENANT)).toEqual([]);
    expect(
      suggestionsPrivees(gestes, ROCHAMBEAU, MAINTENANT).length,
    ).toBeGreaterThan(0);
  });
});

describe('micro-copy', () => {
  const reproches = [
    'devriez',
    'il faut',
    'attention',
    'échec',
    'mauvais',
    'négligé',
    'oublié',
    'faites un effort',
  ];

  it('ne culpabilise dans aucune bande', () => {
    for (const texte of Object.values(LIBELLES_BANDE)) {
      for (const mot of reproches) {
        expect(texte.toLowerCase()).not.toContain(mot);
      }
    }
  });

  it('formule les invitations sans injonction', () => {
    for (const definition of GESTES) {
      for (const mot of reproches) {
        expect(definition.invitation.toLowerCase()).not.toContain(mot);
      }
      expect(definition.invitation.length).toBeGreaterThan(0);
    }
  });
});
