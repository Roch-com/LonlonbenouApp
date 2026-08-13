import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Ecran, EnTete, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { SectionAgenda } from '../components/SectionAgenda';
import { SectionProjets } from '../components/SectionProjets';
import { SectionSorties } from '../components/SectionSorties';
import { useViePratique } from '../stores/viePratiqueStore';

type Onglet = 'agenda' | 'projets' | 'sorties';

/**
 * Pôle ③ — Vie pratique partagée, adossée au serveur.
 *
 * La garde de connexion est ici plutôt que dans chaque section : les trois
 * modules partagent le même chargement et les mêmes conditions d'accès.
 */
export function ViePratiqueEcran() {
  const router = useRouter();
  const autre = useAutre();
  const [onglet, setOnglet] = useState<Onglet>('agenda');

  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const chargement = useViePratique((e) => e.chargement);
  const horsLigne = useViePratique((e) => e.horsLigne);
  const erreur = useViePratique((e) => e.erreur);
  const synchroniseeLe = useViePratique((e) => e.synchroniseeLe);
  const charger = useViePratique((e) => e.charger);

  useEffect(() => {
    if (connecte && coupleId && partenaireId) {
      void charger(coupleId, partenaireId);
    }
  }, [connecte, coupleId, partenaireId, charger]);

  if (etat === 'anonyme' || (etat === 'connecte' && !coupleId)) {
    return (
      <Ecran>
        <EnTete surtitre="Vie pratique" titre="S’organiser à deux" />
        <Carte>
          <Texte variante="corpsDoux">
            Un agenda commun, des projets communs : il faut deux comptes reliés
            pour que ce que l’un ajoute parvienne à {autre.prenom}.
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
      </Ecran>
    );
  }

  return (
    <Ecran>
      <EnTete
        surtitre="Vie pratique"
        titre="S’organiser à deux"
        sousTitre={SOUS_TITRES[onglet]}
      />

      <View style={styles.segments}>
        <Segment
          libelle="Agenda"
          actif={onglet === 'agenda'}
          onPress={() => setOnglet('agenda')}
        />
        <Segment
          libelle="Projets"
          actif={onglet === 'projets'}
          onPress={() => setOnglet('projets')}
        />
        <Segment
          libelle="Sorties"
          actif={onglet === 'sorties'}
          onPress={() => setOnglet('sorties')}
        />
      </View>

      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion. Vous voyez l’état
            {synchroniseeLe ? ` d’${ilYA(synchroniseeLe)}` : ' précédent'} ; rien
            ne peut être ajouté tant que le serveur n’est pas joignable.
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

      {chargement && !horsLigne ? (
        <Carte discrete>
          <Texte variante="corpsDoux">Lecture en cours…</Texte>
        </Carte>
      ) : null}

      {onglet === 'agenda' ? <SectionAgenda /> : null}
      {onglet === 'projets' ? <SectionProjets /> : null}
      {onglet === 'sorties' ? <SectionSorties /> : null}
    </Ecran>
  );
}

const SOUS_TITRES: Record<Onglet, string> = {
  agenda: 'Un seul calendrier, visible pareil des deux côtés.',
  projets: 'Ce que vous voulez faire arriver, découpé en étapes.',
  sorties: 'Les envies, les dates, et ce qu’il en reste.',
};

function Segment({
  libelle,
  actif,
  onPress,
}: {
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={[styles.segment, actif && styles.segmentActif]}
    >
      <Texte
        variante="petit"
        style={actif ? styles.segmentTexteActif : styles.segmentTexte}
      >
        {libelle}
      </Texte>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: espacements.lg },
  erreur: { color: colors.tendresse },
  segments: {
    flexDirection: 'row',
    gap: espacements.xxs,
    padding: espacements.xxs,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    marginBottom: espacements.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: espacements.sm,
    borderRadius: rayons.rond,
    alignItems: 'center',
  },
  segmentActif: { backgroundColor: colors.fondEleve },
  segmentTexte: { color: colors.texteDoux },
  segmentTexteActif: { color: colors.accentFonce },
});
