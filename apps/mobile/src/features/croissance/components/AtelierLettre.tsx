import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AMORCES_LETTRE, etatDiffere } from '@lonlonbenu/shared';
import type { Brouillon } from '../stores/confidencesStore';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { ilYA } from '@/lib/temps';

interface Props {
  brouillons: readonly Brouillon[];
  prenomAutre: string;
  /** Faux hors ligne : on peut ecrire, pas encore offrir. */
  envoiPossible: boolean;
  onCreer: (titre: string, texte: string) => void;
  onModifier: (id: string, titre: string, texte: string) => void;
  onEnvoyer: (id: string) => void;
  onSupprimer: (id: string) => void;
  /** Met la lettre de côté pour 24 h, ou lève le délai. */
  onDifferer: (id: string, differer: boolean) => void;
}

/**
 * Écriture des lettres. Un brouillon reste privé aussi longtemps qu'on veut :
 * rien ne part sans un geste explicite, et il n'y a aucun compte à rebours.
 */
export function AtelierLettre({
  brouillons,
  prenomAutre,
  envoiPossible,
  onCreer,
  onModifier,
  onEnvoyer,
  onSupprimer,
  onDifferer,
}: Props) {
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [redaction, setRedaction] = useState(false);
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  const reinitialiser = () => {
    setRedaction(false);
    setEnCoursId(null);
    setTitre('');
    setTexte('');
  };

  const enregistrer = () => {
    if (!texte.trim()) return;
    if (enCoursId) onModifier(enCoursId, titre, texte);
    else onCreer(titre, texte);
    reinitialiser();
  };

  const reprendre = (brouillon: Brouillon) => {
    setEnCoursId(brouillon.id);
    setTitre(brouillon.titre ?? '');
    setTexte(brouillon.texte);
    setRedaction(true);
  };

  return (
    <View style={styles.section}>
      {redaction ? (
        <Carte>
          <Texte variante="surtitre">
            {enCoursId ? 'Reprendre le brouillon' : 'Nouvelle lettre'}
          </Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            Ce texte reste privé tant que vous ne l’envoyez pas. {prenomAutre} ne
            sait pas qu’il existe.
          </Texte>

          {!enCoursId ? (
            <View style={styles.puces}>
              {AMORCES_LETTRE.map((amorce) => (
                <Puce
                  key={amorce}
                  libelle={amorce}
                  active={titre === amorce}
                  onPress={() => setTitre(amorce)}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.champs}>
            <Champ
              etiquette="Titre (facultatif)"
              value={titre}
              onChangeText={setTitre}
            />
            <Champ
              etiquette="Votre lettre"
              placeholder="Prenez le temps qu’il faut."
              value={texte}
              onChangeText={setTexte}
              multiline
              style={styles.zoneTexte}
            />
            <Bouton
              libelle="Garder en brouillon"
              onPress={enregistrer}
              disabled={!texte.trim()}
            />
            <Bouton libelle="Annuler" ton="discret" onPress={reinitialiser} />
          </View>
        </Carte>
      ) : (
        <Bouton
          libelle="Écrire une lettre"
          ton="secondaire"
          onPress={() => setRedaction(true)}
        />
      )}

      {brouillons.map((brouillon) => (
        <Carte key={brouillon.id} discrete>
          <Texte variante="surtitre">Brouillon · visible de vous seul·e</Texte>
          {brouillon.titre ? (
            <Texte variante="sousTitre" style={styles.titreBrouillon}>
              {brouillon.titre}
            </Texte>
          ) : null}
          <Texte variante="corpsDoux" numberOfLines={3}>
            {brouillon.texte}
          </Texte>
          <Texte variante="meta" style={styles.pied}>
            Commencé {ilYA(brouillon.creeLe)}
          </Texte>

          {/* Le délai de réflexion (§8.6). Ce qui s'écrit à chaud se relit
              rarement pareil le lendemain — l'attente est la fonctionnalité,
              pas une friction. */}
          <Texte variante="meta" style={styles.pied}>
            {etatDiffere(brouillon.differeDepuis).lecture}
          </Texte>

          {!brouillon.differeDepuis ? (
            <View style={styles.actions}>
              <Bouton
                libelle="La garder jusqu’à demain"
                ton="discret"
                pleineLargeur={false}
                onPress={() => onDifferer(brouillon.id, true)}
              />
            </View>
          ) : null}

          {aConfirmer === brouillon.id ? (
            <View style={styles.actions}>
              <Texte variante="corps">
                Envoyer cette lettre à {prenomAutre} ? Elle ne pourra plus être
                reprise.
              </Texte>
              <Bouton
                libelle="Oui, l’envoyer"
                onPress={() => {
                  onEnvoyer(brouillon.id);
                  setAConfirmer(null);
                }}
              />
              <Bouton
                libelle="Pas encore"
                ton="discret"
                onPress={() => setAConfirmer(null)}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <Bouton
                libelle="Reprendre"
                ton="secondaire"
                onPress={() => reprendre(brouillon)}
              />
              <Bouton
                libelle={
                  !etatDiffere(brouillon.differeDepuis).pret
                    ? 'Mise de côté jusqu’à demain'
                    : envoiPossible
                      ? `Envoyer à ${prenomAutre}`
                      : 'Envoi impossible hors ligne'
                }
                onPress={() => setAConfirmer(brouillon.id)}
                disabled={
                  !envoiPossible || !etatDiffere(brouillon.differeDepuis).pret
                }
              />
              {brouillon.differeDepuis ? (
                <Bouton
                  libelle="Finalement, la libérer"
                  ton="discret"
                  onPress={() => onDifferer(brouillon.id, false)}
                />
              ) : null}
              <Bouton
                libelle="Supprimer ce brouillon"
                ton="discret"
                onPress={() => onSupprimer(brouillon.id)}
              />
            </View>
          )}
        </Carte>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: espacements.md },
  intro: { marginTop: espacements.xs, marginBottom: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  zoneTexte: { minHeight: 140, textAlignVertical: 'top' },
  titreBrouillon: { marginTop: espacements.xs },
  pied: { marginTop: espacements.xs },
  actions: { gap: espacements.xs, marginTop: espacements.md },
});
