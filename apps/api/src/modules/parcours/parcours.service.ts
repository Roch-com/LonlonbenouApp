/**
 * Pôle ② — Parcours guidé du couple, côté serveur (§8.7).
 *
 * Le serveur **rejoue `vueParcours`** au lieu de réécrire la règle du miroir,
 * comme il le fait déjà pour les axes, le cycle et les questions de
 * complicité. La conséquence est la seule qui compte : la réponse de l’autre
 * ne franchit pas la frontière tant que les deux n’ont pas écrit. Il n’y a
 * rien à masquer côté client, donc rien qu’un client puisse oublier de
 * masquer.
 *
 * Le catalogue n’est pas en base : c’est du contenu éditorial versionné avec
 * l’application. Le service vérifie donc lui-même que l’identifiant reçu
 * existe, faute de clé étrangère pour le faire.
 */

import {
  estScelleMessage,
  marquerEchangee,
  parcoursParId,
  PARCOURS,
  recommanderParcours,
  repondreSeance,
  vueParcours,
  type PartenaireId,
  type RecommandationParcours,
  type SignauxParcours,
  type VueParcours,
} from '@lonlonbenu/shared';
import type { CoupleServeur, Depot } from '../../domaine/depot.ts';

export type RefusParcours =
  | 'couple_introuvable'
  | 'non_membre'
  | 'couple_dissocie'
  | 'parcours_inconnu'
  | 'parcours_non_engage'
  | 'texte_non_scelle'
  | 'seance_inconnue'
  | 'pas_la_seance_courante'
  | 'deja_repondu'
  | 'parcours_termine'
  | 'reponses_incompletes'
  | 'deja_echangee';

export interface ServiceParcours {
  lister(
    coupleId: string,
    lecteurId: PartenaireId,
  ): Promise<{
    ok: boolean;
    motif?: RefusParcours;
    vues?: VueParcours[];
    recommandation?: RecommandationParcours;
  }>;
  lire(
    coupleId: string,
    lecteurId: PartenaireId,
    parcoursId: string,
  ): Promise<{ ok: boolean; motif?: RefusParcours; vue?: VueParcours }>;
  engager(
    coupleId: string,
    lecteurId: PartenaireId,
    parcoursId: string,
  ): Promise<{ ok: boolean; motif?: RefusParcours; vue?: VueParcours }>;
  repondre(
    coupleId: string,
    auteurId: PartenaireId,
    parcoursId: string,
    seanceId: string,
    texteScelle: string,
  ): Promise<{ ok: boolean; motif?: RefusParcours; vue?: VueParcours }>;
  echanger(
    coupleId: string,
    lecteurId: PartenaireId,
    parcoursId: string,
    seanceId: string,
  ): Promise<{ ok: boolean; motif?: RefusParcours; vue?: VueParcours }>;
}

async function autoriser(
  depot: Depot,
  coupleId: string,
  lecteurId: PartenaireId,
): Promise<{ couple: CoupleServeur } | { motif: RefusParcours }> {
  const enregistrement = await depot.couples.parId(coupleId);
  if (!enregistrement) return { motif: 'couple_introuvable' };
  if (enregistrement.dissocieLe) return { motif: 'couple_dissocie' };
  if (!enregistrement.couple.partenaires.some((p) => p.id === lecteurId)) {
    return { motif: 'non_membre' };
  }
  return { couple: enregistrement };
}

export function creerServiceParcours(depot: Depot): ServiceParcours {
  /**
   * Signaux de recommandation, assemblés depuis les autres modules.
   *
   * Rien qui vienne d’un contenu : tout est scellé, et le resterait même si
   * ce module en avait l’usage. On ne compte que ce que le couple pourrait
   * compter lui-même.
   */
  async function signaux(coupleId: string): Promise<SignauxParcours> {
    const [axes, partageCycle, engages] = await Promise.all([
      depot.axes.parCouple(coupleId),
      depot.cycle.partage(coupleId),
      depot.parcours.engages(coupleId),
    ]);

    const axesOuverts: SignauxParcours['axesOuverts'] = {};
    for (const axe of axes) {
      if (axe.clotureLe) continue;
      axesOuverts[axe.theme] = (axesOuverts[axe.theme] ?? 0) + 1;
    }

    return {
      axesOuverts,
      desirEnfant: partageCycle?.desirEnfant ?? false,
      dejaEngages: engages.map((e) => e.parcoursId),
    };
  }

  return {
    async lister(coupleId, lecteurId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const engages = await depot.parcours.engages(coupleId);
      const vues = PARCOURS.map((p) =>
        vueParcours(
          p,
          engages.find((e) => e.parcoursId === p.id),
          lecteurId,
        ),
      );

      const recommandation = recommanderParcours(await signaux(coupleId));
      return {
        ok: true,
        vues,
        ...(recommandation ? { recommandation } : {}),
      };
    },

    async lire(coupleId, lecteurId, parcoursId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const parcours = parcoursParId(parcoursId);
      if (!parcours) return { ok: false, motif: 'parcours_inconnu' };

      const engage = await depot.parcours.parId(coupleId, parcoursId);
      return { ok: true, vue: vueParcours(parcours, engage, lecteurId) };
    },

    /**
     * Engage le parcours pour le couple, pas pour la personne.
     *
     * Un parcours engagé par l’un l’est pour les deux : c’est un exercice à
     * deux, et un engagement individuel ferait attendre l’autre sans qu’il
     * sache pourquoi. Ré-engager un parcours déjà ouvert ne fait rien plutôt
     * que d’échouer — les deux peuvent appuyer en même temps.
     */
    async engager(coupleId, lecteurId, parcoursId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const parcours = parcoursParId(parcoursId);
      if (!parcours) return { ok: false, motif: 'parcours_inconnu' };

      let engage = await depot.parcours.parId(coupleId, parcoursId);
      if (!engage) {
        engage = {
          parcoursId,
          commenceLe: new Date().toISOString(),
          avancees: [],
        };
        await depot.parcours.enregistrer(coupleId, engage);
      }

      return { ok: true, vue: vueParcours(parcours, engage, lecteurId) };
    },

    async repondre(coupleId, auteurId, parcoursId, seanceId, texteScelle) {
      const acces = await autoriser(depot, coupleId, auteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const parcours = parcoursParId(parcoursId);
      if (!parcours) return { ok: false, motif: 'parcours_inconnu' };
      if (!estScelleMessage(texteScelle)) {
        return { ok: false, motif: 'texte_non_scelle' };
      }

      const engage = await depot.parcours.parId(coupleId, parcoursId);
      if (!engage) return { ok: false, motif: 'parcours_non_engage' };

      const resultat = repondreSeance(
        parcours,
        engage,
        seanceId,
        auteurId,
        texteScelle,
        new Date().toISOString(),
      );
      if (!resultat.ok) return { ok: false, motif: resultat.motif };

      await depot.parcours.enregistrer(coupleId, resultat.engage);
      // On rend la vue à jour : répondre peut ouvrir celle de l'autre, et
      // l'écran doit pouvoir l'afficher sans second aller-retour.
      return {
        ok: true,
        vue: vueParcours(parcours, resultat.engage, auteurId),
      };
    },

    async echanger(coupleId, lecteurId, parcoursId, seanceId) {
      const acces = await autoriser(depot, coupleId, lecteurId);
      if ('motif' in acces) return { ok: false, motif: acces.motif };

      const parcours = parcoursParId(parcoursId);
      if (!parcours) return { ok: false, motif: 'parcours_inconnu' };

      const engage = await depot.parcours.parId(coupleId, parcoursId);
      if (!engage) return { ok: false, motif: 'parcours_non_engage' };

      const resultat = marquerEchangee(
        parcours,
        engage,
        seanceId,
        new Date().toISOString(),
      );
      if (!resultat.ok) return { ok: false, motif: resultat.motif };

      await depot.parcours.enregistrer(coupleId, resultat.engage);
      return {
        ok: true,
        vue: vueParcours(parcours, resultat.engage, lecteurId),
      };
    },
  };
}
