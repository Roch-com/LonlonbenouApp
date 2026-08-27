import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GRATITUDES_SUGGEREES } from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';
import {
  useSessionServeur,
  useServeurFaitAutorite,
} from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { AtelierLettre } from './AtelierLettre';
import { CarteConfidence } from './CarteConfidence';
import { useConfidences } from '../stores/confidencesStore';

/**
 * Pôle ② — Espace de confidences, adossé au serveur.
 *
 * Pas d'interrupteur de consentement, à dessein : une confidence n'est pas une
 * observation. Rien ne se lit qui n'ait été donné.
 *
 * Les brouillons restent locaux et **continuent de fonctionner hors ligne** —
 * c'est le seul module où l'absence de réseau n'empêche pas d'écrire. Elle
 * empêche seulement d'envoyer, ce qui est autre chose.
 */
export function SectionConfidences() {
  const router = useRouter();
  const autre = useAutre();

  const etat = useSessionServeur((e) => e.etat);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const connecte = useServeurFaitAutorite();

  const confidences = useConfidences((e) => e.confidences);
  const brouillons = useConfidences((e) => e.brouillons);
  const horsLigne = useConfidences((e) => e.horsLigne);
  const erreur = useConfidences((e) => e.erreur);
  const synchroniseeLe = useConfidences((e) => e.synchroniseeLe);
  const charger = useConfidences((e) => e.charger);
  const offrirGratitude = useConfidences((e) => e.offrirGratitude);
  const commencerLettre = useConfidences((e) => e.commencerLettre);
  const modifierLettre = useConfidences((e) => e.modifierLettre);
  const envoyerLettre = useConfidences((e) => e.envoyerLettre);
  const supprimerBrouillon = useConfidences((e) => e.supprimerBrouillon);
  const marquerLue = useConfidences((e) => e.marquerLue);

  const [merci, setMerci] = useState('');

  useEffect(() => {
    if (connecte && coupleId && partenaireId) {
      void charger(coupleId, partenaireId);
    }
  }, [connecte, coupleId, partenaireId, charger]);

  const gratitudes = confidences.filter((c) => c.type === 'gratitude');
  const lettresEchangees = confidences.filter((c) => c.type === 'lettre');

  const envoyerMerci = async (texte: string) => {
    if (!coupleId || !partenaireId) return;
    if (await offrirGratitude(coupleId, partenaireId, texte)) setMerci('');
  };

  if (etat === 'anonyme') {
    return (
      <Carte>
        <Texte variante="titre">Ce qui s’offre a besoin d’arriver</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Une gratitude, une lettre : ce sont des textes destinés à {autre.prenom}.
          Il leur faut un compte pour lui parvenir.
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
          Votre compte n’est encore relié à personne. Vos brouillons vous attendent
          en attendant.
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

  return (
    <View style={styles.section}>
      {horsLigne ? (
        <Carte discrete>
          <Texte variante="petit">
            Sans connexion. Vous voyez ce qui avait été reçu
            {synchroniseeLe ? ` ${ilYA(synchroniseeLe)}` : ''}. Vous pouvez
            continuer d’écrire : vos brouillons restent sur cet appareil, et
            partiront quand vous le déciderez.
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

      <Carte>
        <Texte variante="surtitre">Gratitude</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Un merci part tout de suite. Pas de brouillon, pas de mise en scène.
        </Texte>

        <View style={styles.puces}>
          {GRATITUDES_SUGGEREES.map((suggestion) => (
            <Puce
              key={suggestion}
              libelle={suggestion}
              onPress={horsLigne ? undefined : () => void envoyerMerci(suggestion)}
            />
          ))}
        </View>

        <View style={styles.champs}>
          <Champ
            placeholder={`Dire merci à ${autre.prenom}…`}
            value={merci}
            onChangeText={setMerci}
            multiline
          />
          <Bouton
            libelle="Envoyer"
            onPress={() => void envoyerMerci(merci)}
            disabled={!merci.trim() || horsLigne}
          />
        </View>
      </Carte>

      {gratitudes.length > 0 ? (
        <View style={styles.liste}>
          {gratitudes.map((c) => (
            <CarteConfidence
              key={c.id}
              confidence={c}
              moiId={partenaireId!}
              prenomAutre={autre.prenom}
              onLue={() => void marquerLue(coupleId!, partenaireId!, c.id)}
            />
          ))}
        </View>
      ) : null}

      <Texte variante="surtitre" style={styles.sousTitre}>
        Lettres
      </Texte>

      <AtelierLettre
        brouillons={brouillons}
        prenomAutre={autre.prenom}
        envoiPossible={!horsLigne}
        onCreer={(titre, texte) => commencerLettre(titre, texte)}
        onModifier={modifierLettre}
        onEnvoyer={(id) => void envoyerLettre(coupleId!, partenaireId!, id)}
        onSupprimer={supprimerBrouillon}
      />

      {lettresEchangees.length === 0 ? (
        <Carte discrete>
          <Texte variante="corpsDoux">Aucune lettre échangée pour l’instant.</Texte>
        </Carte>
      ) : (
        <View style={styles.liste}>
          {lettresEchangees.map((c) => (
            <CarteConfidence
              key={c.id}
              confidence={c}
              moiId={partenaireId!}
              prenomAutre={autre.prenom}
              onLue={() => void marquerLue(coupleId!, partenaireId!, c.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: espacements.md },
  intro: { marginTop: espacements.xs, marginBottom: espacements.md },
  action: { marginTop: espacements.lg },
  puces: { gap: espacements.xs, alignItems: 'flex-start' },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  liste: { gap: espacements.md },
  sousTitre: { marginTop: espacements.lg },
  erreur: { color: colors.tendresse },
});
