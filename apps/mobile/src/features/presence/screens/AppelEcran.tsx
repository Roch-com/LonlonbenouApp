import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { dureeLisible, type Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Avatar, Texte } from '@/components/ui';
import { espacements, margeEcran, rayons } from '@/design/theme';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAppels } from '../stores/appelStore';

/**
 * L'écran d'un appel, entrant comme sortant.
 *
 * ## Il couvre tout
 *
 * Un appel n'est pas un panneau qu'on consulte : c'est ce qu'on fait. Le
 * reste de l'application disparaît derrière, et il n'y a pas de bouton
 * « retour » — on quitte un appel en raccrochant, pas en s'en allant.
 *
 * ## Raccrocher est toujours à portée
 *
 * Le bouton rouge est le plus gros, au même endroit dans tous les états. Sur
 * un appel qu'on veut interrompre — parce qu'on a composé par erreur, parce
 * que ça tourne mal — chercher comment raccrocher est insupportable.
 */
export function AppelEcran() {
  const colors = useCouleurs();
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

  const etatLisible = enCours
    ? dureeLisible(secondes)
    : jappelle
      ? 'Sonnerie…'
      : video
        ? 'Appel vidéo entrant'
        : 'Appel entrant';

  return (
    <View style={styles.fond}>
      {/* La vidéo distante occupe tout le fond ; la nôtre se pose en vignette,
          comme partout — on regarde l'autre, pas soi. */}
      {video && fluxDistant ? (
        <RTCView
          streamURL={fluxDistant.toURL()}
          objectFit="cover"
          style={styles.distant}
        />
      ) : (
        <View style={styles.portrait}>
          <Avatar partenaire={autre} taille={96} />
        </View>
      )}

      {video && fluxLocal && !cameraCoupee ? (
        <Pressable onPress={retournerLaCamera} style={styles.vignette}>
          <RTCView
            streamURL={fluxLocal.toURL()}
            objectFit="cover"
            mirror
            style={styles.vignetteFlux}
          />
        </Pressable>
      ) : null}

      <View style={styles.entete}>
        <Texte variante="titre" style={styles.nom}>
          {autre.prenom}
        </Texte>
        <Texte variante="corpsDoux" style={styles.etat}>
          {etatLisible}
        </Texte>
      </View>

      <View style={styles.commandes}>
        {enCours ? (
          <>
            <Bouton
              icone={microCoupe ? 'mic-off' : 'mic'}
              libelle={microCoupe ? 'Réactiver le micro' : 'Couper le micro'}
              actif={microCoupe}
              onPress={basculerMicro}
            />
            {video ? (
              <Bouton
                icone={cameraCoupee ? 'video-off' : 'video'}
                libelle={
                  cameraCoupee ? 'Réactiver la caméra' : 'Couper la caméra'
                }
                actif={cameraCoupee}
                onPress={basculerCamera}
              />
            ) : null}
          </>
        ) : null}

        {entrant ? (
          <Pressable
            onPress={() => coupleId && void decrocher(coupleId)}
            accessibilityRole="button"
            accessibilityLabel="Décrocher"
            style={({ pressed }) => [
              styles.rond,
              { backgroundColor: colors.accent },
              pressed && styles.pressee,
            ]}
          >
            <Feather name="phone" size={26} color={colors.texteInverse} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            coupleId &&
            void raccrocher(coupleId, entrant ? 'refuse' : jappelle && !enCours ? 'annule' : 'raccroche')
          }
          accessibilityRole="button"
          accessibilityLabel={entrant ? 'Décliner' : 'Raccrocher'}
          style={({ pressed }) => [
            styles.rond,
            styles.raccrocher,
            pressed && styles.pressee,
          ]}
        >
          <Feather name="phone-off" size={26} color={colors.texteInverse} />
        </Pressable>
      </View>
    </View>
  );
}

function Bouton({
  icone,
  libelle,
  actif,
  onPress,
}: {
  icone: keyof typeof Feather.glyphMap;
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  const colors = useCouleurs();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: actif }}
      style={({ pressed }) => [
        styles.rond,
        styles.secondaire,
        actif && styles.secondaireActif,
        pressed && styles.pressee,
      ]}
    >
      <Feather name={icone} size={22} color={colors.texte} />
    </Pressable>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  /**
   * Sombre dans les deux thèmes, et c'est le seul écran dans ce cas.
   *
   * Un appel vidéo se regarde : un fond clair rayonne sur le visage et fatigue
   * les yeux le soir, qui est l'heure où l'on s'appelle. La valeur est fixée
   * plutôt que prise au thème, faute d'un jeton qui reste sombre des deux
   * côtés — `texte` deviendrait clair en mode nuit et le fond disparaîtrait.
   */
  fond: {
    ...({ position: 'absolute' } as const),
    inset: 0,
    backgroundColor: '#1A1614',
  },
  distant: { ...({ position: 'absolute' } as const), inset: 0 },
  portrait: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vignette: {
    position: 'absolute',
    top: 96,
    right: margeEcran,
    width: 108,
    height: 152,
    borderRadius: rayons.md,
    overflow: 'hidden',
  },
  vignetteFlux: { flex: 1 },
  entete: {
    position: 'absolute',
    top: 72,
    left: margeEcran,
    right: margeEcran,
    gap: espacements.xxs,
  },
  nom: { color: colors.texteInverse },
  etat: { color: colors.texteInverse, opacity: 0.8 },
  commandes: {
    position: 'absolute',
    bottom: 56,
    left: margeEcran,
    right: margeEcran,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacements.lg,
  },
  rond: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaire: { backgroundColor: colors.fondEleve },
  secondaireActif: { backgroundColor: colors.accentDoux },
  raccrocher: { backgroundColor: colors.tendresse },
  pressee: { opacity: 0.7 },
}));
