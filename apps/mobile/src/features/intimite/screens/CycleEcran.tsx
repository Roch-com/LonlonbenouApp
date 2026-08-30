import { useCallback } from 'react';
import { AppState, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { VuePartenaireCycle } from '../components/VuePartenaireCycle';
import { VuePorteuse } from '../components/VuePorteuse';
import { useCycle } from '../stores/cycleStore';

/**
 * Pôle ④ — Cycle & fertilité, adossé au serveur.
 *
 * C'est le serveur qui décide de la forme de la réponse selon qui demande.
 * L'écran ne choisit pas ce qu'il montre : il rend ce qu'il a reçu.
 */
/** Assez court pour que le partenaire suive, assez long pour la batterie. */
const INTERVALLE_RELECTURE_MS = 20_000;

export function CycleEcran() {
  const router = useRouter();
  const autre = useAutre();

  const etatSession = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const vue = useCycle((e) => e.vue);
  const chargement = useCycle((e) => e.chargement);
  const horsLigne = useCycle((e) => e.horsLigne);
  const erreur = useCycle((e) => e.erreur);
  const synchroniseeLe = useCycle((e) => e.synchroniseeLe);
  const charger = useCycle((e) => e.charger);
  const declarer = useCycle((e) => e.declarer);

  // Relecture tant que l’écran est ouvert, et pas seulement au montage : la
  // phase avance, le niveau de partage se change depuis l’autre téléphone, et
  // rien ici ne l’apprendrait autrement.
  //
  // Un cycle ne bouge pas à la seconde : un intervalle long suffit, et
  // interroger le serveur plus souvent ne coûterait que de la batterie. La
  // boucle s’arrête dès qu’on quitte l’écran ou que l’app passe derrière.
  useFocusEffect(
    useCallback(() => {
      if (!connecte || !coupleId || !partenaireId) return;

      let vivant = true;
      const relire = () => {
        if (vivant && AppState.currentState === 'active') {
          void charger(coupleId, partenaireId);
        }
      };

      relire();
      const minuterie = setInterval(relire, INTERVALLE_RELECTURE_MS);
      return () => {
        vivant = false;
        clearInterval(minuterie);
      };
    }, [connecte, coupleId, partenaireId, charger]),
  );

  if (etatSession === 'anonyme') {
    return (
      <EcranModale section="Cycle">
        <EnTete titre="Un module qui vit sur le serveur" />
        <Carte>
          <Texte variante="corpsDoux">
            Le cycle se suit sur son propre appareil, et c’est le serveur qui décide
            de ce que l’autre en voit. Il a donc besoin d’un compte.
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="Se connecter"
              onPress={() => router.push('/connexion')}
            />
            <Bouton libelle="Fermer" ton="discret" onPress={() => router.back()} />
          </View>
        </Carte>
      </EcranModale>
    );
  }

  if (etatSession === 'connecte' && !coupleId) {
    return (
      <EcranModale section="Cycle">
        <EnTete titre={`Il manque ${autre.prenom}`} />
        <Carte>
          <Texte variante="corpsDoux">
            Votre compte n’est encore relié à personne. L’appairage se fait une
            seule fois, avec un code à se transmettre.
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="Relier nos comptes"
              onPress={() => router.push('/appairage')}
            />
            <Bouton libelle="Fermer" ton="discret" onPress={() => router.back()} />
          </View>
        </Carte>
      </EcranModale>
    );
  }

  if (!connecte || (chargement && !vue)) {
    return (
      <EcranModale section="Cycle">
        <Carte discrete>
          <Texte variante="corpsDoux">Lecture du cycle…</Texte>
        </Carte>
      </EcranModale>
    );
  }

  // Trois absences bien distinctes, et une seule autorise à se déclarer.
  const raison =
    vue?.role === 'partenaire' && !vue.vue.partage ? vue.vue.raison : undefined;

  return (
    <EcranModale section="Cycle">
      <EnTete
        titre={
          vue?.role === 'porteuse'
            ? 'Mon cycle'
            : raison === 'non_declare'
              ? 'Cycle'
              : `Le cycle de ${autre.prenom}`
        }
        sousTitre={
          vue?.role === 'porteuse'
            ? 'Ce que vous saisissez, et ce que vous choisissez d’en partager.'
            : raison === 'non_declare'
              ? 'Personne ne suit encore de cycle ici.'
              : 'Ce que vous en voyez dépend entièrement de son choix.'
        }
      />

      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion. Vous voyez l’état
            {synchroniseeLe ? ` d’${ilYA(synchroniseeLe)}` : ' précédent'} ; rien ne
            peut être enregistré tant que le serveur n’est pas joignable.
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

      {raison === 'non_declare' ? (
        <Carte>
          <Texte variante="titre">Qui suit un cycle ?</Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            Ce module n’est utile que si l’un de vous suit son cycle. C’est cette
            personne, et elle seule, qui décidera ensuite de ce qui est partagé.
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="C’est moi"
              onPress={() => void declarer(coupleId!, partenaireId!, partenaireId!)}
            />
            <Texte variante="meta">
              Si c’est {autre.prenom}, c’est à elle de le déclarer depuis son propre
              téléphone — pas à vous de le faire à sa place.
            </Texte>
          </View>
        </Carte>
      ) : null}

      {raison === 'sans_partage' ? (
        <Carte>
          <Texte variante="titre">{autre.prenom} suit son cycle ici</Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            Elle n’a pas choisi d’en partager quelque chose pour l’instant. Ce
            réglage n’appartient qu’à elle, et elle peut le reprendre quand elle
            le souhaite depuis son propre téléphone.
          </Texte>
          <Texte variante="meta" style={styles.intro}>
            Rien ne vous est caché sans que vous le sachiez : vous voyez ici son
            niveau, même quand il ne montre rien.
          </Texte>
        </Carte>
      ) : null}

      {raison === 'sans_donnees' ? (
        <Carte>
          <Texte variante="titre">Rien à afficher pour l’instant</Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            {autre.prenom} partage son cycle, mais aucune date n’a encore été
            saisie — il n’y a donc rien à calculer. Cet écran se remplira tout
            seul.
          </Texte>
        </Carte>
      ) : null}

      {vue?.role === 'porteuse' ? (
        <VuePorteuse
          coupleId={coupleId!}
          moiId={partenaireId!}
          vue={vue}
          lectureSeule={horsLigne}
        />
      ) : null}

      {vue?.role === 'partenaire' && vue.vue.partage ? (
        <VuePartenaireCycle prenomAutre={autre.prenom} vue={vue.vue} />
      ) : null}
    </EcranModale>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  actions: { gap: espacements.sm, marginTop: espacements.lg },
  intro: { marginTop: espacements.xs },
  erreur: { color: colors.tendresse },
}));
