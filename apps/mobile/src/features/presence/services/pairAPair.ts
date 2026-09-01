/**
 * La liaison pair-à-pair d'un appel.
 *
 * ## Ce qui passe où
 *
 * Le son et l'image vont **directement** d'un téléphone à l'autre, chiffrés
 * par WebRTC. Aucun serveur ne les relaie, donc aucun serveur ne peut les
 * écouter. Seule la négociation transite par le nôtre, et elle est scellée.
 *
 * ## STUN, et pourquoi TURN manquera parfois
 *
 * Deux téléphones derrière une box ne connaissent pas leur adresse publique :
 * un serveur STUN la leur dit, et ils se joignent ensuite directement. C'est
 * gratuit et ça suffit dans la plupart des cas — notamment quand au moins l'un
 * des deux est sur une connexion domestique.
 *
 * Sur un réseau mobile, les deux sont souvent derrière un NAT d'opérateur qui
 * interdit toute liaison directe. Il faut alors un serveur **TURN**, qui
 * relaie le flux chiffré. Il n'est pas fourni ici : `SERVEURS_ICE` se
 * configure par variable d'environnement, pour qu'ouvrir un TURN plus tard
 * soit un réglage et non une reprise du code.
 *
 * Concrètement, sans TURN : les appels aboutissent le plus souvent depuis la
 * maison, et échouent parfois en déplacement. C'est un compromis assumé pour
 * livrer sans attendre un service payant.
 */
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

/**
 * Serveurs de découverte réseau.
 *
 * Les STUN publics de Google par défaut : ils ne voient passer aucun flux, ils
 * répondent seulement « voici l'adresse d'où tu m'écris ».
 *
 * `EXPO_PUBLIC_SERVEURS_ICE` permet d'en ajouter — un TURN, notamment — sous
 * la forme d'un JSON de `RTCIceServer`.
 */
export const SERVEURS_ICE: RTCIceServer[] = (() => {
  const configures = process.env['EXPO_PUBLIC_SERVEURS_ICE'];
  if (configures) {
    try {
      const analyses = JSON.parse(configures) as RTCIceServer[];
      if (Array.isArray(analyses) && analyses.length > 0) return analyses;
    } catch {
      // Configuration illisible : on retombe sur les STUN publics plutôt que
      // de partir sans aucun serveur, ce qui empêcherait tout appel.
    }
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
})();

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface Liaison {
  /** Ce que la caméra et le micro produisent ici. */
  fluxLocal: MediaStream;
  /** Ce qui arrive d'en face. Absent tant que rien n'est reçu. */
  fluxDistant?: MediaStream;
  connexion: RTCPeerConnection;
  /** Coupe tout : pistes, connexion, matériel. */
  raccrocher: () => void;
  couperLeMicro: (coupe: boolean) => void;
  couperLaCamera: (coupe: boolean) => void;
  /** Bascule entre caméra avant et arrière. */
  retournerLaCamera: () => void;
}

interface Options {
  video: boolean;
  /** Appelé pour chaque chemin réseau découvert : à sceller et à envoyer. */
  onCandidat: (candidat: unknown) => void;
  onFluxDistant: (flux: MediaStream) => void;
  /** Appelé quand la liaison échoue ou se rompt. */
  onEchec: () => void;
}

/**
 * Prépare le matériel et la connexion.
 *
 * Le micro et la caméra sont ouverts **avant** toute négociation : sans
 * pistes, l'offre décrirait une session vide et l'autre n'entendrait rien.
 */
export async function ouvrirLiaison({
  video,
  onCandidat,
  onFluxDistant,
  onEchec,
}: Options): Promise<Liaison> {
  const fluxLocal = (await mediaDevices.getUserMedia({
    audio: true,
    video: video ? { facingMode: 'user' } : false,
  })) as MediaStream;

  const connexion = new RTCPeerConnection({ iceServers: SERVEURS_ICE });

  for (const piste of fluxLocal.getTracks()) {
    connexion.addTrack(piste, fluxLocal);
  }

  let distant: MediaStream | undefined;

  connexion.onicecandidate = (evenement: { candidate: unknown }) => {
    if (evenement.candidate) onCandidat(evenement.candidate);
  };

  connexion.ontrack = (evenement: { streams: MediaStream[] }) => {
    const flux = evenement.streams[0];
    if (flux && flux !== distant) {
      distant = flux;
      onFluxDistant(flux);
    }
  };

  connexion.onconnectionstatechange = () => {
    const etat = (connexion as unknown as { connectionState: string })
      .connectionState;
    // `failed` est définitif ; `disconnected` peut se réparer tout seul, on ne
    // raccroche donc pas dessus.
    if (etat === 'failed' || etat === 'closed') onEchec();
  };

  const trouverPiste = (sorte: 'audio' | 'video') =>
    fluxLocal.getTracks().find((p) => p.kind === sorte);

  return {
    fluxLocal,
    connexion,

    raccrocher() {
      for (const piste of fluxLocal.getTracks()) piste.stop();
      // Sans `close`, la connexion garde le micro ouvert : le voyant reste
      // allumé après l'appel, ce qui inquiète à juste titre.
      connexion.close();
    },

    couperLeMicro(coupe) {
      const piste = trouverPiste('audio');
      if (piste) piste.enabled = !coupe;
    },

    couperLaCamera(coupe) {
      const piste = trouverPiste('video');
      if (piste) piste.enabled = !coupe;
    },

    retournerLaCamera() {
      const piste = trouverPiste('video') as unknown as {
        _switchCamera?: () => void;
      };
      piste?._switchCamera?.();
    },
  };
}

/** L'offre de l'appelant. */
export async function creerOffre(
  connexion: RTCPeerConnection,
): Promise<unknown> {
  const offre = await connexion.createOffer({});
  await connexion.setLocalDescription(offre);
  return offre;
}

/** La réponse de celui qui décroche. */
export async function creerReponse(
  connexion: RTCPeerConnection,
  offre: unknown,
): Promise<unknown> {
  await connexion.setRemoteDescription(
    new RTCSessionDescription(offre as never),
  );
  const reponse = await connexion.createAnswer();
  await connexion.setLocalDescription(reponse);
  return reponse;
}

/** L'appelant reçoit la réponse. */
export async function accepterReponse(
  connexion: RTCPeerConnection,
  reponse: unknown,
): Promise<void> {
  await connexion.setRemoteDescription(
    new RTCSessionDescription(reponse as never),
  );
}

/**
 * Ajoute un chemin réseau reçu.
 *
 * Les candidats arrivent souvent avant que la description distante ne soit
 * posée ; WebRTC les refuse alors. L'erreur est avalée : le protocole en
 * enverra d'autres, et un candidat perdu ne compromet pas la liaison.
 */
export async function ajouterCandidat(
  connexion: RTCPeerConnection,
  candidat: unknown,
): Promise<void> {
  try {
    await connexion.addIceCandidate(new RTCIceCandidate(candidat as never));
  } catch {
    // Sans conséquence : d'autres chemins suivront.
  }
}
