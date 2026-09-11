import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { dureeLisible } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { espacements, margeEcran, rayons } from '@/design/theme';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAppels } from '../stores/appelStore';

/**
 * L'écran d'un appel, entrant comme sortant.
 *
 * ## Il ne suit pas le thème, et c'est délibéré
 *
 * Toutes ses couleurs sont fixes. Un appel vidéo se regarde, souvent le soir :
 * un fond clair rayonne sur le visage. Mais surtout, les jetons du thème
 * basculent en mode nuit — `texteInverse` y devient de l'encre — et une
 * première version affichait le prénom en bleu sombre sur fond sombre, donc
 * invisible. Sur une surface qui ne bascule pas, le texte ne doit pas basculer
 * non plus.
 *
 * ## Raccrocher est toujours au même endroit
 *
 * Le bouton rouge ne bouge d'aucun état à l'autre. Sur un appel qu'on veut
 * interrompre — composé par erreur, ou qui tourne mal — chercher comment
 * raccrocher est insupportable.
 */

/** Couleurs propres à l'écran, hors thème. Voir l'en-tête. */
const SURFACE = '#0E1726';
const TEXTE = '#FFFFFF';
const TEXTE_DOUX = 'rgba(255, 255, 255, 0.68)';
const COMMANDE = 'rgba(255, 255, 255, 0.14)';
const COMMANDE_ACTIVE = '#FFFFFF';
const RACCROCHER = '#D93025';
const DECROCHER = '#1E9E52';
const AVATAR = '#1D4E89';

export function AppelEcran() {
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);

  const appel = useAppels((e) => e.appel);
  const jappelle = useAppels((e) => e.jappelle);
  const fluxLocal = useAppels((e) => e.fluxLocal);
  const fluxDistant = useAppels((e) => e.fluxDistant);
  const microCoupe = useAppels((e) => e.microCoupe);
  const cameraCoupee = useAppels((e) => e.cameraCoupee);
  const decrocher = useAppels((e) => e.decrocher);
  const raccrocher = useAppels((e) => e.raccrocher);
  const basculerMicro = useAppels((e) => e.basculerMicro);
  const basculerCamera = useAppels((e) => e.basculerCamera);
  const retournerLaCamera = useAppels((e) => e.retournerLaCamera);
  const hautParleur = useAppels((e) => e.hautParleur);
  const basculerHautParleur = useAppels((e) => e.basculerHautParleur);
  const passerEnVideo = useAppels((e) => e.passerEnVideo);
  const passageEnVideo = useAppels((e) => e.passageEnVideo);
  const erreur = useAppels((e) => e.erreur);

  const [secondes, setSecondes] = useState(0);

  // Le compteur ne part qu'au décrochage : compter la sonnerie ferait croire
  // qu'on a parlé plus longtemps qu'en réalité.
  useEffect(() => {
    if (appel?.etat !== 'en_cours') {
      setSecondes(0);
      return;
    }
    const minuterie = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(minuterie);
  }, [appel?.etat]);

  if (!appel) return null;

  const video = appel.sorte === 'video';
  const enCours = appel.etat === 'en_cours';
  const entrant = !jappelle && appel.etat === 'sonne';
  const videoEtablie = video && enCours && !!fluxDistant;

  const etat = enCours
    ? dureeLisible(secondes)
    : jappelle
      ? 'Sonnerie…'
      : video
        ? 'Appel vidéo entrant'
        : 'Appel entrant';

  return (
    <View style={styles.fond}>
      {videoEtablie ? (
        <RTCView
          streamURL={fluxDistant.toURL()}
          objectFit="cover"
          style={styles.distant}
        />
      ) : null}

      {/* Le portrait reste tant que l'image d'en face n'est pas là : un écran
          noir pendant l'établissement se lit comme un appel qui a échoué. */}
      {!videoEtablie ? (
        <View style={styles.portrait}>
          <View style={styles.pastille}>
            <Texte variante="titre" style={styles.initiales}>
              {autre.initiales}
            </Texte>
          </View>
        </View>
      ) : null}

      <View style={styles.entete}>
        <Texte variante="sousTitre" style={styles.nom}>
          {autre.prenom}
        </Texte>
        <Texte variante="petit" style={styles.etat}>
          {etat}
        </Texte>
      </View>

      {video && enCours && !cameraCoupee ? (
        <Pressable
          onPress={retournerLaCamera}
          accessibilityRole="button"
          accessibilityLabel="Changer de caméra"
          hitSlop={8}
          style={({ pressed }) => [styles.flottant, pressed && styles.presse]}
        >
          <Feather name="refresh-cw" size={20} color={TEXTE} />
        </Pressable>
      ) : null}

      {/* Simple aperçu : le bouton flottant porte le changement de caméra.
          Deux gestes pour la même action laissent croire qu'ils diffèrent. */}
      {video && fluxLocal && !cameraCoupee && enCours ? (
        <View style={styles.vignette} accessibilityElementsHidden>
          <RTCView
            streamURL={fluxLocal.toURL()}
            objectFit="cover"
            mirror
            style={styles.vignetteFlux}
          />
        </View>
      ) : null}

      {erreur ? (
        <View style={styles.erreur}>
          <Texte variante="petit" style={styles.erreurTexte}>
            {erreur}
          </Texte>
        </View>
      ) : null}

      {/* Une barre unique, posée en bas : la main tombe dessus sans chercher.
          Les commandes restent au même endroit d'un état à l'autre, et seule
          leur disponibilité change — un bouton qui se déplace se rate. */}
      <View style={styles.barre}>
        {enCours ? (
          <>
            <Rond
              icone={video && !cameraCoupee ? 'video' : 'video-off'}
              libelle={
                !video
                  ? 'Passer en vidéo'
                  : cameraCoupee
                    ? 'Réactiver la caméra'
                    : 'Couper la caméra'
              }
              actif={video && !cameraCoupee}
              occupe={passageEnVideo}
              onPress={() => {
                if (!video) {
                  if (coupleId) void passerEnVideo(coupleId);
                } else {
                  basculerCamera();
                }
              }}
            />
            <Rond
              icone={hautParleur ? 'volume-2' : 'volume-1'}
              libelle={
                hautParleur ? 'Couper le haut-parleur' : 'Mettre le haut-parleur'
              }
              actif={hautParleur}
              onPress={basculerHautParleur}
            />
            <Rond
              icone={microCoupe ? 'mic-off' : 'mic'}
              libelle={microCoupe ? 'Réactiver le micro' : 'Couper le micro'}
              actif={microCoupe}
              onPress={basculerMicro}
            />
          </>
        ) : null}

        {entrant ? (
          <Rond
            icone="phone"
            libelle="Décrocher"
            teinte={DECROCHER}
            onPress={() => coupleId && void decrocher(coupleId)}
          />
        ) : null}

        <Rond
          icone="phone-off"
          libelle={entrant ? 'Décliner' : 'Raccrocher'}
          teinte={RACCROCHER}
          onPress={() => {
            if (!coupleId) return;
            void raccrocher(
              coupleId,
              entrant ? 'refuse' : jappelle && !enCours ? 'annule' : 'raccroche',
            );
          }}
        />
      </View>

    </View>
  );
}

function Rond({
  icone,
  libelle,
  actif,
  occupe,
  teinte,
  onPress,
}: {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  actif?: boolean;
  /** Une action est en cours : le bouton ne doit pas repartir. */
  occupe?: boolean;
  /** Couleur de fond imposée — décrocher et raccrocher. */
  teinte?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={occupe}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: !!actif, disabled: !!occupe }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.rond,
        teinte ? { backgroundColor: teinte } : null,
        !teinte && actif ? styles.rondActif : null,
        occupe && styles.occupe,
        pressed && styles.presse,
      ]}
    >
      <Feather
        name={icone}
        size={24}
        // Un rond clair demande une icône sombre : l'inverse serait illisible.
        color={!teinte && actif ? SURFACE : TEXTE}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { position: 'absolute', inset: 0, backgroundColor: SURFACE },
  distant: { position: 'absolute', inset: 0 },
  portrait: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pastille: {
    width: 132,
    height: 132,
    borderRadius: rayons.rond,
    backgroundColor: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiales: { color: TEXTE, fontSize: 46 },
  entete: {
    position: 'absolute',
    top: 76,
    left: margeEcran,
    right: margeEcran,
    alignItems: 'center',
    gap: espacements.xxs,
  },
  nom: { color: TEXTE, fontSize: 24 },
  etat: { color: TEXTE_DOUX },
  vignette: {
    position: 'absolute',
    top: 150,
    right: margeEcran,
    width: 104,
    height: 148,
    borderRadius: rayons.md,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  vignetteFlux: { flex: 1 },
  erreur: {
    position: 'absolute',
    bottom: 152,
    left: margeEcran,
    right: margeEcran,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  erreurTexte: { color: TEXTE, textAlign: 'center' },
  barre: {
    position: 'absolute',
    bottom: 44,
    left: margeEcran,
    right: margeEcran,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacements.md,
    paddingVertical: espacements.sm,
    paddingHorizontal: espacements.md,
    borderRadius: rayons.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  rond: {
    width: 62,
    height: 62,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COMMANDE,
  },
  rondActif: { backgroundColor: COMMANDE_ACTIVE },
  occupe: { opacity: 0.5 },
  flottant: {
    position: 'absolute',
    top: 150,
    left: margeEcran,
    width: 44,
    height: 44,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COMMANDE,
  },
  presse: { opacity: 0.7 },
});
