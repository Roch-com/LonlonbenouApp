import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  libelleAnniversaire,
  lieuxVisites,
  souvenirsDuJour,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, EnTete, Segments, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useSouvenirs, useSouvenirsLisibles } from '../stores/souvenirsStore';
import { AjoutSouvenir } from '../components/AjoutSouvenir';
import { ListeSouvenirs } from '../components/ListeSouvenirs';
import { LoveMap } from '../components/LoveMap';

type Onglet = 'album' | 'carte';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Pôle ⑤ — Souvenirs et Love Map (§8.15, §8.16).
 *
 * Deux onglets pour une seule matière : l'album montre tout dans l'ordre du
 * temps, la carte ne retient que ce qui a un lieu. Les séparer en deux
 * modules aurait obligé à choisir, au moment d'écrire un souvenir, s'il
 * appartient à l'histoire ou à la géographie — alors qu'un voyage est
 * évidemment les deux.
 */
export function MemoireEcran() {
  const router = useRouter();
  const autre = useAutre();
  const [onglet, setOnglet] = useState<Onglet>('album');

  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const chargement = useSouvenirs((e) => e.chargement);
  const horsLigne = useSouvenirs((e) => e.horsLigne);
  const erreur = useSouvenirs((e) => e.erreur);
  const synchroniseeLe = useSouvenirs((e) => e.synchroniseeLe);
  const charger = useSouvenirs((e) => e.charger);

  const souvenirs = useSouvenirsLisibles();

  useFocusEffect(
    useCallback(() => {
      if (connecte && coupleId && partenaireId) {
        void charger(coupleId, partenaireId);
      }
    }, [connecte, coupleId, partenaireId, charger]),
  );

  const anniversaires = useMemo(
    () => souvenirsDuJour(souvenirs, aujourdhui()),
    [souvenirs],
  );
  const lieux = useMemo(() => lieuxVisites(souvenirs), [souvenirs]);

  if (etat === 'anonyme' || (etat === 'connecte' && !coupleId)) {
    return (
      <EcranModale section="Mémoire">
        <EnTete titre="Ce qui reste" />
        <Carte>
          <Texte variante="corpsDoux">
            Un album se construit à deux : il faut vos deux comptes reliés pour
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
      </EcranModale>
    );
  }

  return (
    <EcranModale section="Mémoire">
      <EnTete
        titre="Ce qui reste"
        sousTitre="Vos moments et vos lieux, gardés à deux."
      />

      {/* « Il y a un an » en premier, et seulement s'il y a quelque chose :
          une section vide qui rappelle chaque jour qu'il n'y a rien à se
          rappeler serait un mauvais accueil. */}
      {anniversaires.length > 0 ? (
        <Carte>
          <Texte variante="surtitre">Ce jour-là</Texte>
          <View style={styles.anniversaires}>
            {anniversaires.map(({ ans, souvenir }) => (
              <View key={souvenir.id}>
                <Texte variante="corps">{souvenir.contenu.titre}</Texte>
                <Texte variante="meta">{libelleAnniversaire(ans)}</Texte>
              </View>
            ))}
          </View>
        </Carte>
      ) : null}

      <Segments
        etiquette="Album ou carte"
        segments={SEGMENTS}
        actif={onglet}
        onChanger={setOnglet}
      />

      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion. Vous voyez l’album tel qu’il était
            {synchroniseeLe ? ` d’${ilYA(synchroniseeLe)}` : ''} ; rien ne peut
            être ajouté pour l’instant.
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

      {chargement && souvenirs.length === 0 ? (
        <Carte discrete>
          <Texte variante="corpsDoux">Lecture de votre album…</Texte>
        </Carte>
      ) : null}

      <AjoutSouvenir pourUnLieu={onglet === 'carte'} />

      {onglet === 'album' ? (
        <ListeSouvenirs souvenirs={souvenirs} />
      ) : (
        <LoveMap lieux={lieux} />
      )}
    </EcranModale>
  );
}

const SEGMENTS = [
  { cle: 'album', libelle: 'Album' },
  { cle: 'carte', libelle: 'Nos lieux' },
] as const satisfies readonly { cle: Onglet; libelle: string }[];

const styles = stylesDynamiques(({ colors }: Theme) => ({
  action: { marginTop: espacements.lg },
  anniversaires: { marginTop: espacements.md, gap: espacements.md },
  erreur: { color: colors.tendresse },
}));
