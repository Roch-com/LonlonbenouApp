import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  definitionLangage,
  QUESTIONS_LANGAGES,
  questionnaireComplet,
  type ResultatLangages,
  type Rituel,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, EnTete, Segments, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useConnexion } from '../stores/connexionStore';

type Onglet = 'rituels' | 'langages';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Pôle ④ — Complicité & connexion (§8.14).
 *
 * ## Rien n’est coché, rien ne se manque
 *
 * Les rituels se suggèrent et ne se valident pas. Un rituel « non fait »
 * n’existe pas ici : transformer l’affection en devoir qu’on rate est la
 * première chose qu’une application de couple peut abîmer.
 *
 * ## Le résultat de l’autre ne s’affiche pas d’avance
 *
 * Le serveur ne l’envoie pas tant que les deux questionnaires ne sont pas
 * finis. L’écran n’a donc rien à masquer — il affiche ce qu’il reçoit.
 */
export function CompliciteEcran() {
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const vue = useConnexion((e) => e.vue);
  const erreur = useConnexion((e) => e.erreur);
  const charger = useConnexion((e) => e.charger);

  const [onglet, setOnglet] = useState<Onglet>('rituels');
  const jour = aujourdhui();

  useFocusEffect(
    useCallback(() => {
      if (coupleId) void charger(coupleId, jour);
    }, [coupleId, charger, jour]),
  );

  return (
    <EcranModale section="Complicité">
      <EnTete
        titre="Se retrouver"
        sousTitre={
          onglet === 'rituels'
            ? 'Des idées, jamais des devoirs. Rien ne se coche ici.'
            : `Ce qui vous touche, et ce qui touche ${autre.prenom}.`
        }
      />

      <Segments
        etiquette="Sections de la complicité"
        segments={SEGMENTS}
        actif={onglet}
        onChanger={setOnglet}
      />

      {onglet === 'rituels' ? (
        <View style={styles.pile}>
          {vue?.invitation ? (
            <Carte>
              <Texte variante="surtitre">Une idée</Texte>
              <Texte variante="corps" style={styles.espace}>
                {vue.invitation.lecture}
              </Texte>
              <CarteRituel rituel={vue.invitation.rituel} />
            </Carte>
          ) : null}

          {vue?.rituelDuJour ? (
            <Carte>
              <Texte variante="surtitre">Le rituel du jour</Texte>
              <CarteRituel rituel={vue.rituelDuJour} />
            </Carte>
          ) : null}

          {vue?.rituels.map((rituel) => (
            <Carte key={rituel.id}>
              <CarteRituel rituel={rituel} />
            </Carte>
          ))}
        </View>
      ) : (
        <SectionLangages coupleId={coupleId} jour={jour} />
      )}

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </EcranModale>
  );
}

function CarteRituel({ rituel }: { rituel: Rituel }) {
  const langage = definitionLangage(rituel.langage);

  return (
    <View style={styles.espace}>
      <View style={styles.enTete}>
        <Texte variante="titre">{rituel.titre}</Texte>
        <Texte variante="meta">{rituel.duree}</Texte>
      </View>
      <Texte variante="corps" style={styles.espace}>
        {rituel.comment}
      </Texte>
      <Texte variante="meta" style={styles.espace}>
        {langage.emoji} {langage.libelle}
      </Texte>
    </View>
  );
}

function SectionLangages({
  coupleId,
  jour,
}: {
  coupleId: string | undefined;
  jour: string;
}) {
  const autre = useAutre();
  const vue = useConnexion((e) => e.vue);
  const brouillon = useConnexion((e) => e.brouillon);
  const envoi = useConnexion((e) => e.envoi);
  const choisir = useConnexion((e) => e.choisir);
  const envoyer = useConnexion((e) => e.envoyer);
  const reprendre = useConnexion((e) => e.reprendre);

  const [enSaisie, setEnSaisie] = useState(false);

  if (!coupleId || !vue) return null;

  const langages = vue.langages;
  const complet = questionnaireComplet(brouillon);
  const repondues = Object.keys(brouillon).length;

  if (enSaisie) {
    return (
      <View style={styles.pile}>
        <Carte>
          <Texte variante="surtitre">
            {repondues} sur {QUESTIONS_LANGAGES.length}
          </Texte>
          <Texte variante="corps" style={styles.espace}>
            Ce qui vous touche le plus, entre les deux. Il n’y a pas de bonne
            réponse — seulement la vôtre.
          </Texte>
        </Carte>

        {QUESTIONS_LANGAGES.map((question) => (
          <Carte key={question.id}>
            {(['a', 'b'] as const).map((cote) => (
              <Pressable
                key={cote}
                onPress={() => choisir(question.id, cote)}
                accessibilityRole="radio"
                accessibilityState={{ selected: brouillon[question.id] === cote }}
                accessibilityLabel={question[cote].texte}
              >
                <View
                  style={[
                    styles.proposition,
                    brouillon[question.id] === cote ? styles.choisie : null,
                  ]}
                >
                  <Texte variante="corps">{question[cote].texte}</Texte>
                </View>
              </Pressable>
            ))}
          </Carte>
        ))}

        <Bouton
          libelle={complet ? 'Envoyer mes réponses' : 'Garder ce que j’ai fait'}
          enCours={envoi}
          disabled={repondues === 0}
          onPress={() => {
            void envoyer(coupleId, jour).then((ok) => {
              if (ok) setEnSaisie(false);
            });
          }}
        />
        <Bouton
          libelle="Annuler"
          ton="discret"
          onPress={() => {
            reprendre();
            setEnSaisie(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.pile}>
      <Carte>
        <Texte variante="corps">{langages.lecture}</Texte>
        {langages.etat !== 'les_deux' ? (
          <View style={styles.espace}>
            <Bouton
              libelle={
                langages.etat === 'moi_seul'
                  ? 'Refaire le questionnaire'
                  : 'Faire le questionnaire'
              }
              ton={langages.etat === 'moi_seul' ? 'discret' : 'secondaire'}
              onPress={() => {
                reprendre();
                setEnSaisie(true);
              }}
            />
          </View>
        ) : null}
      </Carte>

      {langages.mien ? (
        <Carte>
          <Texte variante="surtitre">Vous</Texte>
          <Classement resultat={langages.mien} />
        </Carte>
      ) : null}

      {langages.sien ? (
        <Carte>
          <Texte variante="surtitre">{autre.prenom}</Texte>
          <Classement resultat={langages.sien} />
          {langages.pistes.map((piste) => (
            <View key={piste} style={styles.piste}>
              <Texte variante="corps">{piste}</Texte>
            </View>
          ))}
        </Carte>
      ) : null}

      {langages.etat === 'les_deux' ? (
        <Carte>
          <Texte variante="corps">
            Ces résultats se discutent, ils ne se concluent pas. Personne n’est
            « un type » : c’est une préférence, pas une nature.
          </Texte>
          <View style={styles.espace}>
            <Bouton
              libelle="Refaire le questionnaire"
              ton="discret"
              onPress={() => {
                reprendre();
                setEnSaisie(true);
              }}
            />
          </View>
        </Carte>
      ) : null}
    </View>
  );
}

/** L’ordre, avec le détail de ce que chaque langage veut dire. */
function Classement({ resultat }: { resultat: ResultatLangages }) {
  return (
    <View style={styles.espace}>
      {resultat.ordre.map((code, rang) => {
        const langage = definitionLangage(code);
        return (
          <View key={code} style={styles.ligne}>
            <Texte variante="corps">
              {langage.emoji} {langage.libelle}
            </Texte>
            {rang === 0 ? (
              <Texte variante="petit">{langage.description}</Texte>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const SEGMENTS = [
  { cle: 'rituels', libelle: 'Rituels' },
  { cle: 'langages', libelle: 'Ce qui touche' },
] as const satisfies readonly { cle: Onglet; libelle: string }[];

const styles = stylesDynamiques(({ colors }: Theme) => ({
  pile: { gap: espacements.md, marginTop: espacements.md },
  espace: { marginTop: espacements.xs },
  enTete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },
  ligne: { paddingVertical: espacements.xs, gap: espacements.xxs },
  proposition: {
    marginTop: espacements.xs,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
  },
  choisie: { backgroundColor: colors.effleurement },
  piste: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.effleurement,
  },
  erreur: { color: colors.tendresse, marginTop: espacements.md },
}));
