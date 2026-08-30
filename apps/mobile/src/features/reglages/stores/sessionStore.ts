/**
 * Pôle ⑥ — socle minimal nécessaire au pôle ①.
 *
 * Contient uniquement : l'identité du couple, le partenaire connecté et les
 * consentements réciproques. Le reste du pôle ⑥ (verrou biométrique,
 * dissociation de compte, notifications fines) reste à faire — voir le README
 * du dossier.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  basculerConsentement,
  creerPartage,
  estPartageActif,
  type Couple,
  type ModuleSensible,
  type PartageReciproque,
  type Partenaire,
  type PartenaireId,
} from '@lonlonbenu/shared';
import { stockage } from '@/lib/stockage';
import { notifier } from './notificationsStore';

/** Couple pilote — environnement de test Rochaelle. */
export const COUPLE_PILOTE: Couple = {
  id: 'rochaelle',
  depuis: '2019-11-23',
  partenaires: [
    { id: 'rochambeau', prenom: 'Rochambeau', initiales: 'R' },
    { id: 'gaelle', prenom: 'Gaëlle', initiales: 'G' },
  ],
};

interface EtatSession {
  couple: Couple;
  /** Partenaire connecté sur cet appareil. */
  moiId: PartenaireId;
  partages: Record<string, PartageReciproque>;
  nomEspace: string;
  onboardingFait: boolean;

  basculerPartage: (module: ModuleSensible, actif: boolean) => void;
  definirPrenoms: (prenomA: string, prenomB: string) => void;
  definirNomEspace: (nom: string) => void;
  terminerOnboarding: () => void;
  /** Outil de test : incarne l'autre partenaire pour vérifier la symétrie. */
  changerDePartenaire: () => void;
}

/**
 * Modules dont l'accès repose sur un consentement mutuel.
 * `confidences` n'y figure pas volontairement : sa réciprocité est structurelle
 * (rien ne se lit qui n'ait été envoyé), pas conditionnée à un interrupteur.
 * Voir le README du pôle ②.
 */
const MODULES_INITIAUX: ModuleSensible[] = ['position', 'croissance', 'score'];

export const LIBELLES_PARTAGE: Record<string, { titre: string; detail: string }> = {
  position: {
    titre: 'Partage de position',
    detail: 'Statuts et présence, dans les mêmes conditions pour vous deux.',
  },
  croissance: {
    titre: 'Axes de croissance',
    detail:
      'Travailler vos sujets à deux, chacun découvrant l’autre au même moment.',
  },
  score: {
    titre: 'Score d’implication',
    detail:
      'Un repère commun sur vos gestes récents. Un seul score, le même pour vous deux.',
  },
  activite: {
    titre: 'Présence dans la conversation',
    detail:
      '« En ligne », « vu il y a… » et « écrit… ». Vous ne le voyez que si vous le montrez.',
  },
};

function partagesInitiaux(couple: Couple): Record<string, PartageReciproque> {
  const [a, b] = couple.partenaires;
  return Object.fromEntries(
    MODULES_INITIAUX.map((m) => [m, creerPartage(m, a.id, b.id, false)]),
  );
}

export const useSession = create<EtatSession>()(
  persist(
    (set, get) => ({
      couple: COUPLE_PILOTE,
      moiId: COUPLE_PILOTE.partenaires[0].id,
      partages: partagesInitiaux(COUPLE_PILOTE),
      nomEspace: 'Notre espace',
      onboardingFait: false,

      basculerPartage: (module, actif) => {
        const { partages, moiId, couple } = get();
        const partage = partages[module];
        if (!partage) return;

        const moi = couple.partenaires.find((p) => p.id === moiId);
        const resultat = basculerConsentement(
          partage,
          moiId,
          actif,
          moi?.prenom ?? '',
        );

        set({ partages: { ...partages, [module]: resultat.partage } });

        // Les deux partenaires sont prévenus, via le socle centralisé. La
        // catégorie « partage » est impérative : aucun réglage ne peut la
        // rendre silencieuse, sinon un mode furtif redeviendrait possible.
        notifier(
          resultat.notifications.map((n) => ({
            destinataireId: n.destinataireId,
            categorie: 'partage' as const,
            texte: n.texte,
          })),
        );
      },

      definirPrenoms: (prenomA, prenomB) =>
        set((e) => {
          const [a, b] = e.couple.partenaires;
          const renommer = (p: Partenaire, prenom: string): Partenaire => {
            const propre = prenom.trim();
            return propre
              ? { ...p, prenom: propre, initiales: propre[0]!.toUpperCase() }
              : p;
          };
          return {
            couple: {
              ...e.couple,
              partenaires: [renommer(a, prenomA), renommer(b, prenomB)],
            },
          };
        }),

      definirNomEspace: (nom) => {
        const propre = nom.trim();
        if (propre) set({ nomEspace: propre });
      },

      terminerOnboarding: () => set({ onboardingFait: true }),

      changerDePartenaire: () => {
        const { couple, moiId } = get();
        const autre = couple.partenaires.find((p) => p.id !== moiId);
        if (autre) set({ moiId: autre.id });
      },
    }),
    { name: 'lonlonbenu.session', storage: stockage },
  ),
);

export function useMoi(): Partenaire {
  return useSession((e) => {
    const moi = e.couple.partenaires.find((p) => p.id === e.moiId);
    if (!moi) throw new Error('Partenaire connecté introuvable');
    return moi;
  });
}

export function useAutre(): Partenaire {
  return useSession((e) => {
    const autre = e.couple.partenaires.find((p) => p.id !== e.moiId);
    if (!autre) throw new Error('Partenaire introuvable');
    return autre;
  });
}

export function usePartage(module: ModuleSensible): PartageReciproque | undefined {
  return useSession((e) => e.partages[module]);
}

export function usePartageActif(module: ModuleSensible): boolean {
  return useSession((e) => {
    const partage = e.partages[module];
    return partage ? estPartageActif(partage) : false;
  });
}
