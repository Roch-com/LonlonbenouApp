/**
 * Ports de persistance.
 *
 * Les types métier viennent **tous** de `@lonlonbenu/shared` : le serveur ne
 * redéfinit aucun modèle. C'est la condition pour que les invariants écrits et
 * testés côté mobile soient exactement ceux que le serveur applique, plutôt que
 * deux implémentations qui divergent au premier correctif.
 */

import type {
  ActiviteBrute,
  SouvenirScelle,
  AxeCroissance,
  CategorieNotification,
  Confidence,
  Couple,
  Evenement,
  Initiative,
  Invitation,
  ModuleSensible,
  PartageReciproque,
  PartageCycle,
  PartenaireId,
  PreferencesNotifications,
  Projet,
  Regles,
  Remise,
  Symptome,
} from '@lonlonbenu/shared';

export interface CoupleServeur {
  id: string;
  couple: Couple;
  partages: Record<string, PartageReciproque>;
  /** Une fois posée, cette date coupe tout accès, des deux côtés. */
  dissocieLe?: string;
}

export interface InvitationServeur {
  id: string;
  invitation: Invitation;
  /** Couple créé à la consommation. */
  coupleId?: string;
}

export interface NotificationServeur {
  id: string;
  destinataireId: PartenaireId;
  categorie: CategorieNotification;
  texte: string;
  emiseLe: string;
  remise: Remise;
  raison: string;
  /** Renseigné dès que le transport a réellement poussé la notification. */
  expedieeLe?: string;
}

/**
 * Message tel que le serveur le connaît : une enveloppe scellée et des
 * métadonnées de routage. **Il n'existe aucun champ de texte en clair**, et
 * c'est volontaire — on ne peut pas divulguer ce qu'on n'a pas de place pour
 * stocker.
 */
export interface MessageScelle {
  id: string;
  auteurId: PartenaireId;
  /** `m1.<nonce>.<scellé>` — opaque pour le serveur. */
  enveloppe: string;
  envoyeLe: string;
  luLe?: string;
}

/**
 * Statut et humeur partagent une ligne : deux signaux déclaratifs, une seule
 * personne, la même règle de réciprocité. Les séparer aurait dupliqué le
 * contrôle d'accès sans rien clarifier.
 */
export interface StatutServeur {
  partenaireId: PartenaireId;
  code: string;
  /** Précision libre, scellée elle aussi : c'est du texte écrit par la personne. */
  noteScellee?: string;
  majLe: string;
  humeurCode?: string;
  motHumeurScelle?: string;
  humeurMajLe?: string;
}

/**
 * Position d’un partenaire, telle que le serveur la détient : une enveloppe et
 * un horodatage. Il ne sait pas l’ouvrir, donc pas où se trouve la personne.
 */
export interface PositionServeur {
  partenaireId: PartenaireId;
  /** `m1.<nonce>.<scellé>` — opaque pour le serveur. */
  positionScellee: string;
  majLe: string;
}

export interface CheckInServeur {
  id: string;
  partenaireId: PartenaireId;
  /** Lieu et mot sont scellés : ils disent où l'on est et ce qu'on ressent. */
  lieuScelle: string;
  motScelle?: string;
  faitLe: string;
}

export interface AlerteServeur {
  id: string;
  partenaireId: PartenaireId;
  lieuScelle?: string;
  messageScelle?: string;
  etat: 'actif' | 'resolu';
  emiseLe: string;
  vueLe?: string;
  resolueLe?: string;
}

export interface Appareil {
  partenaireId: PartenaireId;
  jetonPush: string;
  plateforme: 'ios' | 'android';
}

export interface Depot {
  couples: {
    parId(coupleId: string): Promise<CoupleServeur | undefined>;
    parPartenaire(partenaireId: PartenaireId): Promise<CoupleServeur | undefined>;
    /** Couples encore actifs. Le planificateur de rappels les balaie. */
    actifs(): Promise<CoupleServeur[]>;
    enregistrer(couple: CoupleServeur): Promise<void>;
  };
  axes: {
    parCouple(coupleId: string): Promise<AxeCroissance[]>;
    parId(coupleId: string, axeId: string): Promise<AxeCroissance | undefined>;
    enregistrer(coupleId: string, axe: AxeCroissance): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  invitations: {
    parId(id: string): Promise<InvitationServeur | undefined>;
    enregistrer(entree: InvitationServeur): Promise<void>;
  };
  notifications: {
    preferences(partenaireId: PartenaireId): Promise<PreferencesNotifications>;
    definirPreferences(
      partenaireId: PartenaireId,
      preferences: PreferencesNotifications,
    ): Promise<void>;
    ajouter(notification: NotificationServeur): Promise<void>;
    /**
     * Notifications en attente d'expédition, les plus anciennes d'abord :
     * celles que `deciderRemise` a mises de côté, et celles qu'il a laissé
     * passer mais que le fournisseur push a refusées — un échec de transport
     * ne doit pas faire disparaître ce qui devait être dit.
     */
    enAttente(partenaireId: PartenaireId): Promise<NotificationServeur[]>;
    marquerExpediees(ids: readonly string[], quand: string): Promise<void>;
    journal(partenaireId: PartenaireId): Promise<NotificationServeur[]>;
  };
  viePratique: {
    evenements(coupleId: string): Promise<Evenement[]>;
    enregistrerEvenement(coupleId: string, evenement: Evenement): Promise<void>;
    supprimerEvenement(coupleId: string, id: string): Promise<void>;
    projets(coupleId: string): Promise<Projet[]>;
    projetParId(coupleId: string, id: string): Promise<Projet | undefined>;
    enregistrerProjet(coupleId: string, projet: Projet): Promise<void>;
    initiatives(coupleId: string): Promise<Initiative[]>;
    initiativeParId(coupleId: string, id: string): Promise<Initiative | undefined>;
    enregistrerInitiative(coupleId: string, initiative: Initiative): Promise<void>;
    supprimerInitiative(coupleId: string, id: string): Promise<void>;
    /** Clés des rappels déjà émis : c'est ce qui rend le planificateur idempotent. */
    rappelsEmis(coupleId: string): Promise<string[]>;
    noterRappelsEmis(coupleId: string, cles: readonly string[]): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  chat: {
    /**
     * Clés publiques d'échange. Le serveur n'en détient jamais de privée : il
     * ne peut donc pas déchiffrer, seulement acheminer.
     */
    clePublique(partenaireId: PartenaireId): Promise<string | undefined>;
    definirClePublique(partenaireId: PartenaireId, cle: string): Promise<void>;
    /** Messages scellés, du plus ancien au plus récent. */
    messages(coupleId: string): Promise<MessageScelle[]>;
    ajouter(coupleId: string, message: MessageScelle): Promise<void>;
    marquerLus(
      coupleId: string,
      lecteurId: PartenaireId,
      quand: string,
    ): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  /**
   * Signal d'activité. Une ligne par personne, écrasée à chaque battement :
   * aucun historique n'est conservé, volontairement.
   */
  activite: {
    parCouple(coupleId: string): Promise<ActiviteBrute[]>;
    signaler(coupleId: string, activite: ActiviteBrute): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  /** Pôle ⑤ — souvenirs et lieux visités, scellés. */
  souvenirs: {
    parCouple(coupleId: string): Promise<SouvenirScelle[]>;
    parId(coupleId: string, id: string): Promise<SouvenirScelle | undefined>;
    enregistrer(coupleId: string, souvenir: SouvenirScelle): Promise<void>;
    supprimer(coupleId: string, id: string): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  presence: {
    statuts(coupleId: string): Promise<StatutServeur[]>;
    /** Dernière position connue de chacun. Aucun historique n’est conservé. */
    positions(coupleId: string): Promise<PositionServeur[]>;
    definirPosition(coupleId: string, position: PositionServeur): Promise<void>;
    definirStatut(coupleId: string, statut: StatutServeur): Promise<void>;
    definirHumeur(
      coupleId: string,
      partenaireId: PartenaireId,
      code: string,
      motScelle: string | undefined,
      quand: string,
    ): Promise<void>;
    checkIns(coupleId: string): Promise<CheckInServeur[]>;
    ajouterCheckIn(coupleId: string, checkIn: CheckInServeur): Promise<void>;
    alertes(coupleId: string): Promise<AlerteServeur[]>;
    enregistrerAlerte(coupleId: string, alerte: AlerteServeur): Promise<void>;
    alerteParId(coupleId: string, id: string): Promise<AlerteServeur | undefined>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  confidences: {
    /**
     * Toutes les confidences du couple. Le dépôt ne stocke **que des
     * confidences envoyées** : un brouillon ne parvient jamais jusqu'ici.
     */
    parCouple(coupleId: string): Promise<Confidence[]>;
    parId(coupleId: string, id: string): Promise<Confidence | undefined>;
    enregistrer(coupleId: string, confidence: Confidence): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  cycle: {
    /** Réglage de partage du couple, s'il existe. */
    partage(coupleId: string): Promise<PartageCycle | undefined>;
    definirPartage(coupleId: string, partage: PartageCycle): Promise<void>;
    /** Règles saisies, de la plus récente à la plus ancienne. */
    regles(coupleId: string): Promise<Regles[]>;
    ajouterRegles(coupleId: string, regles: Regles): Promise<void>;
    supprimerRegles(coupleId: string, id: string): Promise<void>;
    symptomes(coupleId: string): Promise<Symptome[]>;
    /** Remplace le symptôme du même jour et du même type, s'il existe. */
    noterSymptome(coupleId: string, symptome: Symptome): Promise<void>;
    retirerSymptome(coupleId: string, id: string): Promise<void>;
    effacerPourCouple(coupleId: string): Promise<void>;
  };
  appareils: {
    parPartenaire(partenaireId: PartenaireId): Promise<Appareil[]>;
    enregistrer(appareil: Appareil): Promise<void>;
    /**
     * Délie un appareil unique. Appelé quand FCM ou APNs répond que le jeton
     * n'existe plus : app désinstallée, jeton révoqué. Sans ça, on pousserait
     * indéfiniment vers un appareil qui n'écoute plus.
     */
    supprimerParJeton(jetonPush: string): Promise<void>;
    effacerPourPartenaire(partenaireId: PartenaireId): Promise<void>;
  };
}

export const MODULES_SENSIBLES: readonly ModuleSensible[] = [
  'position',
  'cycle',
  'croissance',
  'score',
  'confidences',
  'activite',
];
