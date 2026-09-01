/**
 * Pôle ① — appels audio et vidéo.
 *
 * ## Pair-à-pair, et pourquoi
 *
 * Le son et l'image passent directement d'un téléphone à l'autre. Aucun
 * serveur ne les relaie, donc aucun serveur ne peut les écouter — ce qui est
 * la seule façon de tenir la promesse du reste de l'application. Un service
 * d'appel clé en main aurait été plus simple à poser, mais il aurait vu passer
 * ce que le chat, lui, protège.
 *
 * ## Ce que le serveur fait quand même
 *
 * Il achemine la **négociation** : les deux téléphones doivent s'échanger une
 * description de session et des chemins réseau possibles avant de se joindre.
 * C'est court, ça ne contient pas de son, mais ça contient les empreintes
 * cryptographiques qui protègent le flux.
 *
 * **D'où le scellement.** Un serveur qui remplacerait ces empreintes par les
 * siennes s'intercalerait dans l'appel sans que personne s'en aperçoive. En
 * scellant la négociation avec la clé du couple — la même que les messages —
 * le serveur ne peut plus la lire ni la modifier : il ne fait que la relayer.
 * C'est la raison d'être du numéro de vérification du chat, appliquée ici.
 *
 * ## Ce qui n'existe pas, volontairement
 *
 * Aucune réponse automatique : une offre ne décroche jamais seule. Aucun
 * enregistrement non plus — ni du son, ni de l'image, ni côté serveur ni côté
 * téléphone. Un appel de couple qui laisserait une trace enregistrable serait
 * exactement l'outil de surveillance que le cahier interdit.
 */

import type { PartenaireId } from '../types/couple';

export type SorteAppel = 'audio' | 'video';

export type EtatAppel =
  /** Proposé, pas encore décroché. Le téléphone d'en face sonne. */
  | 'sonne'
  /** Les deux flux sont établis. */
  | 'en_cours'
  /** Fini, quelle qu'en soit la raison. */
  | 'termine';

export type RaisonFin =
  /** Raccroché par l'un des deux, après avoir parlé. */
  | 'raccroche'
  /** Refusé par celui qu'on appelait. */
  | 'refuse'
  /** Personne n'a décroché à temps. */
  | 'sans_reponse'
  /** L'appelant a renoncé avant qu'on décroche. */
  | 'annule'
  /** La connexion n'a pas pu s'établir, ou s'est rompue. */
  | 'echec_reseau';

/**
 * Combien de temps un téléphone sonne avant d'abandonner.
 *
 * Quarante-cinq secondes : au-delà, on a compris que l'autre n'est pas
 * disponible, et laisser sonner plus longtemps ne fait qu'ajouter de
 * l'insistance à une absence.
 */
export const DUREE_SONNERIE_S = 45;

export interface Appel {
  id: string;
  sorte: SorteAppel;
  appelantId: PartenaireId;
  etat: EtatAppel;
  proposeeLe: string;
  /** Posé au décrochage. Absent tant que ça sonne. */
  decrocheLe?: string;
  termineLe?: string;
  raison?: RaisonFin;
}

/**
 * Les messages qui transitent par le serveur pendant un appel.
 *
 * `charge` est **scellée** dans tous les cas où elle porte une négociation :
 * le serveur relaie une enveloppe qu'il ne peut ni lire ni remplacer.
 */
export type SignalAppel =
  /** Ouverture : l'appelant propose. La charge contient l'offre scellée. */
  | { sorte: 'propose'; appelId: string; appel: SorteAppel; charge: string }
  /** Décrochage. La charge contient la réponse scellée. */
  | { sorte: 'accepte'; appelId: string; charge: string }
  /** Un chemin réseau possible, scellé lui aussi. */
  | { sorte: 'candidat'; appelId: string; charge: string }
  /** Refus, annulation, raccrochage : pas de charge, seulement la raison. */
  | { sorte: 'fin'; appelId: string; raison: RaisonFin };

/** Un appel est-il encore vivant ? */
export function appelActif(appel: Appel | undefined): boolean {
  return appel?.etat === 'sonne' || appel?.etat === 'en_cours';
}

/**
 * La sonnerie a-t-elle assez duré ?
 *
 * Calculé plutôt que minuté : les deux téléphones et le serveur doivent
 * tomber d'accord sans se coordonner, et un compte à rebours local dériverait
 * dès qu'un écran se met en veille.
 */
export function sonnerieExpiree(
  appel: Appel,
  maintenant: string = new Date().toISOString(),
): boolean {
  if (appel.etat !== 'sonne') return false;
  const depuis = Date.parse(maintenant) - Date.parse(appel.proposeeLe);
  if (!Number.isFinite(depuis)) return false;
  return depuis >= DUREE_SONNERIE_S * 1000;
}

/**
 * Durée d'un appel en secondes, ou `undefined` s'il n'a jamais abouti.
 *
 * Un appel refusé ou sans réponse n'a pas de durée : afficher « 0:00 » à côté
 * laisserait croire qu'on a décroché puis raccroché aussitôt.
 */
export function dureeAppel(appel: Appel): number | undefined {
  if (!appel.decrocheLe || !appel.termineLe) return undefined;
  const duree = Date.parse(appel.termineLe) - Date.parse(appel.decrocheLe);
  if (!Number.isFinite(duree) || duree < 0) return undefined;
  return Math.round(duree / 1000);
}

export interface LectureAppel {
  /** Ce qui s'affiche dans le fil, à la place d'un message. */
  titre: string;
  /** Précision sous le titre. Absente quand il n'y a rien à ajouter. */
  detail?: string;
}

/**
 * Ce qu'un appel terminé laisse dans la conversation.
 *
 * ## Le ton
 *
 * « Appel manqué » et non « vous n'avez pas répondu ». Un appel qu'on n'a pas
 * pris n'est pas une faute : on dormait, on conduisait, on était en réunion.
 * La formulation dit ce qui s'est passé et s'arrête là.
 *
 * De même, un refus s'affiche « Appel décliné » des deux côtés, sans dire qui
 * a décliné : celui qui l'a fait le sait, et le rappeler à l'autre à chaque
 * relecture de la conversation n'apporte rien.
 */
export function lectureAppel(
  appel: Appel,
  moiId: PartenaireId,
  formaterDuree: (secondes: number) => string,
): LectureAppel {
  const jeAppelais = appel.appelantId === moiId;
  const titre = appel.sorte === 'video' ? 'Appel vidéo' : 'Appel';

  const duree = dureeAppel(appel);
  if (duree !== undefined) {
    return { titre, detail: formaterDuree(duree) };
  }

  switch (appel.raison) {
    case 'refuse':
      return { titre, detail: 'Appel décliné' };
    case 'sans_reponse':
      return {
        titre,
        detail: jeAppelais ? 'Sans réponse' : 'Appel manqué',
      };
    case 'annule':
      return {
        titre,
        detail: jeAppelais ? 'Vous avez annulé' : 'Appel manqué',
      };
    case 'echec_reseau':
      return { titre, detail: 'La connexion n’a pas pu s’établir' };
    default:
      return { titre };
  }
}
