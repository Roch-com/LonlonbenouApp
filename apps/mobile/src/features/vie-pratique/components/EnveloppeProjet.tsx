import { useState } from 'react';
import { View } from 'react-native';
import {
  definitionDevise,
  depensesDuProjet,
  lectureBudget,
  montantLisible,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Champ, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import {
  useBudgetsLisibles,
  useDepensesLisibles,
  useFinances,
} from '../stores/financesStore';

interface Props {
  projetId: string;
}

/**
 * Pôle ③ — l’enveloppe d’un projet (§8.11 : « budget partagé par projet »).
 *
 * ## Rien quand le module est éteint
 *
 * Le cahier veut les finances « entièrement optionnelles ». Un couple qui ne
 * les a pas activées ne doit pas voir apparaître une case budget dans ses
 * projets : ce serait lui rappeler un module dont il n’a pas voulu.
 *
 * ## Le ton, encore
 *
 * `lectureBudget` en cadre `projet` dit « l’enveloppe est dépassée », jamais
 * « vous avez trop dépensé ». Une enveloppe est un repère qu’on s’est donné à
 * deux, pas une limite qu’on aurait fauté à franchir.
 */
export function EnveloppeProjet({ projetId }: Props) {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const reglages = useFinances((e) => e.reglages);
  const definirBudget = useFinances((e) => e.definirBudget);
  const supprimerBudget = useFinances((e) => e.supprimerBudget);
  const budgets = useBudgetsLisibles();
  const depenses = useDepensesLisibles();

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');

  if (!reglages.actif || !coupleId || !partenaireId) return null;

  const devise = definitionDevise(reglages.devise);
  const budget = budgets.get(projetId);
  const engage = depensesDuProjet(depenses, projetId).reduce(
    (total, d) => total + d.montant,
    0,
  );
  const lecture = lectureBudget(engage, budget, 'projet');

  const valider = () => {
    const valeur = Math.round(
      Number(saisie.replace(',', '.')) * 10 ** devise.decimales,
    );
    if (!Number.isFinite(valeur) || valeur <= 0) return;

    void definirBudget(coupleId, partenaireId, projetId, valeur);
    setSaisie('');
    setOuvert(false);
  };

  return (
    <View style={styles.bloc}>
      <Texte variante="meta">Enveloppe</Texte>

      {budget ? (
        <>
          <Texte variante="corps">
            {montantLisible(engage, devise)} sur {montantLisible(budget, devise)}
          </Texte>
          {lecture ? (
            <Texte variante="petit">{lecture.lecture}</Texte>
          ) : null}
        </>
      ) : (
        <Texte variante="corpsDoux">
          {engage > 0
            ? `${montantLisible(engage, devise)} déjà engagés, sans enveloppe fixée.`
            : 'Aucune enveloppe fixée pour ce projet.'}
        </Texte>
      )}

      {ouvert ? (
        <View style={styles.champs}>
          <Champ
            etiquette={`Enveloppe (${devise.symbole})`}
            value={saisie}
            onChangeText={setSaisie}
            keyboardType="numeric"
          />
          <Bouton libelle="Enregistrer" onPress={valider} />
          <Bouton
            libelle="Annuler"
            ton="discret"
            onPress={() => setOuvert(false)}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Bouton
            libelle={budget ? 'Changer l’enveloppe' : 'Fixer une enveloppe'}
            ton="discret"
            onPress={() => {
              setSaisie(budget ? String(budget / 10 ** devise.decimales) : '');
              setOuvert(true);
            }}
          />
          {budget ? (
            <Bouton
              libelle="Retirer"
              ton="discret"
              onPress={() =>
                void supprimerBudget(coupleId, partenaireId, projetId)
              }
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bloc: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    gap: espacements.xxs,
  },
  champs: { gap: espacements.sm, marginTop: espacements.sm },
  actions: { marginTop: espacements.sm, gap: espacements.sm },
}));
