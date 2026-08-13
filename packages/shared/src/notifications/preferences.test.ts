import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  categoriesReglables,
  dansLaPlage,
  deciderRemise,
  PREFERENCES_PAR_DEFAUT,
  type CategorieNotification,
  type PreferencesNotifications,
} from './preferences';

const a = (heure: string) => new Date(`2026-03-15T${heure}:00`);

const prefs = (
  modifications: Partial<PreferencesNotifications> = {},
): PreferencesNotifications => ({
  ...PREFERENCES_PAR_DEFAUT,
  ...modifications,
});

describe('le SOS passe toujours', () => {
  it('traverse le mode ne pas déranger, la pause et un réglage « jamais »', () => {
    const hostile = prefs({
      silence: { actif: true, debut: '00:00', fin: '23:59' },
      pauseJusqua: '2027-01-01T00:00:00.000Z',
      parCategorie: {
        ...PREFERENCES_PAR_DEFAUT.parCategorie,
        // Même si un réglage tentait de le couper.
        sos: 'jamais',
      },
    });

    for (const heure of ['03:00', '12:00', '23:30']) {
      expect(deciderRemise('sos', hostile, a(heure)).remise).toBe('envoyee');
    }
  });

  it('est déclaré impératif, donc non réglable dans l’interface', () => {
    expect(categoriesReglables().map((c) => c.code)).not.toContain('sos');
  });
});

describe('mode ne pas déranger', () => {
  it('couvre une plage qui passe minuit', () => {
    const nuit = { actif: true, debut: '22:30', fin: '07:30' };

    for (const heure of ['22:30', '23:59', '00:00', '03:00', '07:29']) {
      expect(dansLaPlage(nuit, a(heure))).toBe(true);
    }
    for (const heure of ['07:30', '12:00', '22:29']) {
      expect(dansLaPlage(nuit, a(heure))).toBe(false);
    }
  });

  it('couvre aussi une plage dans la même journée', () => {
    const sieste = { actif: true, debut: '13:00', fin: '15:00' };
    expect(dansLaPlage(sieste, a('14:00'))).toBe(true);
    expect(dansLaPlage(sieste, a('16:00'))).toBe(false);
  });

  it('ne s’applique pas quand il est désactivé', () => {
    expect(dansLaPlage({ actif: false, debut: '00:00', fin: '23:59' }, a('03:00'))).toBe(
      false,
    );
  });

  it('diffère au lieu de supprimer', () => {
    const decision = deciderRemise('message', prefs(), a('03:00'));
    expect(decision.remise).toBe('differee');
    expect(decision.raison).toContain('Ne pas déranger');
  });
});

describe('fréquence réglable', () => {
  it('respecte chaque réglage en journée', () => {
    const attendus: [CategorieNotification, string][] = [
      ['message', 'envoyee'],
      ['presence', 'groupee'],
      ['rappel', 'groupee'],
    ];

    for (const [categorie, remise] of attendus) {
      expect(deciderRemise(categorie, prefs(), a('12:00')).remise).toBe(remise);
    }
  });

  it('n’envoie rien quand la personne a choisi « jamais »', () => {
    const muet = prefs({
      parCategorie: { ...PREFERENCES_PAR_DEFAUT.parCategorie, presence: 'jamais' },
    });
    expect(deciderRemise('presence', muet, a('12:00')).remise).toBe('ignoree');
  });

  it('garde le récapitulatif quotidien groupé, en annonçant l’heure', () => {
    const decision = deciderRemise('rappel', prefs(), a('12:00'));
    expect(decision.remise).toBe('groupee');
    expect(decision.raison).toContain(PREFERENCES_PAR_DEFAUT.heureRecapitulatif);
  });
});

describe('pause manuelle', () => {
  it('diffère tout sauf l’impératif', () => {
    const enPause = prefs({ pauseJusqua: '2026-03-15T18:00:00.000Z' });
    const maintenant = new Date('2026-03-15T14:00:00.000Z');

    expect(deciderRemise('message', enPause, maintenant).remise).toBe('differee');
    expect(deciderRemise('sos', enPause, maintenant).remise).toBe('envoyee');
  });

  it('reprend d’elle-même une fois l’échéance passée', () => {
    const finie = prefs({ pauseJusqua: '2026-03-15T10:00:00.000Z' });
    const decision = deciderRemise('message', finie, new Date('2026-03-15T12:00:00Z'));
    expect(decision.remise).not.toBe('differee');
  });
});

describe('changements de partage', () => {
  it('sont impératifs : un réglage ne peut pas les rendre silencieux', () => {
    const hostile = prefs({
      parCategorie: { ...PREFERENCES_PAR_DEFAUT.parCategorie, partage: 'jamais' },
    });
    // Hors plage de silence, la notification part malgré le réglage : sinon un
    // partenaire pourrait couper la trace de ses propres changements.
    expect(deciderRemise('partage', hostile, a('12:00')).remise).toBe('envoyee');
    expect(categoriesReglables().map((c) => c.code)).not.toContain('partage');
  });
});

describe('cohérence du catalogue', () => {
  it('donne un libellé et un détail à chaque catégorie', () => {
    for (const categorie of CATEGORIES) {
      expect(categorie.libelle.length).toBeGreaterThan(0);
      expect(categorie.detail.length).toBeGreaterThan(0);
    }
  });

  it('a une préférence par défaut pour chaque catégorie', () => {
    for (const categorie of CATEGORIES) {
      expect(PREFERENCES_PAR_DEFAUT.parCategorie[categorie.code]).toBeDefined();
    }
  });
});
