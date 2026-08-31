import { describe, expect, it } from 'vitest';
import {
  QUESTIONS,
  questionDuJour,
  vueEchange,
  type EchangeComplicite,
} from './complicite';
import { relire, RIEN_A_SIGNALER } from '../croissance/reformulation';
import { DELAI_REFLEXION_MS, etatDiffere } from './differe';

const A = 'rochambeau';
const B = 'gaelle';

const reponse = (partenaireId: string) => ({
  partenaireId,
  texteScelle: `m1.nonce.${partenaireId}`,
  repondeLe: '2026-09-14T10:00:00.000Z',
});

const echange = (reponses: ReturnType<typeof reponse>[]): EchangeComplicite => ({
  questionId: 'q01',
  jour: '2026-09-14',
  reponses,
});

describe('question du jour', () => {
  it('est la même pour les deux, un jour donné', () => {
    // Tirée au sort, chacun répondrait à une question différente et la mise
    // en regard n'aurait aucun sens.
    expect(questionDuJour('2026-09-14')).toEqual(questionDuJour('2026-09-14'));
  });

  it('change d’un jour à l’autre et parcourt la banque', () => {
    const vues = new Set<string>();
    for (let i = 0; i < QUESTIONS.length; i++) {
      const jour = `2026-09-${String(i + 1).padStart(2, '0')}`;
      vues.add(questionDuJour(jour).id);
    }
    expect(vues.size).toBe(QUESTIONS.length);
  });

  it('ne demande jamais d’évaluer l’autre', () => {
    // Le pôle ② a déjà les axes de croissance pour ce qui doit changer, avec
    // le cadre qui va avec. Une question de complicité n'ouvre pas un procès.
    for (const question of QUESTIONS) {
      expect(question.texte).not.toMatch(/changerais chez|reproche|défaut|tort/i);
    }
  });
});

describe('miroir', () => {
  it('ne montre rien tant qu’une seule personne a répondu', () => {
    const vue = vueEchange(echange([reponse(B)]), '2026-09-14', A);
    expect(vue.etat).toBe('lui_seul');
    expect(vue.sienne).toBeUndefined();
    // La connaître d'avance ferait de la seconde réponse un commentaire.
    expect(JSON.stringify(vue)).not.toContain('m1.nonce.gaelle');
  });

  it('rend la mienne même seule : c’est la mienne', () => {
    const vue = vueEchange(echange([reponse(A)]), '2026-09-14', A);
    expect(vue.etat).toBe('moi_seul');
    expect(vue.mienne).toBeDefined();
    expect(vue.sienne).toBeUndefined();
  });

  it('ouvre les deux une fois les deux reçues', () => {
    const vue = vueEchange(echange([reponse(A), reponse(B)]), '2026-09-14', A);
    expect(vue.etat).toBe('les_deux');
    expect(vue.mienne?.partenaireId).toBe(A);
    expect(vue.sienne?.partenaireId).toBe(B);
  });

  it('tient sans échange du tout', () => {
    expect(vueEchange(undefined, '2026-09-14', A).etat).toBe('personne');
  });
});

describe('brouillon différé', () => {
  const HIER = '2026-09-13T10:00:00.000Z';
  const MAINTENANT = '2026-09-14T10:00:00.000Z';

  it('laisse partir ce qui n’a pas été différé', () => {
    expect(etatDiffere(undefined, MAINTENANT).pret).toBe(true);
  });

  it('retient jusqu’au lendemain', () => {
    const juste = new Date(Date.parse(MAINTENANT) - DELAI_REFLEXION_MS + 60_000);
    expect(etatDiffere(juste.toISOString(), MAINTENANT).pret).toBe(false);
    expect(etatDiffere(HIER, MAINTENANT).pret).toBe(true);
  });

  it('invite à relire plutôt qu’à envoyer', () => {
    // Le délai sert à ce que la lettre soit relue, pas à ce qu'elle parte.
    expect(etatDiffere(HIER, MAINTENANT).lecture).toContain('Relisez');
  });

  it('ne bloque pas sur un horodatage illisible', () => {
    expect(etatDiffere('pas une date', MAINTENANT).pret).toBe(true);
  });
});

describe('assistant de reformulation', () => {
  it('repère l’absolu, qui se réfute d’un contre-exemple', () => {
    const remarques = relire('Tu ne m’écoutes jamais quand je rentre');
    expect(remarques.map((r) => r.sorte)).toContain('absolu');
  });

  it('repère l’injonction et l’étiquette', () => {
    expect(relire('Tu devrais faire un effort').map((r) => r.sorte)).toContain(
      'injonction',
    );
    expect(relire('Tu es vraiment égoïste').map((r) => r.sorte)).toContain(
      'etiquette',
    );
  });

  it('ne signale qu’une fois par sorte', () => {
    // Signaler cinq absolus donnerait une liste décourageante là où le point
    // est déjà compris.
    const remarques = relire('Tu ne fais jamais rien, tu es toujours ailleurs');
    expect(remarques.filter((r) => r.sorte === 'absolu')).toHaveLength(1);
  });

  it('ne dit rien d’une phrase déjà dicible', () => {
    expect(relire('Je me sens seul quand les soirées passent sans qu’on parle'))
      .toHaveLength(0);
  });

  it('ne réécrit jamais le texte', () => {
    // Une version lissée par la machine, que l'autre lirait comme votre
    // phrase, ferait de l'app un ventriloque.
    const remarques = relire('Tu devrais faire un effort');
    for (const remarque of remarques) {
      expect(Object.keys(remarque).sort()).toEqual([
        'extrait',
        'piste',
        'pourquoi',
        'sorte',
      ]);
    }
  });

  it('ne félicite pas quand il n’a rien à dire', () => {
    // Écrire un axe de croissance n'est pas un exercice qu'on réussit.
    expect(RIEN_A_SIGNALER).not.toMatch(/bravo|parfait|excellent|félicit/i);
  });

  it('relit deux fois le même texte à l’identique', () => {
    // `lastIndex` d'un motif global persiste : sans copie, la deuxième
    // relecture manquerait des passages.
    const texte = 'Tu ne m’écoutes jamais';
    expect(relire(texte)).toEqual(relire(texte));
  });
});
