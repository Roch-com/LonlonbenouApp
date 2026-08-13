/**
 * Pôle ⑥ — Dissociation de compte.
 *
 * Une rupture n'est pas un désabonnement. La règle est simple et vaut dans les
 * deux sens : **plus personne n'accède à rien**. Il n'existe pas d'état où l'un
 * garderait la position, le chat, le cycle ou les confidences de l'autre après
 * la séparation — ce serait exactement l'observation à sens unique que les
 * garde-fous interdisent.
 *
 * L'ordre des opérations compte. La clé du coffre part **en premier** : à cet
 * instant précis, tout ce qui est chiffré sur l'appareil devient illisible,
 * même si l'effacement qui suit était interrompu (batterie, plantage, retrait
 * de l'app). C'est ce qui rend la révocation immédiate plutôt que
 * « normalement complète ».
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerPartage, type ModuleSensible } from '@lonlonbenu/shared';
import { oublierLaCle } from '@/lib/chiffrement';
import { useChat } from '@/features/presence/stores/chatStore';
import { usePresence } from '@/features/presence/stores/presenceStore';
import { useAxes } from '@/features/croissance/stores/axesStore';
import { useConfidences } from '@/features/croissance/stores/confidencesStore';
import { useViePratique } from '@/features/vie-pratique/stores/viePratiqueStore';
import { useCycle } from '@/features/intimite/stores/cycleStore';
import { useSession } from '../stores/sessionStore';
import { useNotifications } from '../stores/notificationsStore';
import { usePush } from '../stores/pushStore';
import { useVerrou } from '../stores/verrouStore';
import { effacerVerificateur } from './secretVerrou';
import { effacerLaPaire } from '@/features/presence/services/clesMessages';

/** Modules dont les accès croisés sont révoqués. Sert aussi de texte à l'écran. */
export const ACCES_REVOQUES = [
  'la position et les statuts de présence',
  'la conversation, les notes douces et les humeurs',
  'le cycle et tout ce qui s’y rattache',
  'les confidences, gratitudes et lettres',
  'les axes de croissance et le score d’implication',
  'l’agenda, les projets et le journal des sorties',
] as const;

const ESPACES_PERSISTES = [
  'lonlonbenu.session',
  'lonlonbenu.presence',
  'lonlonbenu.chat',
  'lonlonbenu.axes',
  'lonlonbenu.confidences',
  'lonlonbenu.verrou',
  'lonlonbenu.notifications',
  'lonlonbenu.vie-pratique',
  'lonlonbenu.cycle',
  'lonlonbenu.push',
] as const;

export interface RapportDissociation {
  cleEffacee: boolean;
  espacesEffaces: number;
}

/**
 * Coupe tous les accès croisés et rend les données locales illisibles.
 * Irréversible : il n'y a pas de sauvegarde, c'est le principe.
 */
export async function dissocierLeCouple(): Promise<RapportDissociation> {
  // 1. La clé d'abord : à partir d'ici, plus rien n'est déchiffrable.
  await oublierLaCle();

  // 2. Le code de verrouillage, qui n'a plus d'objet.
  await effacerVerificateur();

  // La paire de cles de messages : sans elle, aucune enveloppe residuelle
  // ne pourra jamais etre ouverte, meme si une copie en subsistait.
  await effacerLaPaire();

  // L'inscription push locale. Côté serveur, l'endpoint de dissociation délie
  // les appareils des deux partenaires — mais garder ici la trace d'un jeton
  // inscrit ferait croire à une inscription qui n'existe plus.
  await usePush.getState().oublier();

  // 3. Les enveloppes elles-mêmes, pour ne pas laisser de résidus illisibles.
  await AsyncStorage.multiRemove([...ESPACES_PERSISTES]);

  // 4. La mémoire vive, sinon l'écran continuerait d'afficher ce qui vient
  //    d'être révoqué jusqu'au prochain lancement.
  useChat.persist.clearStorage();
  usePresence.persist.clearStorage();
  useAxes.persist.clearStorage();
  useConfidences.persist.clearStorage();
  useSession.persist.clearStorage();
  useVerrou.persist.clearStorage();
  useNotifications.persist.clearStorage();
  useViePratique.persist.clearStorage();
  useCycle.persist.clearStorage();
  usePush.persist.clearStorage();

  useChat.getState().vider();
  usePresence.getState().vider();
  useAxes.getState().vider();
  useConfidences.getState().vider();
  useViePratique.getState().vider();
  useCycle.getState().vider();
  useVerrou.setState({
    actif: false,
    deverrouille: true,
    echecs: 0,
    dernierEchecLe: undefined,
    masqueDepuis: undefined,
  });

  // 5. Le journal de notifications, qui contient l'historique des partages.
  useNotifications.setState({ journal: [], preferences: {} });

  // 6. Tous les consentements retombent à zéro, des deux côtés à la fois.
  //    Aucun partage ne survit. Le cycle, lui, appartient au serveur : c'est
  //    l'endpoint de dissociation qui l'efface.
  const { couple, partages } = useSession.getState();
  const [unPartenaire, lAutre] = couple.partenaires;
  useSession.setState({
    partages: Object.fromEntries(
      Object.keys(partages).map((module) => [
        module,
        creerPartage(module as ModuleSensible, unPartenaire.id, lAutre.id, false),
      ]),
    ),
  });

  return { cleEffacee: true, espacesEffaces: ESPACES_PERSISTES.length };
}

/**
 * Renvoie l'app à son point de départ. Séparé de `dissocierLeCouple` à dessein :
 * si l'onboarding réapparaissait immédiatement, l'écran de confirmation
 * disparaîtrait sous les yeux de la personne. On attend qu'elle ferme.
 */
export function repartirDeZero(): void {
  useSession.setState({ onboardingFait: false, nomEspace: 'Notre espace' });
}
