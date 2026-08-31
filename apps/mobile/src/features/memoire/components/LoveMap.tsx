import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Souvenir, Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Carte, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { dateLongue } from '@/lib/temps';

interface Props {
  lieux: readonly Souvenir[];
}

/**
 * Pôle ⑤ — Love Map (§8.16).
 *
 * ## Ce qu'elle contient, et pourquoi pas plus
 *
 * Seulement les lieux enregistrés volontairement. Le cahier prévoyait une
 * alimentation automatique depuis l'historique de trajets — mais le pôle ①
 * ne garde aucun historique de position, précisément pour ne pas détenir la
 * chronique des déplacements du couple. Les deux ne pouvaient pas coexister.
 *
 * Le choix retenu est celui du souvenir décidé : on marque un lieu parce qu'il
 * a compté, pas parce qu'on y est passé. Une carte alimentée automatiquement
 * afficherait surtout des trajets domicile-travail, ce qui n'est pas une
 * histoire d'amour.
 *
 * ## Le cadrage
 *
 * La vue s'ouvre sur l'étendue de tous les lieux. Un couple qui a voyagé voit
 * ses continents ; un couple qui n'est jamais sorti de sa ville voit sa ville.
 */
export function LoveMap({ lieux }: Props) {
  const carte = useRef<MapView>(null);

  const region = useMemo(() => {
    if (lieux.length === 0) return undefined;

    const lats = lieux.map((l) => l.contenu.latitude!);
    const lons = lieux.map((l) => l.contenu.longitude!);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);

    return {
      latitude: (latMin + latMax) / 2,
      longitude: (lonMin + lonMax) / 2,
      // Une marge de moitié, et un plancher : sur un lieu unique, un delta nul
      // demanderait à la carte un zoom infini.
      latitudeDelta: Math.max(0.02, (latMax - latMin) * 1.5),
      longitudeDelta: Math.max(0.02, (lonMax - lonMin) * 1.5),
    };
  }, [lieux]);

  if (!region) {
    return (
      <Carte discrete>
        <Texte variante="corpsDoux">
          Aucun lieu marqué pour l’instant. Enregistrez-en un pendant que vous y
          êtes : c’est là qu’on pense à le faire.
        </Texte>
      </Carte>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.cadre}>
        <MapView
          ref={carte}
          provider={PROVIDER_GOOGLE}
          style={styles.carte}
          initialRegion={region}
          toolbarEnabled={false}
        >
          {lieux.map((lieu) => (
            <Marker
              key={lieu.id}
              coordinate={{
                latitude: lieu.contenu.latitude!,
                longitude: lieu.contenu.longitude!,
              }}
              title={lieu.contenu.titre}
              description={dateLongue(lieu.jour)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.marque} />
            </Marker>
          ))}
        </MapView>
      </View>

      <Carte discrete>
        <Texte variante="petit">
          {lieux.length} lieu{lieux.length > 1 ? 'x' : ''} marqué
          {lieux.length > 1 ? 's' : ''}. Ils viennent de ce que vous avez choisi
          d’enregistrer — l’application ne trace pas vos déplacements pour
          remplir cette carte.
        </Texte>
      </Carte>

      <View style={styles.liste}>
        {lieux.map((lieu) => (
          <Carte key={lieu.id}>
            <Texte variante="corps">{lieu.contenu.titre}</Texte>
            <Texte variante="meta">{dateLongue(lieu.jour)}</Texte>
            {lieu.contenu.note ? (
              <Texte variante="corpsDoux" style={styles.note}>
                {lieu.contenu.note}
              </Texte>
            ) : null}
          </Carte>
        ))}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  cadre: {
    height: 260,
    borderRadius: rayons.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  carte: { flex: 1 },
  marque: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.tendresse,
    borderWidth: 3,
    borderColor: colors.fondEleve,
  },
  liste: { gap: espacements.md },
  note: { marginTop: espacements.xs },
}));
