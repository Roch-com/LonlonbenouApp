import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import {
  CATEGORIES_EVENEMENT,
  definitionCategorieEvenement,
  DELAIS_RAPPEL,
  evenementsAVenir,
  evenementsPasses,
  grouperParJour,
  horodatage,
  normaliserHeure,
  quand,
  type CategorieEvenement,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { heure } from '@/lib/temps';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useViePratique } from '../stores/viePratiqueStore';

/** Pôle ③ — Calendrier partagé (P0). */
export function SectionAgenda() {
  const colors = useCouleurs();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const couple = useSession((e) => e.couple);
  const evenements = useViePratique((e) => e.evenements);
  const ajouterEvenement = useViePratique((e) => e.ajouterEvenement);
  const supprimerEvenement = useViePratique((e) => e.supprimerEvenement);

  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<CategorieEvenement>('a_deux');
  const [date, setDate] = useState('');
  const [heureSaisie, setHeureSaisie] = useState('');
  const [journeeEntiere, setJourneeEntiere] = useState(false);
  const [lieu, setLieu] = useState('');
  const [rappelHeures, setRappelHeures] = useState<number | undefined>(24);

  const maintenant = new Date().toISOString();
  const aVenir = grouperParJour(evenementsAVenir(evenements, maintenant));
  const passes = evenementsPasses(evenements, maintenant).slice(0, 5);

  // À vide, l'heure vaut 19:00 ; sinon elle doit être lisible. `padStart`
  // complétait « 9 » en « 00009 » et fabriquait une date que l'affichage ne
  // savait plus relire — l'application se fermait à chaque ouverture ensuite.
  const heureNormalisee = heureSaisie.trim()
    ? normaliserHeure(heureSaisie)
    : '19:00';
  const heureLisible = journeeEntiere || heureNormalisee !== undefined;
  const dateLisible = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const complet = !!titre.trim() && dateLisible && heureLisible;

  const valider = () => {
    if (!complet) return;
    const debut = journeeEntiere ? date : horodatage(date, heureNormalisee);
    // Ceinture et bretelles : rien de douteux ne part vers le serveur.
    if (!debut) return;

    void ajouterEvenement(coupleId!, partenaireId!, {
      titre,
      categorie,
      debut,
      journeeEntiere,
      lieu,
      rappelHeures,
    });

    setTitre('');
    setLieu('');
    setOuvert(false);
  };

  return (
    <View style={styles.section}>
      {ouvert ? (
        <Carte>
          <Texte variante="surtitre">Nouvel événement</Texte>

          <View style={styles.puces}>
            {CATEGORIES_EVENEMENT.map((c) => (
              <Puce
                key={c.code}
                libelle={c.libelle}
                emoji={c.emoji}
                active={categorie === c.code}
                onPress={() => setCategorie(c.code)}
              />
            ))}
          </View>

          <View style={styles.champs}>
            <Champ etiquette="Quoi ?" value={titre} onChangeText={setTitre} />
            <Champ
              etiquette="Date (AAAA-MM-JJ)"
              placeholder="2026-04-12"
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />

            <View style={styles.ligne}>
              <Texte variante="corps" style={styles.ligneTexte}>
                Toute la journée
              </Texte>
              <Switch
                value={journeeEntiere}
                onValueChange={setJourneeEntiere}
                trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
                thumbColor={journeeEntiere ? colors.accent : undefined}
              />
            </View>

            {!journeeEntiere ? (
              <>
                <Champ
                  etiquette="Heure"
                  placeholder="19:00"
                  value={heureSaisie}
                  onChangeText={setHeureSaisie}
                  keyboardType="numbers-and-punctuation"
                />
                {!heureLisible ? (
                  <Texte variante="petit" style={styles.aide}>
                    Cette heure ne se lit pas. « 9 », « 9h30 » ou « 21:00 »
                    conviennent.
                  </Texte>
                ) : null}
              </>
            ) : null}

            <Champ
              etiquette="Où ? (facultatif)"
              value={lieu}
              onChangeText={setLieu}
            />

            <Texte variante="petit">Rappel</Texte>
            <View style={styles.puces}>
              {DELAIS_RAPPEL.map((delai) => (
                <Puce
                  key={delai.heures}
                  libelle={delai.libelle}
                  active={rappelHeures === delai.heures}
                  onPress={() => setRappelHeures(delai.heures)}
                />
              ))}
              <Puce
                libelle="Aucun"
                active={rappelHeures === undefined}
                onPress={() => setRappelHeures(undefined)}
              />
            </View>

            <Bouton
              libelle="Ajouter à notre agenda"
              onPress={valider}
              disabled={!complet}
            />
            <Bouton
              libelle="Annuler"
              ton="discret"
              onPress={() => setOuvert(false)}
            />
          </View>
        </Carte>
      ) : (
        <Bouton libelle="Ajouter un événement" onPress={() => setOuvert(true)} />
      )}

      {aVenir.length === 0 ? (
        <Carte discrete>
          <Texte variante="corpsDoux">
            Rien de prévu pour l’instant. Ce que l’un ajoute, l’autre le voit —
            c’est le principe d’un agenda commun.
          </Texte>
        </Carte>
      ) : (
        aVenir.map((journee) => (
          <Carte key={journee.jour}>
            <Texte variante="surtitre">{quand(journee.jour, maintenant)}</Texte>
            <View style={styles.journee}>
              {journee.evenements.map((evenement) => {
                const auteur = couple.partenaires.find(
                  (p) => p.id === evenement.creePar,
                );
                return (
                  <View key={evenement.id} style={styles.evenement}>
                    <Texte variante="corps">
                      {definitionCategorieEvenement(evenement.categorie).emoji}{' '}
                      {evenement.titre}
                    </Texte>
                    <Texte variante="meta">
                      {evenement.journeeEntiere
                        ? 'toute la journée'
                        : heure(evenement.debut)}
                      {evenement.lieu ? ` · ${evenement.lieu}` : ''}
                      {auteur ? ` · ajouté par ${auteur.prenom}` : ''}
                      {evenement.rappelHeures !== undefined ? ' · rappel' : ''}
                    </Texte>
                    <Bouton
                      libelle="Retirer"
                      ton="discret"
                      pleineLargeur={false}
                      onPress={() =>
                        void supprimerEvenement(
                          coupleId!,
                          partenaireId!,
                          evenement.id,
                        )
                      }
                    />
                  </View>
                );
              })}
            </View>
          </Carte>
        ))
      )}

      {passes.length > 0 ? (
        <Carte discrete>
          <Texte variante="surtitre">Derniers passés</Texte>
          <View style={styles.journee}>
            {passes.map((evenement) => (
              <Texte key={evenement.id} variante="petit">
                {definitionCategorieEvenement(evenement.categorie).emoji}{' '}
                {evenement.titre} ·{' '}
                {quand(evenement.debut.slice(0, 10), maintenant)}
              </Texte>
            ))}
          </View>
        </Carte>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.sm,
  },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  aide: { color: colors.tendresse },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  ligneTexte: { flex: 1 },
  journee: { marginTop: espacements.md, gap: espacements.md },
  evenement: {
    gap: espacements.xxs,
    alignItems: 'flex-start',
    paddingBottom: espacements.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bordure,
  },
}));
