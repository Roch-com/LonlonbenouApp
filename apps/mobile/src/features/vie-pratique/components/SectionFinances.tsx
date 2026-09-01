import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import {
  CATEGORIES_DEPENSE,
  definitionCategorieDepense,
  definitionDevise,
  depensesDuMois,
  equilibre,
  lectureBudget,
  montantLisible,
  parCategorie,
  type CategorieDepense,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Bouton, Carte, Champ, ChampDate, Puce, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre, useMoi, useSession } from '@/features/reglages/stores/sessionStore';
import {
  useDepensesLisibles,
  useFinances,
  useReglesPartage,
} from '../stores/financesStore';
import { ReglagesFinances } from './ReglagesFinances';
import { SectionFactures } from './SectionFactures';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => aujourdhui().slice(0, 7);

/**
 * Pôle ③ — Finances partagées (§8.11).
 *
 * ## Ce que l'écran met en avant, et dans quel ordre
 *
 * Le solde d'abord, les totaux ensuite. C'est délibéré : ce qui aide un couple,
 * c'est de savoir combien l'un doit rendre à l'autre, pas de comparer qui a
 * dépensé le plus. Mettre les totaux individuels en tête ferait de cet écran un
 * tableau de comparaison, ce que le §8.8 refuse pour le score et qui serait
 * encore plus corrosif appliqué à l'argent.
 *
 * ## Le mot du solde
 *
 * « L'équilibre penche un peu » plutôt que « vous devez ». Il s'agit d'avances
 * faites l'un pour l'autre, pas d'une dette : la formulation doit rappeler que
 * c'est du même argent commun qu'il s'agit.
 */
export function SectionFinances() {
  const colors = useCouleurs();
  const moi = useMoi();
  const autre = useAutre();
  const couple = useSession((e) => e.couple);
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);

  const reglages = useFinances((e) => e.reglages);
  const erreur = useFinances((e) => e.erreur);
  const basculerModule = useFinances((e) => e.basculerModule);
  const ajouterDepense = useFinances((e) => e.ajouter);
  const supprimerDepense = useFinances((e) => e.supprimer);
  const depenses = useDepensesLisibles();
  const regles = useReglesPartage();

  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [categorie, setCategorie] = useState<CategorieDepense>('courses');
  const [jour, setJour] = useState(aujourdhui());
  const [payeParMoi, setPayeParMoi] = useState(true);
  const [budget, setBudget] = useState('');

  const devise = definitionDevise(reglages.devise);
  const mois = moisCourant();

  const duMois = useMemo(() => depensesDuMois(depenses, mois), [depenses, mois]);

  const bilan = useMemo(() => {
    const duo = [couple.partenaires[0].id, couple.partenaires[1].id] as const;
    return equilibre(duMois, duo, regles);
  }, [duMois, couple, regles]);

  const totaux = useMemo(() => parCategorie(duMois), [duMois]);
  const totalDuMois = totaux.reduce((somme, t) => somme + t.total, 0);
  const lecture = lectureBudget(totalDuMois, Number(budget) || undefined);

  if (!coupleId || !partenaireId) return null;

  if (!reglages.actif) {
    return (
      <Carte>
        <Texte variante="surtitre">Nos comptes</Texte>
        <Texte variante="corpsDoux" style={styles.intro}>
          Suivre les dépenses communes, et savoir sans y penser qui a avancé
          quoi. Rien n’est allumé tant que vous ne le décidez pas.
        </Texte>
        <Texte variante="meta" style={styles.intro}>
          Les montants sont chiffrés sur vos téléphones : le serveur ne sait ni
          combien vous dépensez, ni en quoi.
        </Texte>
        <View style={styles.actions}>
          <Bouton
            libelle="Activer nos comptes"
            ton="secondaire"
            onPress={() => void basculerModule(coupleId, partenaireId, true)}
          />
        </View>
      </Carte>
    );
  }

  const valider = () => {
    const valeur = Math.round(Number(montant.replace(',', '.')) * 10 ** devise.decimales);
    if (!libelle.trim() || !Number.isFinite(valeur) || valeur <= 0) return;

    void ajouterDepense(coupleId, partenaireId, jour, {
      libelle: libelle.trim(),
      montant: valeur,
      categorie,
      payePar: payeParMoi ? moi.id : autre.id,
    });
    setLibelle('');
    setMontant('');
    setOuvert(false);
  };

  return (
    <View style={styles.section}>
      {/* Le solde d'abord : c'est ce qui aide, là où un tableau comparatif
          ferait de cet écran un instrument de reproche. */}
      <Carte>
        <Texte variante="surtitre">Où en est l’équilibre</Texte>
        {bilan.regularisation ? (
          <>
            <Texte variante="affiche" style={styles.solde}>
              {montantLisible(bilan.regularisation.montant, devise)}
            </Texte>
            <Texte variante="corpsDoux">
              L’équilibre penche un peu :{' '}
              {bilan.regularisation.de === moi.id
                ? `vous avez moins avancé que ${autre.prenom} ce mois-ci.`
                : `${autre.prenom} a moins avancé que vous ce mois-ci.`}
            </Texte>
            <Texte variante="meta" style={styles.intro}>
              Il s’agit d’avances faites l’un pour l’autre, pas d’une dette.
            </Texte>
          </>
        ) : (
          <Texte variante="corpsDoux" style={styles.intro}>
            {duMois.length === 0
              ? 'Aucune dépense notée ce mois-ci.'
              : 'Le compte est juste : chacun a avancé sa part.'}
          </Texte>
        )}
      </Carte>

      {ouvert ? (
        <Carte>
          <Texte variante="surtitre">Une dépense commune</Texte>
          <View style={styles.champs}>
            <Champ etiquette="Quoi ?" value={libelle} onChangeText={setLibelle} />
            <Champ
              etiquette={`Combien ? (${devise.symbole})`}
              value={montant}
              onChangeText={setMontant}
              keyboardType="decimal-pad"
            />
            <ChampDate
              etiquette="Quand ?"
              valeur={jour}
              onChanger={setJour}
              maximum={new Date()}
            />

            <Texte variante="petit">Catégorie</Texte>
            <View style={styles.puces}>
              {CATEGORIES_DEPENSE.map((c) => (
                <Puce
                  key={c.code}
                  libelle={c.libelle}
                  emoji={c.emoji}
                  active={categorie === c.code}
                  onPress={() => setCategorie(c.code)}
                />
              ))}
            </View>

            <View style={styles.ligne}>
              <Texte variante="corps" style={styles.ligneTexte}>
                {payeParMoi ? 'C’est moi qui ai payé' : `${autre.prenom} a payé`}
              </Texte>
              <Switch
                value={payeParMoi}
                onValueChange={setPayeParMoi}
                trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
                thumbColor={payeParMoi ? colors.accent : undefined}
                accessibilityLabel="Qui a payé"
              />
            </View>

            <Bouton
              libelle="Noter cette dépense"
              onPress={valider}
              disabled={!libelle.trim() || !montant.trim()}
            />
            <Bouton
              libelle="Annuler"
              ton="discret"
              onPress={() => setOuvert(false)}
            />
          </View>
        </Carte>
      ) : (
        <Bouton
          libelle="Noter une dépense"
          icone="plus"
          onPress={() => setOuvert(true)}
        />
      )}

      {erreur ? (
        <Carte discrete>
          <Texte variante="petit" style={styles.erreur}>
            {erreur}
          </Texte>
        </Carte>
      ) : null}

      <Carte>
        <Texte variante="surtitre">Ce mois-ci</Texte>
        <Texte variante="sousTitre" style={styles.intro}>
          {montantLisible(totalDuMois, devise)}
        </Texte>

        <View style={styles.champs}>
          <Champ
            etiquette={`Budget du mois (facultatif, ${devise.symbole})`}
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
          />
        </View>

        {lecture ? (
          <View
            style={[
              styles.budget,
              {
                backgroundColor:
                  lecture.etat === 'depasse'
                    ? colors.tendresseDouce
                    : colors.fondNuance,
              },
            ]}
          >
            <Texte variante="petit">{lecture.lecture}</Texte>
          </View>
        ) : null}

        {totaux.length > 0 ? (
          <View style={styles.totaux}>
            {totaux.map(({ categorie: code, total }) => (
              <View key={code} style={styles.ligne}>
                <Texte variante="corps" style={styles.ligneTexte}>
                  {definitionCategorieDepense(code).emoji}{' '}
                  {definitionCategorieDepense(code).libelle}
                </Texte>
                <Texte variante="corps">{montantLisible(total, devise)}</Texte>
              </View>
            ))}
          </View>
        ) : null}
      </Carte>

      {duMois.length > 0 ? (
        <Carte>
          <Texte variante="surtitre">Le détail</Texte>
          <View style={styles.totaux}>
            {duMois.map((depense) => {
              const paye = couple.partenaires.find((p) => p.id === depense.payePar);
              return (
                <View key={depense.id} style={styles.depense}>
                  <View style={styles.ligne}>
                    <Texte variante="corps" style={styles.ligneTexte}>
                      {depense.libelle}
                    </Texte>
                    <Texte variante="corps">
                      {montantLisible(depense.montant, devise)}
                    </Texte>
                  </View>
                  <Texte variante="meta">
                    {depense.jour}
                    {paye ? ` · avancé par ${paye.prenom}` : ''}
                  </Texte>
                  <Bouton
                    libelle="Retirer"
                    ton="discret"
                    pleineLargeur={false}
                    onPress={() =>
                      void supprimerDepense(coupleId, partenaireId, depense.id)
                    }
                  />
                </View>
              );
            })}
          </View>
        </Carte>
      ) : null}

      <SectionFactures coupleId={coupleId} partenaireId={partenaireId} />

      <ReglagesFinances />
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  intro: { marginTop: espacements.xs },
  solde: { marginTop: espacements.md },
  actions: { marginTop: espacements.lg },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  ligneTexte: { flex: 1, minWidth: 0 },
  totaux: { marginTop: espacements.md, gap: espacements.md },
  depense: {
    gap: espacements.xxs,
    alignItems: 'flex-start',
    paddingBottom: espacements.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  budget: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
  },
  erreur: { color: colors.tendresse },
}));
