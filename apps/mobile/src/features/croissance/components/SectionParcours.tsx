import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AVERTISSEMENT,
  definitionThemeParcours,
  type Theme,
  type VueParcours,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useParcours } from '../stores/parcoursStore';
import { SeanceEnCours } from './SeanceEnCours';

/**
 * Pôle ② — Parcours guidé du couple (§8.7).
 *
 * ## Une seule recommandation, jamais un tableau de bord
 *
 * Le cahier demande une recommandation « douce ». Le serveur n'en renvoie
 * qu'une, et souvent aucune ; l'écran se contente de l'afficher quand elle
 * existe. Rien ici ne signale au couple ce qu'il « devrait » faire.
 *
 * ## L'avertissement est toujours là
 *
 * Il ne se replie pas et ne se ferme pas. Un support de conversation qui se
 * ferait passer pour un accompagnement serait dangereux exactement le jour où
 * il ne faut pas qu'il le soit.
 */
export function SectionParcours() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const liste = useParcours((e) => e.liste);
  const recommandation = useParcours((e) => e.recommandation);
  const ouvert = useParcours((e) => e.ouvert);
  const erreur = useParcours((e) => e.erreur);
  const charger = useParcours((e) => e.charger);
  const ouvrir = useParcours((e) => e.ouvrir);
  const vider = useParcours((e) => e.vider);

  const [choisi, setChoisi] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      if (coupleId) void charger(coupleId);
    }, [coupleId, charger]),
  );

  if (!coupleId) return null;

  const selectionner = (parcoursId: string) => {
    setChoisi(parcoursId);
    void ouvrir(coupleId, parcoursId);
  };

  const revenir = () => {
    setChoisi(undefined);
    vider();
    void charger(coupleId);
  };

  if (choisi && ouvert?.parcours.id === choisi) {
    return <SeanceEnCours vue={ouvert} coupleId={coupleId} onRetour={revenir} />;
  }

  return (
    <View style={styles.pile}>
      {recommandation ? (
        <Carte>
          <Texte variante="surtitre">Une piste</Texte>
          <Texte variante="titre" style={styles.titre}>
            {recommandation.parcours.titre}
          </Texte>
          <Texte variante="meta" style={styles.motif}>
            {recommandation.motif}
          </Texte>
          <Texte variante="corps" style={styles.motif}>
            {recommandation.invitation}
          </Texte>
          <Bouton
            libelle="Voir ce parcours"
            ton="secondaire"
            onPress={() => selectionner(recommandation.parcours.id)}
          />
        </Carte>
      ) : null}

      {liste.map((vue) => (
        <LigneParcours
          key={vue.parcours.id}
          vue={vue}
          onPress={() => selectionner(vue.parcours.id)}
        />
      ))}

      <Texte variante="petit" style={styles.avertissement}>
        {AVERTISSEMENT}
      </Texte>

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </View>
  );
}

function LigneParcours({
  vue,
  onPress,
}: {
  vue: VueParcours;
  onPress: () => void;
}) {
  const theme = definitionThemeParcours(vue.parcours.theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vue.parcours.titre}, ${vue.lecture}`}
    >
      <Carte>
        <View style={styles.enTete}>
          <Texte variante="surtitre">
            {theme.emoji} {theme.libelle}
          </Texte>
          {vue.engage ? (
            <Texte variante="meta">
              {vue.seancesFaites}/{vue.total}
            </Texte>
          ) : null}
        </View>

        <Texte variante="titre" style={styles.titre}>
          {vue.parcours.titre}
        </Texte>
        <Texte variante="corps" style={styles.motif}>
          {vue.parcours.promesse}
        </Texte>

        <Jauge faites={vue.seancesFaites} total={vue.total} />

        <Texte variante="meta" style={styles.motif}>
          {vue.lecture}
        </Texte>
      </Carte>
    </Pressable>
  );
}

/** Une barre, pas un pourcentage : le chiffre exact n’apporte rien ici. */
function Jauge({ faites, total }: { faites: number; total: number }) {
  return (
    <View style={styles.jauge} accessibilityElementsHidden>
      <View style={[styles.jaugeRemplie, { flex: Math.max(faites, 0) }]} />
      <View style={{ flex: Math.max(total - faites, 0) }} />
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  pile: { gap: espacements.md },
  enTete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titre: { marginTop: espacements.xs },
  motif: { marginTop: espacements.xs },
  jauge: {
    flexDirection: 'row',
    height: 4,
    marginTop: espacements.md,
    borderRadius: rayons.sm,
    overflow: 'hidden',
    backgroundColor: colors.fondNuance,
  },
  jaugeRemplie: { backgroundColor: colors.accent },
  avertissement: { marginTop: espacements.sm, color: colors.texteDoux },
  erreur: { color: colors.tendresse },
}));
