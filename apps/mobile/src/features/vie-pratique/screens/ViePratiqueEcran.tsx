import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, EnTete, Segments, Texte } from '@/components/ui';
import { EcranOnglet } from '@/components/chrome/EcranOnglet';
import { colors, espacements } from '@/design/theme';
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
      <EcranOnglet section="Vie pratique">
        <EnTete surtitre="Vie pratique" titre="S’organiser à deux" />
        <Carte>
          <Texte variante="corpsDoux">
            Un agenda commun, des projets communs : il faut deux comptes reliés pour
            que ce que l’un ajoute parvienne à {autre.prenom}.
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
      </EcranOnglet>
    );
  }

  return (
    <EcranOnglet section="Vie pratique">
      <EnTete
        surtitre="Vie pratique"
        titre="S’organiser à deux"
        sousTitre={SOUS_TITRES[onglet]}
      />

      <Segments
        etiquette="Sections de la vie pratique"
        segments={SEGMENTS}
        actif={onglet}
        onChanger={setOnglet}
      />

      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion. Vous voyez l’état
            {synchroniseeLe ? ` d’${ilYA(synchroniseeLe)}` : ' précédent'} ; rien ne
            peut être ajouté tant que le serveur n’est pas joignable.
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
    </EcranOnglet>
  );
}

const SEGMENTS = [
  { cle: 'agenda', libelle: 'Agenda' },
  { cle: 'projets', libelle: 'Projets' },
  { cle: 'sorties', libelle: 'Sorties' },
] as const satisfies readonly { cle: Onglet; libelle: string }[];

const SOUS_TITRES: Record<Onglet, string> = {
  agenda: 'Un seul calendrier, visible pareil des deux côtés.',
  projets: 'Ce que vous voulez faire arriver, découpé en étapes.',
  sorties: 'Les envies, les dates, et ce qu’il en reste.',
};

const styles = StyleSheet.create({
  action: { marginTop: espacements.lg },
  erreur: { color: colors.tendresse },
});
