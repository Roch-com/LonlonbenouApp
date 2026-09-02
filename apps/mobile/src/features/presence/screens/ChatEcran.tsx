import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton, Carte, EnTeteApp, Texte } from '@/components/ui';
import {
  chrome,
  colors,
  espacements,
  margeEcran,
  ombres,
  polices,
  rayons,
  typography,
} from '@/design/theme';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { cleDuJour, jourLisible } from '@/lib/temps';
import { ActionsMessage, type ActionMessage } from '../components/ActionsMessage';
import { BulleMessage } from '../components/BulleMessage';
import { LignePresence } from '../components/LignePresence';
import { BandeauEpingle } from '../components/BandeauEpingle';
import { PointsDeSaisie } from '../components/PointsDeSaisie';
import { SelecteurEmoji } from '../components/SelecteurEmoji';
import { BoutonVocal } from '../components/BoutonVocal';
import { SelecteurHumeur } from '../components/SelecteurHumeur';
import {
  useFilLisible,
  type MessageLisible,
} from '../hooks/useLecturesDechiffrees';
import { useChat, useNombreDeVerification } from '../stores/chatStore';
import { useActivite } from '../stores/activiteStore';
import { useAppels } from '../stores/appelStore';
import { usePresence } from '../stores/presenceStore';
import { dureeLisible, type Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';

/**
 * Pôle ① — Chat du couple, chiffré de bout en bout.
 *
 * Le serveur achemine des enveloppes qu'il ne peut pas ouvrir. Le clair
 * n'apparaît qu'ici, après déchiffrement local.
 */
/** Hauteur approchée de la barre de saisie, pour poser le bouton au-dessus. */
const HAUTEUR_BARRE_SAISIE = 64;

/**
 * Les emojis de réaction rapide.
 *
 * Six, comme dans les messageries qu'on connaît : assez pour couvrir ce qu'on
 * veut dire d'un geste, assez peu pour tenir sur une rangée sans défilement.
 * Ils sont volontairement tendres — c'est une conversation de couple, pas un
 * fil de commentaires.
 */
/**
 * Ce qu'on montre d'un message qu'on cite ou auquel on répond.
 *
 * Une note vocale n'a pas de texte : sans ce détour, l'aperçu serait vide et
 * la citation ressemblerait à un défaut d'affichage.
 */
function apercuDuMessage(message: MessageLisible): string {
  if (message.retire) return 'Ce message a été retiré';
  if (message.vocal) return `Note vocale · ${dureeLisible(message.vocal.dureeS)}`;
  return message.texte;
}

const EMOJIS_REACTION = ['❤️', '😍', '😂', '😮', '🥺', '👍'] as const;

export function ChatEcran() {
  const marges = useSafeAreaInsets();
  const router = useRouter();
  const autre = useAutre();

  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const cles = useChat((e) => e.cles);
  const horsLigne = useChat((e) => e.horsLigne);
  const erreur = useChat((e) => e.erreur);
  const preparerLesCles = useChat((e) => e.preparerLesCles);
  const charger = useChat((e) => e.charger);
  const envoyer = useChat((e) => e.envoyer);
  const marquerLus = useChat((e) => e.marquerLus);
  const chargerPresence = usePresence((e) => e.charger);
  const activiteAutre = useActivite((e) => e.autre);
  const battre = useActivite((e) => e.battre);

  const fil = useFilLisible();
  const nombre = useNombreDeVerification();

  const [brouillon, setBrouillon] = useState('');
  const [verificationOuverte, setVerificationOuverte] = useState(false);
  const liste = useRef<FlatList>(null);

  /**
   * « J'écris », en référence plutôt qu'en état.
   *
   * Chaque frappe changerait l'état et redessinerait toute la conversation —
   * une liste entière rerendue à chaque lettre. La référence est lue par le
   * battement, qui part de toute façon toutes les vingt secondes.
   */
  const ecritRef = useRef(false);

  /**
   * Vrai quand la vue est à quelques lignes du bas.
   *
   * Sert à décider si l'arrivée d'un message doit faire défiler. Sans cette
   * condition, la liste sautait en bas à chaque changement de contenu — y
   * compris pendant qu'on relisait une conversation d'il y a trois jours, ce
   * qui rendait la remontée dans l'historique proprement impossible.
   */
  const [presDuBas, setPresDuBas] = useState(true);
  const presDuBasRef = useRef(true);

  /** Message sur lequel la feuille d'actions est ouverte. */
  const [visee, setVisee] = useState<(typeof fil)[number] | undefined>();
  /** Message auquel le brouillon répond, s'il y en a un. */
  const [reponseA, setReponseA] = useState<(typeof fil)[number] | undefined>();

  const epingle = useChat((e) => e.epingle);
  const epingler = useChat((e) => e.epingler);
  const retirer = useChat((e) => e.retirer);
  const reagir = useChat((e) => e.reagir);

  /**
   * Le message épinglé, résolu depuis le fil déchiffré.
   *
   * Absent si l'épingle désigne un message qu'on ne trouve plus — le bandeau
   * disparaît alors plutôt que d'afficher un vide.
   */
  const messageEpingle = useMemo(
    () => (epingle ? fil.find((m) => m.id === epingle.messageId) : undefined),
    [epingle, fil],
  );

  const envoyerVocal = useChat((e) => e.envoyerVocal);
  const lancerAppel = useAppels((e) => e.appeler);
  /**
   * Message de circonstance : micro refusé, note trop courte, appel qui ne
   * peut pas partir. Refermable d'un appui.
   */
  const [erreurVocale, setErreurVocale] = useState<string>();
  const erreurAppel = useAppels((e) => e.erreur);

  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  /** Stable d'un rendu à l'autre : les bulles sont mémoïsées. */
  const viser = useCallback((message: MessageLisible) => {
    // Un retour tactile confirme que l'appui long a été compris, avant même
    // que la feuille n'apparaisse.
    void Haptics.selectionAsync();
    setVisee(message);
  }, []);

  const [clavierOuvert, setClavierOuvert] = useState(false);
  const [emojisOuverts, setEmojisOuverts] = useState(false);
  const navigation = useNavigation();

  /**
   * La barre d'onglets s'efface quand le clavier monte.
   *
   * Elle est en position absolue : sans cela elle se retrouve posée sur le
   * clavier, et l'espace qu'on lui réserve pousse le champ de saisie hors de
   * l'écran — on écrivait sans voir ce qu'on écrivait. C'est aussi ce que font
   * les messageries : pendant qu'on écrit, la navigation n'a rien à faire là.
   */
  useEffect(() => {
    const parent = navigation.getParent();
    const montre = Keyboard.addListener('keyboardDidShow', () => {
      setClavierOuvert(true);
      setEmojisOuverts(false);
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
    });
    const cache = Keyboard.addListener('keyboardDidHide', () => {
      setClavierOuvert(false);
      parent?.setOptions({ tabBarStyle: undefined });
    });

    return () => {
      montre.remove();
      cache.remove();
      // Quitter l'écran clavier ouvert laisserait la barre cachée ailleurs.
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  /**
   * Fil prêt à afficher : séparateurs de jour intercalés, et pour chaque
   * message ce qu'il faut savoir de ses voisins.
   *
   * Calculé une fois par changement du fil plutôt qu'à chaque ligne rendue :
   * `renderItem` est rappelé au défilement, et y refaire ces comparaisons
   * coûterait à chaque image.
   */
  const lignes = useMemo(() => {
    type Ligne =
      | { sorte: 'jour'; cle: string; libelle: string }
      | {
          sorte: 'message';
          cle: string;
          message: (typeof fil)[number];
          suiteDuPrecedent: boolean;
          dernierDuGroupe: boolean;
        };

    const resultat: Ligne[] = [];
    let jourCourant: string | undefined;

    fil.forEach((message, i) => {
      const jour = cleDuJour(message.envoyeLe);
      if (jour !== jourCourant) {
        jourCourant = jour;
        resultat.push({
          sorte: 'jour',
          cle: `jour-${jour}`,
          libelle: jourLisible(message.envoyeLe),
        });
      }

      const precedent = fil[i - 1];
      const suivant = fil[i + 1];
      const memeAuteur = (voisin?: (typeof fil)[number]) =>
        !!voisin && voisin.auteurId === message.auteurId;

      resultat.push({
        sorte: 'message',
        cle: message.id,
        message,
        suiteDuPrecedent:
          memeAuteur(precedent) &&
          cleDuJour(precedent!.envoyeLe) === jour &&
          precedent!.type === message.type,
        dernierDuGroupe:
          !memeAuteur(suivant) ||
          cleDuJour(suivant!.envoyeLe) !== jour ||
          suivant!.type !== message.type,
      });
    });

    return resultat;
  }, [fil]);

  /**
   * Ce qu'affiche chaque bulle qui répond à une autre.
   *
   * Résolu une fois pour tout le fil plutôt qu'à chaque bulle : chercher le
   * message cité dans `renderItem` referait un parcours complet de la liste
   * à chaque ligne rendue, donc à chaque image du défilement.
   */
  const citations = useMemo(() => {
    const parId = new Map(fil.map((m) => [m.id, m]));
    const table = new Map<string, { auteurEstMoi: boolean; texte: string }>();

    for (const message of fil) {
      if (!message.repondA) continue;
      const source = parId.get(message.repondA);
      // Le message cité peut avoir été envoyé avant une réinstallation, et
      // rester illisible : on n'affiche pas un rappel vide.
      if (!source || source.illisible) continue;

      table.set(message.id, {
        auteurEstMoi: source.auteurId === partenaireId,
        texte: apercuDuMessage(source),
      });
    }

    return table;
  }, [fil, partenaireId]);

  useEffect(() => {
    if (!connecte || !coupleId || !partenaireId) return;
    void (async () => {
      await preparerLesCles(coupleId);
      await charger(coupleId, partenaireId);
      await chargerPresence(coupleId, partenaireId);
      await marquerLus(coupleId);
    })();
  }, [
    connecte,
    coupleId,
    partenaireId,
    preparerLesCles,
    charger,
    chargerPresence,
    marquerLus,
  ]);
  /**
   * Relecture régulière tant que la conversation est à l'écran.
   *
   * Le fil ne se chargeait qu'au montage : un message envoyé par l'autre
   * n'apparaissait qu'en quittant l'écran et en y revenant. D'où l'impression
   * de messages qui mettent « deux minutes » — ils étaient là depuis le début,
   * personne n'était allé les chercher.
   *
   * Quatre secondes : assez pour qu'une conversation vive se sente immédiate,
   * assez peu pour ne pas transformer chaque discussion en salve de requêtes.
   * Ce n'est pas du temps réel — un canal ouvert le ferait mieux et coûterait
   * moins — mais c'est ce qui donne le plus de confort pour le moins de travail
   * à ce stade.
   *
   * Le sondage s'arrête dès que l'écran perd le premier plan, et dès que
   * l'application passe en arrière-plan : interroger le serveur toutes les
   * quatre secondes dans la poche de quelqu'un userait sa batterie pour rien.
   */
  useFocusEffect(
    useCallback(() => {
      if (!connecte || !coupleId || !partenaireId) return;

      let vivant = true;
      const relire = () => {
        if (vivant && AppState.currentState === 'active') {
          void charger(coupleId, partenaireId);
        }
      };

      relire();
      const minuterie = setInterval(relire, 4000);

      return () => {
        vivant = false;
        clearInterval(minuterie);
      };
    }, [connecte, coupleId, partenaireId, charger]),
  );

  /**
   * Battement de présence, tant que la conversation est à l'écran.
   *
   * Vingt secondes pour un seuil « en ligne » d'une minute : deux battements
   * peuvent se perdre sans que l'autre nous croie parti. C'est ce qui évite
   * le clignotement sur une connexion hésitante.
   *
   * Le battement est émis **ici et pas dans le store** : seul l'écran sait
   * qu'il est visible, et se signaler présent depuis une app rangée dans une
   * poche serait un mensonge — exactement celui que le seuil doit éviter.
   */
  useFocusEffect(
    useCallback(() => {
      if (!connecte || !coupleId) return;

      let vivant = true;
      const signaler = () => {
        if (vivant && AppState.currentState === 'active') {
          void battre(coupleId, ecritRef.current);
        }
      };

      signaler();
      const minuterie = setInterval(signaler, 20_000);

      return () => {
        vivant = false;
        clearInterval(minuterie);
        // Quitter l'écran, c'est cesser d'écrire. Sans ce dernier signal,
        // « écrit… » resterait affiché chez l'autre jusqu'à l'échéance.
        if (ecritRef.current && coupleId) {
          ecritRef.current = false;
          void battre(coupleId, false);
        }
      };
    }, [connecte, coupleId, battre]),
  );

  if (etat === 'anonyme' || (etat === 'connecte' && !coupleId)) {
    return (
      <View style={[styles.fond, styles.centre, { paddingTop: marges.top }]}>
        <Carte>
          <Texte variante="titre">
            Une conversation a besoin de deux appareils
          </Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            Les messages sont chiffrés de bout en bout : il faut un compte de chaque
            côté pour que les clés puissent s’échanger.
          </Texte>
          <View style={styles.action}>
            <Bouton
              libelle={etat === 'anonyme' ? 'Se connecter' : 'Relier nos comptes'}
              onPress={() =>
                router.push(etat === 'anonyme' ? '/connexion' : '/appairage')
              }
            />
          </View>
        </Carte>
      </View>
    );
  }

  /**
   * Actions de la feuille.
   *
   * Le retrait ne s'offre que sur ses propres messages : effacer la parole de
   * l'autre n'est pas une fonctionnalité, c'est une prise de pouvoir. Il est
   * posé en dernier et teinté, pour qu'on ne le touche pas par accident en
   * cherchant « Répondre ».
   *
   * Un message retiré ne garde qu'une action : le décrocher s'il était
   * épinglé. Il n'y a plus de texte à copier ni à citer.
   */
  const actionsSurMessage: ActionMessage[] = visee
    ? [
        ...(visee.illisible || visee.retire
          ? []
          : [
              {
                icone: 'corner-up-left' as const,
                libelle: 'Répondre',
                onPress: () => setReponseA(visee),
              },
              {
                icone: 'copy' as const,
                libelle: 'Copier le texte',
                onPress: () => void Clipboard.setStringAsync(visee.texte),
              },
            ]),
        ...(visee.retire
          ? []
          : [
              epingle?.messageId === visee.id
                ? {
                    icone: 'bookmark' as const,
                    libelle: 'Décrocher l’épingle',
                    onPress: () => void epingler(coupleId!),
                  }
                : {
                    icone: 'bookmark' as const,
                    libelle: 'Épingler ce message',
                    onPress: () => void epingler(coupleId!, visee.id),
                  },
            ]),
        ...(visee.auteurId === partenaireId && !visee.retire
          ? [
              {
                icone: 'trash-2' as const,
                libelle: 'Retirer pour nous deux',
                destructive: true,
                onPress: () => void retirer(coupleId!, visee.id),
              },
            ]
          : []),
      ]
    : [];

  /**
   * Envoi d'un message.
   *
   * ## Le champ se vide avant la réponse du serveur
   *
   * Il attendait l'aller-retour complet. Pendant ce temps le texte restait
   * visible et le bouton actif : on croyait que rien n'était parti, on
   * réappuyait, et le message partait autant de fois qu'on avait appuyé — dix
   * fois n'était pas rare. Vider tout de suite supprime la cause.
   *
   * ## Et un verrou par-dessus
   *
   * Le champ vidé ne suffit pas : deux appuis très rapprochés peuvent tomber
   * avant le premier rendu. `envoiEnCours` ferme la porte jusqu'au retour.
   *
   * En cas d'échec, le texte revient dans le champ. Un message perdu parce
   * que le réseau a lâché serait pire que le voir partir deux fois.
   */
  const envoyerLe = async (type: 'texte' | 'note_douce' = 'texte') => {
    const texte = brouillon.trim();
    if (!texte || !coupleId || !partenaireId || envoiEnCours) return;

    const citation = reponseA;
    setBrouillon('');
    setReponseA(undefined);
    setEnvoiEnCours(true);

    // Le message est parti : on n'écrit plus. Sans ce signal, « écrit… »
    // s'afficherait encore chez l'autre au-dessus du message reçu.
    if (ecritRef.current) {
      ecritRef.current = false;
      void battre(coupleId, false);
    }

    try {
      const ok = await envoyer(coupleId, partenaireId, texte, type, citation?.id);
      if (!ok) {
        setBrouillon(texte);
        if (citation) setReponseA(citation);
      }
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.fond}
      // `padding` sur les deux plateformes : le contrôleur fournit la hauteur
      // réelle du clavier, là où le comportement natif d'Android ne la donne
      // plus depuis le passage au bord-à-bord.
      behavior="padding"
    >
      <EnTeteApp
        titre={autre.prenom}
        surtitre="Nous deux"
        sousTitre={
          <LignePresence activite={activiteAutre} />
        }
        actions={
          coupleId
            ? [
                {
                  icone: 'phone' as const,
                  libelle: `Appeler ${autre.prenom}`,
                  onPress: () => {
                    setErreurVocale(undefined);
                    void lancerAppel(coupleId, 'audio');
                  },
                },
                {
                  icone: 'video' as const,
                  libelle: `Appeler ${autre.prenom} en vidéo`,
                  onPress: () => {
                    setErreurVocale(undefined);
                    void lancerAppel(coupleId, 'video');
                  },
                },
              ]
            : []
        }
      />

      {/* Sous l'en-tête et au-dessus du fil : il doit rester visible quoi
          qu'on fasse défiler, c'est tout l'intérêt d'une épingle. */}
      {messageEpingle ? (
        <BandeauEpingle
          message={messageEpingle}
          deMoi={messageEpingle.auteurId === partenaireId}
          prenomAutre={autre.prenom}
          onOuvrir={() => {
            const index = lignes.findIndex(
              (l) => l.sorte === 'message' && l.message.id === messageEpingle.id,
            );
            // `viewPosition: 0.5` amène le message au milieu de l'écran : en
            // haut, il serait collé sous le bandeau et on ne verrait pas ce
            // qui l'entoure.
            if (index >= 0) {
              liste.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5,
              });
            }
          }}
          onDecrocher={() => coupleId && void epingler(coupleId)}
        />
      ) : null}

      <FlatList
        ref={liste}
        data={lignes}
        keyExtractor={(l) => l.cle}
        // Virtualisation resserrée. Par défaut, la liste garde une vingtaine
        // d'écrans montés de part et d'autre : sur un long fil et un téléphone
        // modeste, c'est ce qui fait saccader le défilement.
        //
        // `removeClippedSubviews` n'est pas activé : il vide les vues sorties
        // du champ, et sur des bulles de hauteurs inégales il laisse des trous
        // blancs à la remontée.
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={[styles.contenu, { paddingTop: espacements.md }]}
        ListHeaderComponent={
          <View style={styles.entete}>
            <Carte>
              <SelecteurHumeur />
            </Carte>

            {!cles?.echangePret ? (
              <Carte discrete>
                <Texte variante="petit">
                  {cles?.mienne
                    ? `${autre.prenom} n’a pas encore ouvert la conversation sur son appareil. Tant que sa clé n’est pas publiée, rien ne peut être chiffré pour lui.`
                    : 'Préparation de vos clés de chiffrement…'}
                </Texte>
              </Carte>
            ) : null}

            {fil.some((m) => m.illisible) ? (
              <Carte discrete>
                <Texte variante="surtitre">Messages d’avant</Texte>
                <Texte variante="petit" style={styles.intro}>
                  Certains messages ont été chiffrés avec des clés qui n’existent
                  plus sur cet appareil — après une réinstallation, par exemple. Ils
                  restent illisibles ici, et le resteront : personne, pas même le
                  serveur, ne peut les rouvrir. C’est la contrepartie du chiffrement
                  de bout en bout.
                </Texte>
                <Texte variante="meta" style={styles.intro}>
                  Tout ce que vous vous écrivez maintenant s’ouvre normalement.
                </Texte>
              </Carte>
            ) : null}

            {horsLigne ? (
              <Carte discrete>
                <Texte variante="petit">
                  Sans connexion. Vous voyez la conversation telle qu’elle était ;
                  rien ne peut partir pour l’instant.
                </Texte>
              </Carte>
            ) : null}

            {erreur ? (
              <Carte discrete>
                <Texte variante="petit" style={styles.erreur}>
                  {erreur}
                </Texte>
              </Carte>
            ) : null}

            {nombre ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setVerificationOuverte((v) => !v)}
              >
                <Carte discrete>
                  <Texte variante="meta">
                    Chiffré de bout en bout · toucher pour vérifier
                  </Texte>
                  {verificationOuverte ? (
                    <>
                      <Texte variante="sousTitre" style={styles.nombre}>
                        {nombre}
                      </Texte>
                      <Texte variante="meta">
                        Comparez ce nombre à voix haute avec {autre.prenom}. S’il
                        diffère, quelqu’un s’est interposé — et le serveur ne
                        pourrait pas vous le dire lui-même.
                      </Texte>
                    </>
                  ) : null}
                </Carte>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Texte variante="corpsDoux" style={styles.vide}>
            Rien encore. Le premier mot est souvent le plus simple.
          </Texte>
        }
        renderItem={({ item }) =>
          item.sorte === 'jour' ? (
            <View style={styles.jour}>
              <Texte variante="meta" style={styles.jourTexte}>
                {item.libelle}
              </Texte>
            </View>
          ) : (
            <BulleMessage
              message={item.message}
              deMoi={item.message.auteurId === partenaireId}
              suiteDuPrecedent={item.suiteDuPrecedent}
              dernierDuGroupe={item.dernierDuGroupe}
              cite={citations.get(item.message.id)}
              onAppuiLong={viser}
              {...(item.message.retire || item.message.illisible
                ? {}
                : { onGlisserPourRepondre: setReponseA })}
            />
          )
        }
        ListFooterComponent={
          // Dans le fil et pas seulement dans l'en-tête : c'est là que le
          // regard se trouve quand on attend une réponse.
          activiteAutre?.ecrit ? (
            <View style={styles.saisieBulle}>
              <PointsDeSaisie taille={6} />
            </View>
          ) : null
        }
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const restant =
            contentSize.height - layoutMeasurement.height - contentOffset.y;
          // Une hauteur d'écran de tolérance : on considère qu'on « suit » la
          // conversation sans exiger d'être collé au dernier pixel.
          const proche = restant < layoutMeasurement.height * 0.5;
          presDuBasRef.current = proche;
          if (proche !== presDuBas) setPresDuBas(proche);
        }}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (presDuBasRef.current) {
            liste.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {/* La barre d'onglets est en position absolue : sans sa hauteur ajoutée
          ici, le champ de saisie disparaissait derrière elle. */}
      {!presDuBas ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir aux derniers messages"
          onPress={() => liste.current?.scrollToEnd({ animated: true })}
          style={({ pressed }) => [
            styles.retourBas,
            {
              // Même calcul que la barre de saisie : sans cela le bouton
              // resterait à sa place quand le clavier monte et la barre
              // passerait par-dessus.
              bottom:
                (clavierOuvert ? 0 : marges.bottom + chrome.barreOnglets) +
                HAUTEUR_BARRE_SAISIE,
            },
            pressed && styles.envoiPresse,
          ]}
        >
          <Feather name="chevron-down" size={20} color={colors.texte} />
        </Pressable>
      ) : null}

      {reponseA ? (
        <View style={styles.reponse}>
          <View style={styles.reponseTexte}>
            <Texte variante="meta">
              Réponse à {reponseA.auteurId === partenaireId ? 'vous' : autre.prenom}
            </Texte>
            <Texte variante="petit" numberOfLines={1}>
              {apercuDuMessage(reponseA)}
            </Texte>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler la réponse"
            hitSlop={10}
            onPress={() => setReponseA(undefined)}
          >
            <Feather name="x" size={18} color={colors.texteDoux} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.barre,
          {
            // Clavier fermé, il faut dégager la barre d'onglets ; clavier
            // ouvert, elle est masquée et lui réserver sa hauteur creuserait
            // un vide sous le champ de saisie.
            paddingBottom: clavierOuvert
              ? espacements.sm
              : marges.bottom + chrome.barreOnglets + espacements.sm,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            emojisOuverts ? 'Fermer les emoji' : 'Ouvrir les emoji'
          }
          onPress={() => {
            // Ouvrir le panneau referme le clavier système : les deux à la
            // fois ne laisseraient plus rien voir de la conversation.
            if (!emojisOuverts) Keyboard.dismiss();
            setEmojisOuverts((ouvert) => !ouvert);
          }}
          style={({ pressed }) => [styles.emoji, pressed && styles.envoiPresse]}
        >
          <Feather
            name={emojisOuverts ? 'x' : 'smile'}
            size={20}
            color={colors.texteDoux}
          />
        </Pressable>

        <TextInput
          style={styles.saisie}
          placeholder="Écrire à deux…"
          placeholderTextColor={colors.texteDoux}
          value={brouillon}
          onChangeText={(texte) => {
            setBrouillon(texte);
            // Première lettre : on le dit tout de suite plutôt que d'attendre
            // le prochain battement, sinon « écrit… » arriverait après le
            // message pour un mot vite tapé. Le champ vidé coupe le signal.
            const ecrit = texte.trim().length > 0;
            if (ecrit !== ecritRef.current) {
              ecritRef.current = ecrit;
              if (coupleId) void battre(coupleId, ecrit);
            }
          }}
          multiline
        />
        {/* Le micro cède la place à la flèche dès qu'on écrit : c'est
            l'usage, et ça évite deux boutons d'envoi côte à côte. */}
        {brouillon.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            onPress={() => void envoyerLe()}
            disabled={!cles?.echangePret || envoiEnCours}
            style={({ pressed }) => [
              styles.envoi,
              (!cles?.echangePret || envoiEnCours) && styles.envoiInactif,
              pressed && styles.envoiPresse,
            ]}
          >
            <Texte variante="sousTitre" style={styles.envoiTexte}>
              ↑
            </Texte>
          </Pressable>
        ) : (
          <BoutonVocal
            desactive={!cles?.echangePret}
            onErreur={(message) => setErreurVocale(message)}
            onEnvoyer={async (uri, dureeS) => {
              if (!coupleId || !partenaireId) return false;
              setErreurVocale(undefined);
              return envoyerVocal(coupleId, partenaireId, uri, dureeS);
            }}
          />
        )}
      </View>

      {erreurVocale || erreurAppel ? (
        <Pressable
          onPress={() => setErreurVocale(undefined)}
          accessibilityRole="button"
          accessibilityLabel="Masquer ce message"
          style={styles.erreurVocale}
        >
          <Texte variante="petit">{erreurVocale ?? erreurAppel}</Texte>
        </Pressable>
      ) : null}

      <ActionsMessage
        visible={!!visee}
        emojis={visee && !visee.retire ? EMOJIS_REACTION : []}
        {...(visee
          ? {
              emojiChoisi: visee.reactions.find(
                (r) => r.partenaireId === partenaireId,
              )?.emoji,
            }
          : {})}
        onReagir={(emoji) => {
          if (!visee || !coupleId) return;
          // Toucher l'emoji déjà posé le retire : c'est le comportement
          // attendu, et la seule façon de se raviser sans autre bouton.
          const mien = visee.reactions.find(
            (r) => r.partenaireId === partenaireId,
          )?.emoji;
          void reagir(coupleId, visee.id, mien === emoji ? undefined : emoji);
        }}
        onFermer={() => setVisee(undefined)}
        actions={actionsSurMessage}
      />

      {emojisOuverts ? (
        <View style={{ paddingBottom: marges.bottom }}>
          <SelecteurEmoji
            onChoisir={(emoji) => setBrouillon((texte) => texte + emoji)}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  // Au-dessus de la barre de saisie, et refermable d'un appui : c'est un
  // message de circonstance, pas un état durable de la conversation.
  erreurVocale: {
    marginHorizontal: margeEcran,
    marginBottom: espacements.xs,
    padding: espacements.sm,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
  },
  fond: { flex: 1, backgroundColor: colors.fond },
  centre: { justifyContent: 'center', paddingHorizontal: margeEcran },
  intro: { marginTop: espacements.xs },
  action: { marginTop: espacements.lg },
  entete: { gap: espacements.md, marginBottom: espacements.md },
  contenu: {
    paddingHorizontal: margeEcran,
    paddingBottom: espacements.md,
    gap: espacements.sm,
  },
  nombre: { marginTop: espacements.xs, letterSpacing: 2 },
  /** Bulle vide à gauche, aux dimensions d'un message court. */
  /**
   * Bouton de retour en bas. Au-dessus de la barre de saisie et aligné à
   * droite, là où le pouce l'atteint sans changer la prise du téléphone.
   */
  retourBas: {
    position: 'absolute',
    right: margeEcran,
    width: 40,
    height: 40,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondEleve,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
    ...ombres.flottant,
  },
  /** Rappel du message auquel on répond, juste au-dessus du champ. */
  reponse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
    marginHorizontal: margeEcran,
    marginBottom: espacements.xxs,
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  reponseTexte: { flex: 1, minWidth: 0, gap: 1 },
  saisieBulle: {
    alignSelf: 'flex-start',
    marginTop: espacements.sm,
    paddingVertical: espacements.sm + 2,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.lg,
    borderBottomLeftRadius: rayons.sm,
    backgroundColor: colors.fondEleve,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
  jour: {
    alignSelf: 'center',
    marginVertical: espacements.md,
    paddingVertical: espacements.xxs,
    paddingHorizontal: espacements.sm,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
  },
  jourTexte: { textTransform: 'capitalize' },
  vide: { textAlign: 'center', marginTop: espacements.xl },
  erreur: { color: colors.tendresse },
  barre: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacements.xs,
    paddingHorizontal: margeEcran,
    paddingTop: espacements.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
    backgroundColor: colors.fondEleve,
    ...ombres.effleuree,
  },
  emoji: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saisie: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.sm,
    borderRadius: rayons.lg,
    backgroundColor: colors.fond,
    fontFamily: polices.corps,
    fontSize: typography.tailles.corps,
    color: colors.texte,
  },
  envoi: {
    width: 48,
    height: 48,
    borderRadius: rayons.rond,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envoiInactif: { opacity: 0.4 },
  envoiPresse: { opacity: 0.85 },
  envoiTexte: { color: colors.texteInverse },
}));
