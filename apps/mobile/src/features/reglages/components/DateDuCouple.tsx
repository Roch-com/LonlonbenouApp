import { useState } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { Bouton, Carte, ChampDate, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSessionServeur } from '../stores/sessionServeurStore';

/**
 * Correction de la date d'origine du couple.
 *
 * Le serveur la fixe au jour de l'appairage, faute de mieux — mais un couple ne
 * commence pas le jour où il installe une application. C'est pourtant le
 * premier chiffre que les deux voient en ouvrant l'app, et le voir faux enlève
 * sa valeur à tout le reste.
 *
 * Chacun peut la corriger, sans l'accord de l'autre : c'est une donnée commune,
 * pas une donnée personnelle, et demander une validation à deux pour réparer
 * une faute de saisie serait de la cérémonie.
 */
export function DateDuCouple() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const depuis = useSessionServeur((e) => e.depuis);
  const corrigerLaDate = useSessionServeur((e) => e.corrigerLaDate);

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState(depuis ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  if (!coupleId) return null;

  const valide = /^\d{4}-\d{2}-\d{2}$/.test(saisie);

  const enregistrer = async () => {
    setEnCours(true);
    setErreur(undefined);
    const ok = await corrigerLaDate(saisie);
    setEnCours(false);
    if (ok) setOuvert(false);
    else setErreur(useSessionServeur.getState().erreur);
  };

  return (
    <Carte>
      <Texte variante="surtitre">Depuis quand</Texte>

      {ouvert ? (
        <>
          <Texte variante="petit" style={styles.aide}>
            Au format année-mois-jour, par exemple 2024-09-14.
          </Texte>
          <View style={styles.champ}>
            <ChampDate
              etiquette="Date d’origine"
              valeur={saisie}
              onChanger={setSaisie}
              placeholder="Choisir la date"
              // Un couple n'a pas commencé demain.
              maximum={new Date()}
              {...(erreur ? { erreur } : {})}
            />
          </View>
          <View style={styles.actions}>
            <Bouton
              libelle="Enregistrer"
              enCours={enCours}
              disabled={!valide}
              onPress={() => void enregistrer()}
            />
            <Bouton
              libelle="Annuler"
              ton="discret"
              onPress={() => {
                setOuvert(false);
                setSaisie(depuis ?? '');
                setErreur(undefined);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Texte variante="corps" style={styles.aide}>
            {depuis
              ? `Ensemble depuis le ${dateLongue(depuis)}.`
              : 'Aucune date enregistrée pour l’instant.'}
          </Texte>
          <Texte variante="meta" style={styles.mention}>
            Le compteur part de cette date. Elle vaut pour vous deux, et chacun peut
            la corriger.
          </Texte>
          <View style={styles.actions}>
            <Bouton
              libelle="Corriger la date"
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
