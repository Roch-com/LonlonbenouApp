import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { colors, espacements } from '@/design/theme';
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

  useEffect(() => {
    if (connecte && coupleId && partenaireId) {
      void charger(coupleId, partenaireId);
    }
  }, [connecte, coupleId, partenaireId, charger]);

  if (etatSession === 'anonyme') {
    return (
      <EcranModale section="Cycle">
        <EnTete surtitre="Cycle" titre="Un module qui vit sur le serveur" />
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
        <EnTete surtitre="Cycle" titre={`Il manque ${autre.prenom}`} />
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

  // Personne n'est déclaré : les deux voient la même absence, et l'un comme
  // l'autre peut désigner qui suit son cycle — mais une fois désignée, seule
  // la personne concernée peut revenir dessus.
  const rienDeclare = vue?.role === 'partenaire' && !vue.vue.partage;

  return (
    <EcranModale section="Cycle">
      <EnTete
        surtitre="Cycle"
        titre={
          vue?.role === 'porteuse' ? 'Mon cycle' : `Le cycle de ${autre.prenom}`
        }
        sousTitre={
          vue?.role === 'porteuse'
            ? 'Ce que vous saisissez, et ce que vous choisissez d’en partager.'
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

      {rienDeclare ? (
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

const styles = StyleSheet.create({
  actions: { gap: espacements.sm, marginTop: espacements.lg },
  intro: { marginTop: espacements.xs },
  erreur: { color: colors.tendresse },
});
