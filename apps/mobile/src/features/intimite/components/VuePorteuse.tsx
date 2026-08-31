import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import {
  AVERTISSEMENT_MEDICAL,
  definitionPhase,
  DUREE_CYCLE_MAX,
  DUREE_CYCLE_MIN,
  frisePhases,
  INTENSITES,
  niveauxDisponibles,
  quand,
  SYMPTOMES,
  type Estimations,
  type Intensite,
  type TypeSymptome,
} from '@lonlonbenu/shared';
import { Bouton, Carte, ChampDate, Puce, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useCycle } from '../stores/cycleStore';
import type { VuePorteuse as VuePorteuseServeur } from '../api/cycle.api';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Durées proposées d'un toucher. Elles couvrent l'immense majorité des cycles
 * sans transformer le réglage en liste de vingt entrées ; le domaine complet
 * reste borné par DUREE_CYCLE_MIN et DUREE_CYCLE_MAX côté serveur.
 */
const DUREES_PROPOSEES = [26, 27, 28, 29, 30, 31, 32].filter(
  (j) => j >= DUREE_CYCLE_MIN && j <= DUREE_CYCLE_MAX,
);

interface Props {
  coupleId: string;
  moiId: string;
  vue: VuePorteuseServeur;
  lectureSeule?: boolean;
}

/**
 * Vue de la personne concernée. Les données viennent du serveur — y compris
 * l'état du cycle, calculé là-bas — et chaque écriture y retourne avant
 * d'être affichée.
 */
export function VuePorteuse({ coupleId, moiId, vue, lectureSeule }: Props) {
  const definirNiveau = useCycle((e) => e.definirNiveau);
  const definirDuree = useCycle((e) => e.definirDuree);
  const enregistrerRegles = useCycle((e) => e.enregistrerRegles);
  const supprimerRegles = useCycle((e) => e.supprimerRegles);
  const noterSymptome = useCycle((e) => e.noterSymptome);
  const retirerSymptome = useCycle((e) => e.retirerSymptome);

  const [debut, setDebut] = useState(aujourdhui());
  const [intensite, setIntensite] = useState<Intensite>(2);

  const maintenant = new Date().toISOString();
  const jour = aujourdhui();
  const symptomesDuJour = vue.symptomes.filter((s) => s.date === jour);

  const basculerSymptome = (type: TypeSymptome) => {
    const existant = symptomesDuJour.find((s) => s.type === type);
    if (existant && existant.intensite === intensite) {
      void retirerSymptome(coupleId, moiId, existant.id);
      return;
    }
    void noterSymptome(coupleId, moiId, jour, type, intensite);
  };

  return (
    <View style={styles.section}>
      {vue.etat ? (
        <Carte>
          <Texte variante="surtitre">Aujourd’hui</Texte>
          <Texte variante="affiche" style={styles.phase}>
            {definitionPhase(vue.etat.phase).libelle}
          </Texte>
          <Texte variante="corpsDoux">
            Jour {vue.etat.jourDuCycle} de votre cycle
            {vue.etat.estimations.fiable
              ? ` · cycle estimé à ${vue.etat.estimations.dureeCycle} jours`
              : ''}
          </Texte>

          <Frise
            estimations={vue.etat.estimations}
            jourCourant={vue.etat.jourDuCycle}
          />

          <Texte variante="petit" style={styles.prevision}>
            {vue.etat.estimations.fiable
              ? `Prochaines règles estimées ${quand(vue.etat.prochainesReglesLe, maintenant)}.`
              : `Repère indicatif : ${quand(vue.etat.prochainesReglesLe, maintenant)}. Il s’affinera à mesure que vous saisirez vos cycles (${vue.etat.estimations.cyclesObserves} observé${vue.etat.estimations.cyclesObserves > 1 ? 's' : ''} pour l’instant).`}
          </Texte>

          {vue.etat.cycleInhabituellementLong ? (
            <Texte variante="petit" style={styles.retard}>
              Ce cycle dure plus longtemps que d’habitude. Cela peut arriver pour
              des tas de raisons — l’app n’en tire aucune conclusion.
            </Texte>
          ) : null}
        </Carte>
      ) : (
        <Carte discrete>
          <Texte variante="corpsDoux">
            Saisissez le premier jour de vos dernières règles pour commencer. Rien
            n’est calculé avant que vous l’ayez fait.
          </Texte>
        </Carte>
      )}

      <Carte>
        <Texte variante="surtitre">Noter mes règles</Texte>
        {!lectureSeule ? (
          <View style={styles.champs}>
            <ChampDate
              etiquette="Premier jour de mes règles"
              valeur={debut}
              onChanger={setDebut}
              // Une date de règles à venir n'a pas de sens : on ne prédit pas,
              // on enregistre ce qui a eu lieu.
              maximum={new Date()}
            />
            <Bouton
              libelle="Enregistrer"
              onPress={() => void enregistrerRegles(coupleId, moiId, debut)}
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(debut)}
            />
          </View>
        ) : null}

        {vue.regles.length > 0 ? (
          <View style={styles.historique}>
            {vue.regles.slice(0, 6).map((entree) => (
              <View key={entree.id} style={styles.entree}>
                <Texte variante="corps">
                  {quand(entree.debutLe, maintenant)}
                  {entree.finLe ? ` → ${quand(entree.finLe, maintenant)}` : ''}
                </Texte>
                {!lectureSeule ? (
                  <Bouton
                    libelle="Retirer"
                    ton="discret"
                    pleineLargeur={false}
                    onPress={() => void supprimerRegles(coupleId, moiId, entree.id)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </Carte>

      <Carte>
        <Texte variante="surtitre">La durée de mon cycle</Texte>
        <Texte variante="petit" style={styles.mention}>
          {vue.dureeDeclaree
            ? `Les prévisions sont calculées sur ${vue.dureeDeclaree} jours, parce que vous l’avez indiqué.`
            : 'Calculée sur vos cycles observés. Tant qu’il n’y en a qu’un, l’app suppose 28 jours — dites-lui plutôt le vôtre.'}
        </Texte>

        <View style={styles.puces}>
          {DUREES_PROPOSEES.map((jours) => (
            <Puce
              key={jours}
              libelle={`${jours} j`}
              active={vue.dureeDeclaree === jours}
              onPress={
                lectureSeule
                  ? undefined
                  : () => void definirDuree(coupleId, moiId, jours)
              }
            />
          ))}
          <Puce
            libelle="Calculer"
            active={vue.dureeDeclaree === undefined}
            onPress={
              lectureSeule
                ? undefined
                : () => void definirDuree(coupleId, moiId, undefined)
            }
          />
        </View>

        <Texte variante="meta" style={styles.mention}>
          Vous pouvez en changer quand vous voulez. « Calculer » rend la main à
          la moyenne de vos cycles saisis.
        </Texte>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Ce que je ressens aujourd’hui</Texte>
        <Texte variante="petit" style={styles.mention}>
          Pour vous seule. Les symptômes ne sortent du serveur à aucun niveau de
          partage — ils n’entrent dans aucune réponse destinée à votre partenaire.
        </Texte>

        <View style={styles.puces}>
          {INTENSITES.map((niveau) => (
            <Puce
              key={niveau.valeur}
              libelle={niveau.libelle}
              active={intensite === niveau.valeur}
              onPress={() => setIntensite(niveau.valeur)}
            />
          ))}
        </View>

        <View style={styles.puces}>
          {SYMPTOMES.map((symptome) => {
            const note = symptomesDuJour.find((s) => s.type === symptome.code);
            return (
              <Puce
                key={symptome.code}
                libelle={
                  note
                    ? `${symptome.libelle} · ${INTENSITES.find((i) => i.valeur === note.intensite)?.libelle.toLowerCase()}`
                    : symptome.libelle
                }
                emoji={symptome.emoji}
                active={!!note}
                onPress={
                  lectureSeule ? undefined : () => basculerSymptome(symptome.code)
                }
              />
            );
          })}
        </View>
      </Carte>

      <Carte>
        <Texte variante="surtitre">Ce que voit mon partenaire</Texte>
        <Texte variante="petit" style={styles.mention}>
          Vous seule décidez de ce niveau, et vous pouvez le changer quand vous
          voulez. Le baisser n’envoie aucune notification.
        </Texte>
        <View style={styles.niveaux}>
          {niveauxDisponibles().map((niveau) => (
            <View
              key={niveau.code}
              style={[
                styles.niveau,
                vue.niveau === niveau.code && styles.niveauActif,
              ]}
            >
              <Texte variante="corps">{niveau.libelle}</Texte>
              <Texte variante="petit">{niveau.ceQueLautreVoit}</Texte>
              <Bouton
                libelle={vue.niveau === niveau.code ? 'Niveau actuel' : 'Choisir'}
                ton={vue.niveau === niveau.code ? 'discret' : 'secondaire'}
                onPress={() => void definirNiveau(coupleId, moiId, niveau.code)}
                disabled={vue.niveau === niveau.code || lectureSeule}
              />
            </View>
          ))}
        </View>
      </Carte>

      <Carte discrete>
        <Texte variante="petit">{AVERTISSEMENT_MEDICAL}</Texte>
      </Carte>
    </View>
  );
}

function Frise({
  estimations,
  jourCourant,
}: {
  estimations: Estimations;
  jourCourant: number;
}) {
  const frise = frisePhases(estimations);

  return (
    <View style={styles.frise}>
      <View style={styles.friseBarre}>
        {frise.map((segment) => {
          const largeur =
            ((segment.fin - segment.debut + 1) / estimations.dureeCycle) * 100;
          const courante =
            jourCourant >= segment.debut && jourCourant <= segment.fin;
          return (
            <View
              key={segment.phase}
              style={[
                styles.friseSegment,
                { width: `${largeur}%` },
                courante && styles.friseSegmentCourant,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.friseLegende}>
        {frise.map((segment) => (
          <Texte key={segment.phase} variante="meta">
            {definitionPhase(segment.phase).libelle}
          </Texte>
        ))}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  phase: { marginTop: espacements.xxs },
  prevision: { marginTop: espacements.md },
  retard: { marginTop: espacements.sm, color: colors.tendresse },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  mention: { marginTop: espacements.xs },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.md,
  },
  historique: { marginTop: espacements.lg, gap: espacements.md },
  entree: {
    gap: espacements.xs,
    alignItems: 'flex-start',
    paddingBottom: espacements.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bordure,
  },
  frise: { marginTop: espacements.lg, gap: espacements.xs },
  friseBarre: {
    flexDirection: 'row',
    height: 8,
    borderRadius: rayons.rond,
    overflow: 'hidden',
    backgroundColor: colors.fondNuance,
    gap: 1,
  },
  friseSegment: { height: '100%', backgroundColor: colors.accentDoux },
  friseSegmentCourant: { backgroundColor: colors.accent },
  friseLegende: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.sm },
  niveaux: { marginTop: espacements.md, gap: espacements.md },
  niveau: {
    gap: espacements.xs,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
  },
  niveauActif: { borderWidth: 1, borderColor: colors.accent },
}));
