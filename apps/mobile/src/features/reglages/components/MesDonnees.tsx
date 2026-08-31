import { useState } from 'react';
import { Alert, View } from 'react-native';
// API héritée : elle écrit un fichier en une ligne. La nouvelle (File/Paths)
// est plus riche, mais on n’a besoin ici que de poser un JSON dans le cache
// avant de le passer à la feuille de partage du système.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ouvrirMessage, type Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { messageLisible } from '@/lib/api/erreurs';
import { cleDeMessages } from '@/features/presence/services/clesMessages';
import { useChat } from '@/features/presence/stores/chatStore';
import { demanderExport, supprimerLeCompte } from '../api/compte.api';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Pôle ⑥ — portabilité et droit à l'effacement (§8.18 du cahier).
 *
 * ## Pourquoi le déchiffrement se fait ici
 *
 * Le serveur rend les messages **scellés** : il ne détient aucune clé privée,
 * et un export « lisible » produit par lui signifierait que la promesse de
 * chiffrement de bout en bout est fausse. C'est donc l'application, seule
 * détentrice des clés, qui ouvre les enveloppes au moment d'écrire le fichier.
 *
 * Les messages qu'elle n'arrive pas à ouvrir — chiffrés avec des clés
 * disparues lors d'une réinstallation — sortent marqués comme tels plutôt que
 * silencieusement omis : un export qui perd des lignes sans le dire vaut moins
 * qu'un export honnête et incomplet.
 */
export function MesDonnees() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const seDeconnecter = useSessionServeur((e) => e.seDeconnecter);
  const clePubliqueAutre = useChat((e) => e.cles?.autre);

  const [enCours, setEnCours] = useState<'export' | 'suppression'>();
  const [erreur, setErreur] = useState<string>();

  const exporter = async () => {
    setEnCours('export');
    setErreur(undefined);
    try {
      const brut = await demanderExport();

      // Ouverture locale du chat, avec la clé de cet appareil.
      let chat: unknown[] = [];
      if (brut.chat_scelle.length > 0 && clePubliqueAutre) {
        const cle = await cleDeMessages(clePubliqueAutre);
        chat = brut.chat_scelle.map((m) => {
          let texte: string;
          try {
            const clair = ouvrirMessage(cle, m.enveloppe);
            const charge = JSON.parse(clair) as { texte?: string };
            texte = charge.texte ?? clair;
          } catch {
            texte = '[message chiffré avec une clé qui n’existe plus sur cet appareil]';
          }
          return { id: m.id, auteurId: m.auteurId, envoyeLe: m.envoyeLe, texte };
        });
      }

      const { chat_scelle: _, ...reste } = brut;
      const contenu = JSON.stringify({ ...reste, chat }, null, 2);

      const chemin = `${FileSystem.cacheDirectory}lonlonbenu-export.json`;
      await FileSystem.writeAsStringAsync(chemin, contenu);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(chemin, {
          mimeType: 'application/json',
          dialogTitle: 'Vos données LONLONBENU',
        });
      } else {
        Alert.alert('Export prêt', `Fichier écrit dans ${chemin}`);
      }
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(undefined);
    }
  };

  /**
   * Double confirmation, comme l'exige le cahier. Les deux étapes disent des
   * choses différentes : la première annonce l'effacement, la seconde annonce
   * ce qu'il fait au couple. Répéter deux fois la même question ne fait que
   * dresser les gens à toucher « oui » deux fois.
   */
  const demanderSuppression = () => {
    Alert.alert(
      'Supprimer votre compte ?',
      'Votre compte, vos appareils et vos réglages seront effacés. C’est définitif : rien ne permet de revenir en arrière.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              coupleId ? 'Et votre espace commun ?' : 'Dernière confirmation',
              coupleId
                ? 'Vos comptes seront d’abord séparés : la conversation, les axes, le cycle et l’agenda seront détruits pour vous deux. Votre partenaire en sera prévenu.'
                : 'Confirmez l’effacement définitif de votre compte.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer définitivement',
                  style: 'destructive',
                  onPress: () => void supprimer(),
                },
              ],
            ),
        },
      ],
    );
  };

  const supprimer = async () => {
    setEnCours('suppression');
    setErreur(undefined);
    try {
      await supprimerLeCompte();
      // La session n'a plus de compte derrière elle : la fermer évite un écran
      // qui interroge un serveur pour lequel on n'existe plus.
      await seDeconnecter();
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(undefined);
    }
  };

  return (
    <Carte>
      <Texte variante="surtitre">Vos données</Texte>
      <Texte variante="corps" style={styles.mention}>
        Vous pouvez emporter tout ce qui vous appartient, ou tout effacer. Les
        deux vous reviennent de droit, et rien ici ne cherche à vous retenir.
      </Texte>
      <Texte variante="meta" style={styles.mention}>
        L’export contient ce que vous avez le droit de lire. Le cycle n’y figure
        que pour la personne qui le suit, et la conversation est déchiffrée sur
        cet appareil — le serveur ne sait pas l’ouvrir.
      </Texte>

      <View style={styles.actions}>
        <Bouton
          libelle="Exporter mes données"
          ton="secondaire"
          icone="download"
          enCours={enCours === 'export'}
          disabled={!!enCours}
          onPress={() => void exporter()}
        />
        <Bouton
          libelle="Supprimer mon compte"
          ton="discret"
          enCours={enCours === 'suppression'}
          disabled={!!enCours}
          onPress={demanderSuppression}
        />
      </View>

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  mention: { marginTop: espacements.xs },
  actions: { gap: espacements.sm, marginTop: espacements.lg },
  erreur: { color: colors.tendresse, marginTop: espacements.sm },
}));
