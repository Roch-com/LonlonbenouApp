import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { FeuilleModale, LigneMenu, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useConfidencesNonLues } from '@/features/croissance/stores/confidencesStore';

interface Props {
  visible: boolean;
  onFermer: () => void;
}

/**
 * Le menu de l'app.
 *
 * La barre d'onglets ne peut porter que cinq destinations avant que les
 * libellés ne se tronquent ; tout le reste vivait auparavant enfoui à deux ou
 * trois niveaux, sans qu'aucun écran ne signale son existence. Ce menu est la
 * réponse : une liste unique, atteignable de n'importe quel onglet.
 *
 * Ce qu'il ne contient pas est aussi délibéré. La dissociation reste à
 * l'intérieur des réglages : un geste irréversible n'a pas sa place à un
 * toucher de distance, entre deux entrées anodines.
 */
export function MenuPrincipal({ visible, onFermer }: Props) {
  const router = useRouter();
  const moi = useMoi();

  const etatSession = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const confidencesNonLues = useConfidencesNonLues(moi.id);

  const connecte = etatSession === 'connecte';

  /** Fermer d'abord : sinon la feuille se referme par-dessus l'écran ouvert. */
  const aller = (chemin: string) => {
    onFermer();
    setTimeout(() => router.push(chemin as never), 60);
  };

  return (
    <FeuilleModale visible={visible} onFermer={onFermer} titre="Tout LONLONBENU">
      <View style={styles.groupe}>
        <Texte variante="surtitre">Votre espace</Texte>
        <LigneMenu
          icone="heart"
          libelle="Notre espace"
          detail="Compteur, partages et journal des changements"
          onPress={() => aller('/nous')}
        />
        <LigneMenu
          icone="droplet"
          libelle="Cycle & fertilité"
          detail="Suivi et niveau de partage, contrôlés par la partenaire concernée"
          onPress={() => aller('/cycle')}
        />
        <LigneMenu
          icone="feather"
          libelle="Confidences"
          detail="Gratitudes et lettres"
          pastille={confidencesNonLues > 0 ? confidencesNonLues : undefined}
          onPress={() => aller('/croissance')}
        />
      </View>

      <View style={styles.separateur} />

      <View style={styles.groupe}>
        <Texte variante="surtitre">Réglages</Texte>
        <LigneMenu
          icone="bell"
          libelle="Notifications"
          detail="Ne pas déranger, fréquences, appareil"
          onPress={() => aller('/notifications')}
        />
        <LigneMenu
          icone="shield"
          libelle="Sécurité & confidentialité"
          detail="Verrou, code de secours, séparation des comptes"
          onPress={() => aller('/reglages')}
        />
        {!connecte ? (
          <LigneMenu
            icone="log-in"
            libelle="Se connecter"
            detail="Nécessaire pour synchroniser entre vos deux téléphones"
            onPress={() => aller('/connexion')}
          />
        ) : !coupleId ? (
          <LigneMenu
            icone="link"
            libelle="Relier nos comptes"
            detail="Inviter votre partenaire par un code à usage unique"
            onPress={() => aller('/appairage')}
          />
        ) : null}
      </View>

      <View style={styles.separateur} />

      <View style={styles.groupe}>
        <LigneMenu
          icone="alert-circle"
          libelle="Envoyer un SOS"
          detail="Traverse le silence, la pause et tous les réglages"
          grave
          onPress={() => aller('/sos')}
        />
      </View>
    </FeuilleModale>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  groupe: { gap: espacements.xxs, paddingVertical: espacements.xs },
  separateur: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bordure,
    marginVertical: espacements.xs,
  },
}));
