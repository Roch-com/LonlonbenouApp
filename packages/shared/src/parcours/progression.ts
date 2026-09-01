/**
 * Pôle ② — avancement d’un parcours guidé (§8.7).
 *
 * « Suivi de progression par parcours, partagé entre les deux partenaires. »
 *
 * ## Une séance se termine à deux
 *
 * Une séance n’est pas « faite » quand l’un a écrit sa réponse, mais quand les
 * deux l’ont fait. Sinon le parcours avancerait au rythme du plus assidu, et
 * l’autre le rattraperait en lisant des réponses déjà ouvertes — ce qui vide
 * l’exercice de son sens.
 *
 * ## Ce que le serveur peut lire
 *
 * Rien du contenu : les réponses sont scellées comme le reste du pôle ②. Le
 * serveur ne connaît que le fait qu’une réponse existe, ce qui lui suffit pour
 * appliquer le miroir et calculer l’avancement.
 */

import type { PartenaireId } from '../types/couple';
import type { Parcours, Seance } from './catalogue';

export interface ReponseSeance {
  partenaireId: PartenaireId;
  /** Scellée : l’exercice touche à de l’intime. */
  texteScelle: string;
  faitLe: string;
}

export interface AvanceeSeance {
  seanceId: string;
  /** 0, 1 ou 2 — une par partenaire au maximum. */
  reponses: readonly ReponseSeance[];
  /** Posé quand le couple déclare avoir fait le temps « ensemble ». */
  echangeLe?: string;
}

export interface ParcoursEngage {
  parcoursId: string;
  commenceLe: string;
  avancees: readonly AvanceeSeance[];
  /** Posé quand la dernière séance a été échangée. */
  termineLe?: string;
}

export type EtatSeance =
  /** Personne n’a encore écrit. */
  | 'a_faire'
  /** J’ai écrit, j’attends l’autre. */
  | 'moi_seul'
  /** L’autre a écrit, à moi de jouer. */
  | 'lui_seul'
  /** Les deux ont écrit : les réponses sont ouvertes. */
  | 'a_echanger'
  /** Le temps « ensemble » a eu lieu. */
  | 'echangee';

export interface VueSeance {
  seance: Seance;
  rang: number;
  total: number;
  etat: EtatSeance;
  /** La mienne, toujours lisible. */
  mienne?: ReponseSeance;
  /** Celle de l’autre, **seulement** une fois les deux écrites. */
  sienne?: ReponseSeance;
  lecture: string;
}

export interface VueParcours {
  parcours: Parcours;
  engage: boolean;
  /** Séances entièrement terminées, sur le total. */
  seancesFaites: number;
  total: number;
  /** La séance en cours, absente une fois le parcours terminé. */
  courante?: VueSeance;
  termine: boolean;
  lecture: string;
}

const avanceeDe = (
  engage: ParcoursEngage | undefined,
  seanceId: string,
): AvanceeSeance | undefined =>
  engage?.avancees.find((a) => a.seanceId === seanceId);

/** Une séance ne compte comme faite qu’une fois échangée à deux. */
export function seanceTerminee(avancee: AvanceeSeance | undefined): boolean {
  return !!avancee?.echangeLe;
}

/**
 * Ce qu’une personne voit d’une séance.
 *
 * `sienne` reste absente tant que les deux n’ont pas écrit. Le filtrage vit
 * ici, dans le modèle partagé, pour que le serveur applique la même règle sans
 * qu’un écran ait à se souvenir de masquer quoi que ce soit.
 */
export function vueSeance(
  seance: Seance,
  rang: number,
  total: number,
  avancee: AvanceeSeance | undefined,
  moiId: PartenaireId,
): VueSeance {
  const mienne = avancee?.reponses.find((r) => r.partenaireId === moiId);
  const autre = avancee?.reponses.find((r) => r.partenaireId !== moiId);
  const base = { seance, rang, total };

  if (avancee?.echangeLe) {
    return {
      ...base,
      etat: 'echangee',
      ...(mienne ? { mienne } : {}),
      ...(autre ? { sienne: autre } : {}),
      lecture: 'Séance terminée, tous les deux.',
    };
  }
  if (mienne && autre) {
    return {
      ...base,
      etat: 'a_echanger',
      mienne,
      sienne: autre,
      lecture:
        'Vos deux réponses sont ouvertes. Prenez le temps « ensemble » quand vous le pourrez.',
    };
  }
  if (mienne) {
    return {
      ...base,
      etat: 'moi_seul',
      mienne,
      lecture:
        'Votre réponse est gardée. Elle s’ouvrira quand l’autre aura écrit la sienne — pas avant, pour qu’aucune ne s’écrive en fonction de l’autre.',
    };
  }
  if (autre) {
    return {
      ...base,
      etat: 'lui_seul',
      // Volontairement absente : la lire d'avance changerait la réponse.
      lecture:
        'Une réponse vous attend. Elle s’ouvrira quand vous aurez écrit la vôtre.',
    };
  }
  return {
    ...base,
    etat: 'a_faire',
    lecture: 'À faire chacun de son côté, cinq minutes.',
  };
}

/**
 * L’état complet d’un parcours pour une personne.
 *
 * La séance courante est la première non échangée : le parcours n’avance pas
 * tant que le temps à deux n’a pas eu lieu.
 */
export function vueParcours(
  parcours: Parcours,
  engage: ParcoursEngage | undefined,
  moiId: PartenaireId,
): VueParcours {
  const total = parcours.seances.length;
  const faites = parcours.seances.filter((s) =>
    seanceTerminee(avanceeDe(engage, s.id)),
  ).length;

  const index = parcours.seances.findIndex(
    (s) => !seanceTerminee(avanceeDe(engage, s.id)),
  );
  const termine = index === -1;

  if (!engage) {
    return {
      parcours,
      engage: false,
      seancesFaites: 0,
      total,
      termine: false,
      lecture: `${total} séances de cinq minutes, chacun de son côté puis ensemble.`,
    };
  }
  if (termine) {
    return {
      parcours,
      engage: true,
      seancesFaites: faites,
      total,
      termine: true,
      lecture: 'Parcours terminé. Vous pouvez y revenir quand vous voulez.',
    };
  }

  const seance = parcours.seances[index]!;
  return {
    parcours,
    engage: true,
    seancesFaites: faites,
    total,
    courante: vueSeance(
      seance,
      index + 1,
      total,
      avanceeDe(engage, seance.id),
      moiId,
    ),
    termine: false,
    lecture: `Séance ${index + 1} sur ${total}.`,
  };
}

export type RefusReponse =
  | 'parcours_termine'
  | 'seance_inconnue'
  | 'pas_la_seance_courante'
  | 'deja_repondu';

/**
 * Enregistre une réponse, ou dit pourquoi elle est refusée.
 *
 * On ne répond qu’à la séance courante : autoriser à sauter en avant ferait
 * arriver le second sur une séance dont il n’a pas fait les précédentes.
 * Réécrire une réponse déjà donnée est refusé aussi — sinon on pourrait la
 * corriger après avoir lu celle de l’autre.
 */
export function repondreSeance(
  parcours: Parcours,
  engage: ParcoursEngage,
  seanceId: string,
  moiId: PartenaireId,
  texteScelle: string,
  maintenant: string,
): { ok: true; engage: ParcoursEngage } | { ok: false; motif: RefusReponse } {
  if (!parcours.seances.some((s) => s.id === seanceId)) {
    return { ok: false, motif: 'seance_inconnue' };
  }

  const index = parcours.seances.findIndex(
    (s) => !seanceTerminee(avanceeDe(engage, s.id)),
  );
  if (index === -1) return { ok: false, motif: 'parcours_termine' };
  if (parcours.seances[index]!.id !== seanceId) {
    return { ok: false, motif: 'pas_la_seance_courante' };
  }

  const avancee = avanceeDe(engage, seanceId) ?? { seanceId, reponses: [] };
  if (avancee.reponses.some((r) => r.partenaireId === moiId)) {
    return { ok: false, motif: 'deja_repondu' };
  }

  const misAJour: AvanceeSeance = {
    ...avancee,
    reponses: [
      ...avancee.reponses,
      { partenaireId: moiId, texteScelle, faitLe: maintenant },
    ],
  };

  return {
    ok: true,
    engage: {
      ...engage,
      avancees: [
        ...engage.avancees.filter((a) => a.seanceId !== seanceId),
        misAJour,
      ],
    },
  };
}

export type RefusEchange =
  | 'seance_inconnue'
  | 'reponses_incompletes'
  | 'deja_echangee';

/**
 * Marque le temps « ensemble » comme fait, ce qui fait avancer le parcours.
 *
 * Exige les deux réponses : déclarer un échange que l’un n’a pas préparé
 * ferait sauter son tour sans qu’il ait rien pu dire.
 */
export function marquerEchangee(
  parcours: Parcours,
  engage: ParcoursEngage,
  seanceId: string,
  maintenant: string,
): { ok: true; engage: ParcoursEngage } | { ok: false; motif: RefusEchange } {
  if (!parcours.seances.some((s) => s.id === seanceId)) {
    return { ok: false, motif: 'seance_inconnue' };
  }

  const avancee = avanceeDe(engage, seanceId);
  if (avancee?.echangeLe) return { ok: false, motif: 'deja_echangee' };
  if (!avancee || avancee.reponses.length < 2) {
    return { ok: false, motif: 'reponses_incompletes' };
  }

  const avancees = [
    ...engage.avancees.filter((a) => a.seanceId !== seanceId),
    { ...avancee, echangeLe: maintenant },
  ];
  const toutesFaites = parcours.seances.every((s) =>
    seanceTerminee(avancees.find((a) => a.seanceId === s.id)),
  );

  return {
    ok: true,
    engage: {
      ...engage,
      avancees,
      ...(toutesFaites ? { termineLe: maintenant } : {}),
    },
  };
}
