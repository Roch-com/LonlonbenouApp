import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  direction,
  distanceEnMetres,
  distanceLisible,
  dureeApprochee,
  pointMilieu,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { useAutre, useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePresence } from '../stores/presenceStore';
import { usePosition } from '../stores/positionStore';
import { useLieux } from '../stores/lieuxStore';
import { CarteDuCouple } from './CarteDuCouple';

/**
 * Pôle ① — « tu es où, tu arrives quand » (§8.2).
 *
 * ## Pourquoi pas de carte ici
 *
 * Une carte demande un fournisseur de tuiles, donc une clé Google Maps et un
 * compte de facturation. Elle viendra. Mais l'essentiel de la friction que ce
 * module veut supprimer tient en une phrase — « à 2,5 km, environ 10 min » —
 * et cette phrase n'a besoin d'aucune carte. Livrer la réponse avant le décor
 * évite de faire attendre une fonctionnalité utile derrière un réglage
 * administratif.
 *
 * ## Le point de rencontre
 *
 * Proposé, jamais imposé, et sans itinéraire : envoyer les deux positions à un
 * service de routage tiers viderait le chiffrement de bout en bout de son
 * sens. On donne le milieu et une estimation, à charge pour vous de choisir.
 */
export function CarteProximite() {
  const colors = useCouleurs();
  const autre = useAutre();
  const moi = useMoi();
  const coupleId = useSessionServeur((e) => e.coupleId);

  const vue = usePresence((e) => e.vue);
  const permission = usePosition((e) => e.permission);
  const mienne = usePosition((e) => e.mienne);
  const positionAutre = usePosition((e) => e.autre);
  const erreur = usePosition((e) => e.erreur);
  const relirePermission = usePosition((e) => e.relirePermission);
  const demander = usePosition((e) => e.demander);
  const publier = usePosition((e) => e.publierUnRelevé);
  const ouvrirCelleDeLAutre = usePosition((e) => e.ouvrirCelleDeLAutre);
  const lieuPour = useLieux((e) => e.lieuPour);
  const dernierLieuId = useLieux((e) => e.dernierLieuId);
  const noterLieu = useLieux((e) => e.noterLieu);
  const definirStatut = usePresence((e) => e.definirStatut);
  const partenaireId = useSessionServeur((e) => e.partenaireId);

  const [milieuVisible, setMilieuVisible] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void relirePermission();
  }, [relirePermission]);

  // L'enveloppe reçue du serveur s'ouvre ici : le store de présence ne détient
  // que du scellé, et le clair ne vit que le temps du rendu.
  useEffect(() => {
    void ouvrirCelleDeLAutre(vue?.positionAutre?.positionScellee);
  }, [vue?.positionAutre?.positionScellee, ouvrirCelleDeLAutre]);

  /**
   * Boucle de relevé, à espacement variable.
   *
   * `setTimeout` réarmé plutôt qu'un `setInterval` : c'est le relevé précédent
   * qui décide du délai suivant, court en déplacement et long à l'arrêt. Un
   * intervalle fixe ne saurait pas faire la différence.
   */
  useFocusEffect(
    useCallback(() => {
      if (!coupleId || permission !== 'accordee') return;

      let vivant = true;
      const boucle = async () => {
        if (!vivant || AppState.currentState !== 'active') return;
        const attente = await publier(coupleId);
        if (!vivant) return;

        /**
         * Statut automatique à l'arrivée dans un lieu (§8.2).
         *
         * Seulement quand le lieu **change**, et seulement s'il porte un
         * statut : reposer le même à chaque relève écraserait sans arrêt un
         * statut choisi à la main, ce qui reviendrait à décider à la place
         * de la personne. Le lieu propose, il ne gouverne pas.
         */
        const position = usePosition.getState().mienne;
        const lieu = position ? lieuPour(position) : undefined;
        if (lieu?.id !== dernierLieuId) {
          noterLieu(lieu?.id);
          if (lieu?.statut && partenaireId) {
            void definirStatut(coupleId, partenaireId, lieu.statut);
          }
        }

        minuterie.current = setTimeout(() => void boucle(), attente || 120_000);
      };

      void boucle();
      return () => {
        vivant = false;
        if (minuterie.current) clearTimeout(minuterie.current);
      };
    }, [
      coupleId,
      permission,
      publier,
      lieuPour,
      dernierLieuId,
      noterLieu,
      definirStatut,
      partenaireId,
    ]),
  );

  if (permission !== 'accordee') {
    return (
      <Carte>
        <Texte variante="surtitre">Où êtes-vous</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          {permission === 'refusee'
            ? 'La localisation est refusée pour cette application. Vous pouvez la réactiver dans les réglages du téléphone — rien ne presse.'
            : permission === 'indisponible'
              ? 'La localisation est désactivée sur ce téléphone.'
              : `Partager votre position permet de savoir à quelle distance vous êtes l’un de l’autre, sans avoir à demander. ${autre.prenom} verra la vôtre exactement comme vous verrez la sienne — jamais autrement.`}
        </Texte>
        <Texte variante="meta" style={styles.intro}>
          Rien n’est relevé quand cet écran est fermé, et vos coordonnées
          partent chiffrées : le serveur ne sait pas où vous êtes.
        </Texte>
        {permission === 'jamais_demandee' ? (
          <View style={styles.actions}>
            <Bouton
              libelle="Autoriser la localisation"
              icone="map-pin"
              onPress={() => void demander()}
            />
          </View>
        ) : null}
      </Carte>
    );
  }

  const monLieu = mienne ? lieuPour(mienne) : undefined;
  const metres =
    mienne && positionAutre ? distanceEnMetres(mienne, positionAutre) : undefined;

  return (
    <Carte>
      <View style={styles.entete}>
        <Texte variante="surtitre" style={styles.titreFlex}>
          Où êtes-vous
        </Texte>
        {monLieu ? (
          <View style={styles.badge}>
            <Feather name="home" size={12} color={colors.accentFonce} />
            <Texte variante="meta" style={styles.badgeTexte}>
              {monLieu.nom}
            </Texte>
          </View>
        ) : null}
      </View>

      {!vue?.partageActif ? (
        <Texte variante="corpsDoux" style={styles.intro}>
          Votre position part bien, mais elle n’est visible qu’une fois le
          partage actif de vos deux côtés — et la sienne le sera dans les mêmes
          conditions. Vous pouvez le régler dans « Notre espace ».
        </Texte>
      ) : !positionAutre ? (
        <Texte variante="corpsDoux" style={styles.intro}>
          {autre.prenom} n’a pas encore relevé sa position depuis son téléphone.
        </Texte>
      ) : metres === undefined ? (
        <Texte variante="corpsDoux" style={styles.intro}>
          Relevé en cours…
        </Texte>
      ) : (
        <>
          <Texte variante="affiche" style={styles.distance}>
            {distanceLisible(metres)}
          </Texte>
          <Texte variante="corpsDoux">
            {autre.prenom} est vers le {direction(mienne!, positionAutre)}
            {metres > 300
              ? ` · environ ${dureeApprochee(metres, metres < 2000 ? 'pied' : 'voiture')} min`
              : ''}
          </Texte>
          <Texte variante="meta" style={styles.intro}>
            Relevé {ilYA(positionAutre.releveeLe)}. Distance à vol d’oiseau : le
            trajet réel sera un peu plus long.
          </Texte>

          {metres > 1000 ? (
            <View style={styles.actions}>
              <Bouton
                libelle={
                  milieuVisible ? 'Masquer le point de rencontre' : 'Point à mi-chemin'
                }
                ton="secondaire"
                icone="map-pin"
                onPress={() => setMilieuVisible((v) => !v)}
              />
            </View>
          ) : null}

          <CarteDuCouple
            mienne={mienne}
            autre={positionAutre}
            prenomAutre={autre.prenom}
            initialesMiennes={moi.initiales}
            initialesAutre={autre.initiales}
            milieu={milieuVisible}
          />

          {milieuVisible && mienne ? (
            <View style={styles.milieu}>
              <Texte variante="petit">
                À mi-chemin :{' '}
                {formaterCoordonnees(pointMilieu(mienne, positionAutre))}
              </Texte>
              <Texte variante="meta">
                Environ {dureeApprochee(metres / 2)} min pour chacun. À vous de
                trouver ce qu’il y a autour.
              </Texte>
            </View>
          ) : null}
        </>
      )}

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </Carte>
  );
}

/** Coordonnées lisibles, à cinq décimales — environ un mètre, largement assez. */
function formaterCoordonnees(position: {
  latitude: number;
  longitude: number;
}): string {
  return `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`;
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espacements.sm },
  titreFlex: { flex: 1, minWidth: 0 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.xxs,
    paddingVertical: 4,
    paddingHorizontal: espacements.sm,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
  },
  badgeTexte: { color: colors.accentFonce },
  intro: { marginTop: espacements.xs },
  distance: { marginTop: espacements.md },
  actions: { marginTop: espacements.lg },
  milieu: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    gap: espacements.xxs,
  },
  erreur: { color: colors.tendresse, marginTop: espacements.sm },
}));
