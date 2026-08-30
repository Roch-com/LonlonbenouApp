/**
 * Un événement dont l'horodatage est illisible ne doit pas fermer l'écran.
 *
 * Cas réel : le formulaire complétait « 9 » en « 00009 » et enregistrait
 * `2026-08-30T00009:00` sur le serveur. `grouperParJour` appelait alors
 * `new Date(...).toISOString()`, qui lève un `RangeError` — et le pôle ③ se
 * fermait à chaque ouverture, sans moyen d'atteindre l'événement fautif pour
 * le supprimer.
 */
import { describe, expect, it } from 'vitest';
import {
  estPasse,
  evenementsAVenir,
  grouperParJour,
  JOUR_ILLISIBLE,
  jourDeLEvenement,
  quand,
} from './agenda';
import type { Evenement } from '../types/calendrier';

const MAINTENANT = '2026-08-30T10:00:00.000Z';

function evenement(partiel: Partial<Evenement>): Evenement {
  return {
    id: 'e1',
    titre: 'Dîner',
    categorie: 'a_deux',
    debut: '2026-08-30T19:00:00',
    journeeEntiere: false,
    creePar: 'a',
    creeLe: MAINTENANT,
    ...partiel,
  } as Evenement;
}

/** Les horodatages que le formulaire fautif pouvait produire. */
const HORODATAGES_FAUTIFS = [
  '2026-08-30T00009:00',
  '2026-08-30T0020h:00',
  'pas une date',
  '',
];

describe('un horodatage illisible ne ferme plus l’écran', () => {
  it('ne lève sur aucun des horodatages que le formulaire produisait', () => {
    for (const debut of HORODATAGES_FAUTIFS) {
      const liste = [evenement({ debut })];
      expect(() => grouperParJour(liste)).not.toThrow();
      expect(() => evenementsAVenir(liste, MAINTENANT)).not.toThrow();
      expect(() => estPasse(liste[0]!, MAINTENANT)).not.toThrow();
    }
  });

  it('retrouve le bon jour quand seule l’heure est illisible', () => {
    // La date est intacte dans « 2026-08-30T00009:00 » : la perdre ferait
    // atterrir l'événement dans un fourre-tout alors qu'on sait le classer.
    expect(jourDeLEvenement(evenement({ debut: '2026-08-30T00009:00' }))).toBe(
      '2026-08-30',
    );
  });

  it('regroupe sous une clé dédiée ce qui reste illisible', () => {
    expect(jourDeLEvenement(evenement({ debut: 'pas une date' }))).toBe(
      JOUR_ILLISIBLE,
    );
  });

  it('laisse l’événement fautif à venir, là où on peut le supprimer', () => {
    // Rangé dans les passés, il n'apparaîtrait que dans un résumé sans bouton
    // « Retirer » : la donnée fautive deviendrait indélogeable.
    const casse = evenement({ debut: 'pas une date', journeeEntiere: true });
    expect(estPasse(casse, MAINTENANT)).toBe(false);
    expect(evenementsAVenir([casse], MAINTENANT)).toHaveLength(1);
  });

  it('donne un libellé lisible plutôt que de lever', () => {
    expect(quand(JOUR_ILLISIBLE, MAINTENANT)).toBe('date à préciser');
    expect(quand('pas une date', MAINTENANT)).toBe('date à préciser');
    // Le cas normal reste intact.
    expect(quand('2026-08-30', MAINTENANT)).toBe('aujourd’hui');
  });
});
