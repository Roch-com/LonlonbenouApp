import { useEffect } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useRouter } from 'expo-router';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import { ConsentementServeur } from '@/features/reglages/components/ConsentementServeur';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { CarteAxe } from './CarteAxe';
import { NouvelAxe } from './NouvelAxe';
import { useAxes } from '../stores/axesStore';

/**
 * Pôle ② — Axes de croissance. Première tranche adossée au serveur.
 *
 * Les axes n'existent que sur le serveur : c'est lui qui applique le miroir,
 * et lui seul décide de ce qui redescend. L'écran ne fait que rendre ce qu'il
 * reçoit, et dire honnêtement quand ce qu'il montre date d'avant.
 */
export function SectionAxes() {
  const router = useRouter();
  const autre = useAutre();

  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const axes = useAxes((e) => e.axes);
  const chargement = useAxes((e) => e.chargement);
  const horsLigne = useAxes((e) => e.horsLigne);
  const erreur = useAxes((e) => e.erreur);
  const synchroniseeLe = useAxes((e) => e.synchroniseeLe);
  const charger = useAxes((e) => e.charger);
  const ouvrirAxe = useAxes((e) => e.ouvrirAxe);
  const contribuer = useAxes((e) => e.contribuer);
  const cloturer = useAxes((e) => e.cloturer);

  useEffect(() => {
    if (connecte && coupleId && partenaireId) {
      void charger(coupleId, partenaireId);
    }
  }, [connecte, coupleId, partenaireId, charger]);

  if (etat === 'anonyme') {
    return (
      <Carte>
        <Texte variante="titre">Un espace qui vit sur le serveur</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Les axes de croissance se travaillent à deux, depuis deux appareils. Ils
          ont donc besoin d’un compte — c’est ce qui permet à ce que vous déposez
          d’arriver jusqu’à {autre.prenom}.
        </Texte>
        <View style={styles.action}>
          <Bouton
            libelle="Se connecter"
            onPress={() => router.push('/connexion')}
          />
        </View>
      </Carte>
    );
  }

  if (etat === 'connecte' && !coupleId) {
    return (
      <Carte>
        <Texte variante="titre">Il manque {autre.prenom}</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Votre compte existe, mais il n’est encore relié à personne. L’appairage se
          fait une seule fois, avec un code à se transmettre.
        </Texte>
        <View style={styles.action}>
          <Bouton
            libelle="Relier nos comptes"
            onPress={() => router.push('/appairage')}
          />
        </View>
      </Carte>
    );
  }

  if (!connecte) {
    return (
      <Carte discrete>
        <Texte variante="corpsDoux">Reprise de votre session…</Texte>
      </Carte>
    );
  }

  const enCours = axes.filter((a) => !a.clotureLe);
  const clotures = axes.filter((a) => a.clotureLe);

  return (
    <View style={styles.section}>
      <Carte>
        <ConsentementServeur
          coupleId={coupleId!}
          module="croissance"
          prenomAutre={autre.prenom}
          onChange={() => void charger(coupleId!, partenaireId!)}
        />
      </Carte>

      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion pour l’instant. Vous voyez l’état
            {synchroniseeLe ? ` d’${ilYA(synchroniseeLe)}` : ' précédent'} ; rien ne
            peut être déposé tant que le serveur n’est pas joignable.
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

      {!horsLigne ? (
        <NouvelAxe
          prenomAutre={autre.prenom}
          onOuvrir={(theme, titre) => void ouvrirAxe(coupleId!, theme, titre)}
        />
      ) : null}

      {chargement && axes.length === 0 ? (
        <Carte discrete>
          <Texte variante="corpsDoux">Lecture des axes…</Texte>
        </Carte>
      ) : null}

      {!chargement && axes.length === 0 && !erreur ? (
        <Carte discrete>
          <Texte variante="corpsDoux">
            Aucun axe pour l’instant. Un axe n’est pas un reproche : c’est un sujet
            que vous décidez de regarder à deux.
          </Texte>
        </Carte>
      ) : null}

      {enCours.map((axe) => (
        <CarteAxe
          key={axe.id}
          axe={axe}
          autre={autre}
          lectureSeule={horsLigne}
          onContribuer={(ressenti, besoin) =>
            void contribuer(coupleId!, axe.id, ressenti, besoin)
          }
          onCloturer={() => void cloturer(coupleId!, axe.id, true)}
          onRouvrir={() => void cloturer(coupleId!, axe.id, false)}
        />
      ))}

      {clotures.length > 0 ? (
        <>
          <Texte variante="surtitre" style={styles.sousTitre}>
            Axes clôturés
          </Texte>
          {clotures.map((axe) => (
            <CarteAxe
              key={axe.id}
              axe={axe}
              autre={autre}
              lectureSeule={horsLigne}
              onContribuer={(ressenti, besoin) =>
                void contribuer(coupleId!, axe.id, ressenti, besoin)
              }
              onCloturer={() => void cloturer(coupleId!, axe.id, true)}
              onRouvrir={() => void cloturer(coupleId!, axe.id, false)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  intro: { marginTop: espacements.xs },
  action: { marginTop: espacements.lg },
  sousTitre: { marginTop: espacements.md },
  erreur: { color: colors.tendresse },
}));
