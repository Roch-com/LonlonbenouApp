import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
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
import { BulleMessage } from '../components/BulleMessage';
import { SelecteurHumeur } from '../components/SelecteurHumeur';
import { useFilLisible } from '../hooks/useLecturesDechiffrees';
import { useChat, useNombreDeVerification } from '../stores/chatStore';
import { usePresence } from '../stores/presenceStore';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';

/**
 * Pôle ① — Chat du couple, chiffré de bout en bout.
 *
 * Le serveur achemine des enveloppes qu'il ne peut pas ouvrir. Le clair
 * n'apparaît qu'ici, après déchiffrement local.
 */
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

  const fil = useFilLisible();
  const nombre = useNombreDeVerification();

  const [brouillon, setBrouillon] = useState('');
  const [verificationOuverte, setVerificationOuverte] = useState(false);
  const liste = useRef<FlatList>(null);

  const [clavierOuvert, setClavierOuvert] = useState(false);
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

  const envoyerLe = async (type: 'texte' | 'note_douce' = 'texte') => {
    if (!brouillon.trim() || !coupleId || !partenaireId) return;
    if (await envoyer(coupleId, partenaireId, brouillon, type)) setBrouillon('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fond}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={marges.top}
    >
      <EnTeteApp titre={autre.prenom} surtitre="Nous deux" />

      <FlatList
        ref={liste}
        data={lignes}
        keyExtractor={(l) => l.cle}
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
            />
          )
        }
        onContentSizeChange={() => liste.current?.scrollToEnd({ animated: true })}
      />

      {/* La barre d'onglets est en position absolue : sans sa hauteur ajoutée
          ici, le champ de saisie disparaissait derrière elle. */}
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
        <TextInput
          style={styles.saisie}
          placeholder="Écrire à deux…"
          placeholderTextColor={colors.texteDoux}
          value={brouillon}
          onChangeText={setBrouillon}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          onPress={() => void envoyerLe()}
          disabled={!brouillon.trim() || !cles?.echangePret}
          style={({ pressed }) => [
            styles.envoi,
            (!brouillon.trim() || !cles?.echangePret) && styles.envoiInactif,
            pressed && styles.envoiPresse,
          ]}
        >
          <Texte variante="sousTitre" style={styles.envoiTexte}>
            ↑
          </Texte>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
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
