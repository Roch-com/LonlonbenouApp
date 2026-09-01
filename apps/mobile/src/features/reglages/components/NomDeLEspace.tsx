import { useState } from 'react';
import { View } from 'react-native';
import {
  LONGUEUR_MAX_NOM_ESPACE,
  NOM_ESPACE_PAR_DEFAUT,
  type Theme,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Nom que le couple donne à son espace (§8.18).
 *
 * ## Pourquoi il n’est pas fabriqué automatiquement
 *
 * « Rochaelle » est un mot-valise que Rochambeau et Gaëlle ont choisi. En
 * fabriquer un à partir des deux prénoms produirait un résultat souvent
 * ridicule, et surtout déciderait à leur place de la façon dont ils se
 * nomment. Tant que rien n’est choisi, l’espace s’appelle simplement
 * « Notre espace ».
 *
 * ## Les deux peuvent le changer
 *
 * L’espace appartient au couple, pas à celui qui l’a nommé en premier.
 */
export function NomDeLEspace() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const nomEspace = useSessionServeur((e) => e.nomEspace);
  const renommer = useSessionServeur((e) => e.renommerLEspace);

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState(nomEspace ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  if (!coupleId) return null;

  const enregistrer = async () => {
    setEnCours(true);
    setErreur(undefined);
    const ok = await renommer(saisie);
    setEnCours(false);
    if (ok) setOuvert(false);
    else setErreur(useSessionServeur.getState().erreur);
  };

  return (
    <Carte>
      <Texte variante="surtitre">Le nom de votre espace</Texte>

      {ouvert ? (
        <>
          <View style={styles.champ}>
            <Champ
              etiquette="Comment vous appelez-vous, à deux ?"
              placeholder="Rochaelle, Chez nous…"
              value={saisie}
              onChangeText={setSaisie}
              maxLength={LONGUEUR_MAX_NOM_ESPACE}
              {...(erreur ? { erreur } : {})}
            />
          </View>
          <Texte variante="meta" style={styles.mention}>
            Laissez vide pour revenir à « {NOM_ESPACE_PAR_DEFAUT} ».
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="Enregistrer"
              enCours={enCours}
              onPress={() => void enregistrer()}
            />
            <Bouton
              libelle="Annuler"
              ton="discret"
              onPress={() => {
                setOuvert(false);
                setSaisie(nomEspace ?? '');
                setErreur(undefined);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Texte variante="corps" style={styles.aide}>
            {nomEspace ?? NOM_ESPACE_PAR_DEFAUT}
          </Texte>
          <Texte variante="meta" style={styles.mention}>
            Ce nom vaut pour vous deux, et chacun peut le changer.
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle={nomEspace ? 'Changer ce nom' : 'Nommer notre espace'}
              ton="secondaire"
              onPress={() => setOuvert(true)}
            />
          </View>
        </>
      )}
    </Carte>
  );
}

const styles = stylesDynamiques((_theme: Theme) => ({
  aide: { marginTop: espacements.sm },
  mention: { marginTop: espacements.xs },
  champ: { marginTop: espacements.md },
  actions: { marginTop: espacements.md, gap: espacements.sm },
}));
