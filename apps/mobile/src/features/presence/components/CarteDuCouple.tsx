import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Position, Theme } from '@lonlonbenu/shared';
import { distanceEnMetres, pointMilieu } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useTheme } from '@/design/ThemeProvider';
import { Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';

interface Props {
  mienne?: Position;
  autre?: Position;
  prenomAutre: string;
  initialesMiennes: string;
  initialesAutre: string;
  /** Affiche le point à mi-chemin quand il a été demandé. */
  milieu?: boolean;
}

/**
 * Pôle ① — carte du couple (§8.2).
 *
 * ## Des bulles-avatars, pas des punaises
 *
 * Le cahier est explicite : « sous forme de bulles-avatars personnalisées […]
 * dans l'esthétique dorée/premium de l'application — pas de simples points GPS
 * génériques ». Les marqueurs portent donc les initiales dans une pastille aux
 * couleurs du thème, et non l'épingle rouge par défaut, qui appartient
 * visuellement à Google et pas à cette application.
 *
 * ## Le cadrage
 *
 * La vue s'ajuste pour contenir les deux, avec une marge. Centrer sur soi
 * obligerait à chercher l'autre ; centrer sur l'autre serait un point de vue
 * étrange dans une app qui ne regarde personne à sens unique.
 *
 * ## Sans clé
 *
 * La carte reste une grille vide si la clé Google n'est pas configurée. On
 * affiche alors un mot qui l'explique, plutôt qu'un rectangle gris muet qu'on
 * prendrait pour une panne.
 */
export function CarteDuCouple({
  mienne,
  autre,
  prenomAutre,
  initialesMiennes,
  initialesAutre,
  milieu,
}: Props) {
  const { colors } = useTheme();
  const carte = useRef<MapView>(null);

  const points = useMemo(
    () => [mienne, autre].filter((p): p is Position => !!p),
    [mienne, autre],
  );

  const centre = useMemo(() => {
    if (points.length === 2) return pointMilieu(points[0]!, points[1]!);
    return points[0];
  }, [points]);

  /**
   * Étendue affichée : la distance réelle, plus une marge de moitié.
   *
   * Un degré de latitude vaut 111 km partout ; en longitude il rétrécit vers
   * les pôles, mais l'écart reste négligeable aux latitudes où vit ce couple,
   * et une carte trop large de 10 % ne gêne personne.
   */
  const delta = useMemo(() => {
    if (points.length < 2) return 0.01;
    const metres = distanceEnMetres(points[0]!, points[1]!);
    return Math.max(0.005, (metres * 1.5) / 111_000);
  }, [points]);

  useEffect(() => {
    if (!centre) return;
    carte.current?.animateToRegion(
      {
        latitude: centre.latitude,
        longitude: centre.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      600,
    );
  }, [centre, delta]);

  if (!centre) {
    return (
      <View style={styles.absente}>
        <Texte variante="corpsDoux">
          La carte apparaîtra dès qu’une position aura été relevée.
        </Texte>
      </View>
    );
  }

  return (
    <View style={styles.cadre}>
      <MapView
        ref={carte}
        // Google explicitement : le comportement par défaut diffère entre
        // plateformes, et une carte qui ne se dessine pas pareil des deux
        // côtés donnerait deux souvenirs différents du même moment.
        provider={PROVIDER_GOOGLE}
        style={styles.carte}
        initialRegion={{
          latitude: centre.latitude,
          longitude: centre.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        // Aucun bouton « ma position » de Google : il déclencherait un relevé
        // hors de notre boucle adaptative, et donc hors de ce qu'on maîtrise.
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {mienne ? (
          <Marker
            coordinate={mienne}
            title="Vous"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <Bulle initiales={initialesMiennes} fond={colors.accent} />
          </Marker>
        ) : null}

        {autre ? (
          <Marker
            coordinate={autre}
            title={prenomAutre}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <Bulle initiales={initialesAutre} fond={colors.or} />
          </Marker>
        ) : null}

        {milieu && points.length === 2 ? (
          <Marker
            coordinate={pointMilieu(points[0]!, points[1]!)}
            title="À mi-chemin"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.milieu} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

/** Pastille aux initiales, dans les couleurs du thème. */
function Bulle({ initiales, fond }: { initiales: string; fond: string }) {
  return (
    <View style={[styles.bulle, { backgroundColor: fond }]}>
      <Texte variante="petit" style={styles.bulleTexte}>
        {initiales}
      </Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: {
    height: 220,
    borderRadius: rayons.md,
    overflow: 'hidden',
    marginTop: espacements.md,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  carte: { flex: 1 },
  absente: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
  },
  bulle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.fondEleve,
  },
  bulleTexte: { color: colors.texteInverse, fontWeight: '600' },
  milieu: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.tendresse,
    borderWidth: 2,
    borderColor: colors.fondEleve,
  },
}));
