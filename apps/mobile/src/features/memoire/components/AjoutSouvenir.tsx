import { useState } from 'react';
import { View } from 'react-native';
import type { ContenuSouvenir, Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, ChampDate, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePosition } from '@/features/presence/stores/positionStore';
import { useSouvenirs } from '../stores/souvenirsStore';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

interface Props {
  /** Sur l'onglet carte, on enregistre un lieu plutôt qu'un moment. */
  pourUnLieu: boolean;
}

/**
 * Ajout d'un souvenir ou d'un lieu (§8.15, §8.16).
 *
 * ## « Ici » plutôt qu'une saisie de coordonnées
 *
 * Pour un lieu, on reprend la position courante — personne ne tape une
 * latitude. Si elle n'est pas disponible, on enregistre quand même : un lieu
 * sans coordonnées reste un souvenir daté et nommé, il n'apparaît simplement
 * pas sur la carte. Refuser l'enregistrement ferait perdre le souvenir pour
 * une raison purement technique.
 *
 * ## La date passe par le sélecteur
 *
 * Un souvenir se saisit souvent des jours après coup. Le sélecteur évite la
 * corvée du format et interdit les dates futures : on n'enregistre pas un
 * souvenir de quelque chose qui n'a pas eu lieu.
 */
export function AjoutSouvenir({ pourUnLieu }: Props) {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const position = usePosition((e) => e.mienne);
  const ajouter = useSouvenirs((e) => e.ajouter);

  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [note, setNote] = useState('');
  const [jour, setJour] = useState(aujourdhui());
  const [enCours, setEnCours] = useState(false);

  if (!coupleId || !partenaireId) return null;

  const valider = async () => {
    if (!titre.trim()) return;
    setEnCours(true);
    try {
      const contenu: ContenuSouvenir = {
        titre: titre.trim(),
        note: note.trim() || undefined,
        ...(pourUnLieu && position
          ? { latitude: position.latitude, longitude: position.longitude }
          : {}),
      };

      const ok = await ajouter(
        coupleId,
        partenaireId,
        pourUnLieu ? 'lieu' : 'moment',
        jour,
        contenu,
      );
      if (ok) {
        setTitre('');
        setNote('');
        setJour(aujourdhui());
        setOuvert(false);
      }
    } finally {
      setEnCours(false);
    }
  };

  if (!ouvert) {
    return (
      <Bouton
        libelle={pourUnLieu ? 'Enregistrer un lieu' : 'Ajouter un souvenir'}
        icone={pourUnLieu ? 'map-pin' : 'plus'}
        onPress={() => setOuvert(true)}
      />
    );
  }

  return (
    <Carte>
      <Texte variante="surtitre">
        {pourUnLieu ? 'Un lieu à vous deux' : 'Un moment à garder'}
      </Texte>

      <View style={styles.champs}>
        <Champ
          etiquette={pourUnLieu ? 'Quel endroit ?' : 'Quoi ?'}
          value={titre}
          onChangeText={setTitre}
          placeholder={pourUnLieu ? 'La plage de Lomé…' : 'Notre premier voyage…'}
        />

        <ChampDate
          etiquette="Quand ?"
          valeur={jour}
          onChanger={setJour}
          // On n'enregistre pas le souvenir de ce qui n'a pas eu lieu.
          maximum={new Date()}
        />

        <Champ
          etiquette="Un mot (facultatif)"
          value={note}
          onChangeText={setNote}
          multiline
        />

        {pourUnLieu ? (
          <Texte variante="meta">
            {position
              ? 'La position actuelle sera enregistrée avec ce lieu.'
              : 'Sans position disponible, ce lieu sera gardé comme un souvenir daté — il n’apparaîtra pas sur la carte.'}
          </Texte>
        ) : null}

        <Bouton
          libelle="Garder ce souvenir"
          enCours={enCours}
          disabled={!titre.trim()}
          onPress={() => void valider()}
        />
        <Bouton libelle="Annuler" ton="discret" onPress={() => setOuvert(false)} />
      </View>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  champs: { gap: espacements.sm, marginTop: espacements.md },
  fond: { backgroundColor: colors.fond },
}));
