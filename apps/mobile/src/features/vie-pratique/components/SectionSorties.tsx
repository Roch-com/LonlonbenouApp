import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import {
  CATEGORIES_SORTIE,
  definitionCategorieSortie,
  idees,
  IDEES_SUGGEREES,
  journal,
  prevues,
  quand,
  resumeJournal,
  type CategorieSortie,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useViePratique } from '../stores/viePratiqueStore';

/** Pôle ③ — Initiatives & sorties (P0 : création + journal). */
export function SectionSorties() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const couple = useSession((e) => e.couple);
  const initiatives = useViePratique((e) => e.initiatives);
  const proposer = useViePratique((e) => e.proposerInitiative);
  const programmerInitiative = useViePratique((e) => e.programmerInitiative);
  const vivre = useViePratique((e) => e.vivreInitiative);
  const supprimer = useViePratique((e) => e.supprimerInitiative);

  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<CategorieSortie>('restaurant');
  const [dates, setDates] = useState<Record<string, string>>({});
  const [souvenirs, setSouvenirs] = useState<Record<string, string>>({});

  const maintenant = new Date().toISOString();
  const resume = resumeJournal(initiatives, maintenant);
  const mesIdees = idees(initiatives);
  const aVenir = prevues(initiatives);
  const vecues = journal(initiatives);

  const ajouter = (titreChoisi: string, categorieChoisie: CategorieSortie) => {
    void proposer(coupleId!, partenaireId!, titreChoisi, categorieChoisie);
    setTitre('');
  };

  return (
    <View style={styles.section}>
      <Carte>
        <Texte variante="surtitre">Une envie</Texte>
        <View style={styles.puces}>
          {CATEGORIES_SORTIE.map((c) => (
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
          <Champ
            placeholder="Ce dont vous avez envie…"
            value={titre}
            onChangeText={setTitre}
          />
          <Bouton
            libelle="Poser l’envie"
            onPress={() => ajouter(titre, categorie)}
            disabled={!titre.trim()}
          />
        </View>

        <Texte variante="meta" style={styles.mention}>
          Ou piochez ici :
        </Texte>
        <View style={styles.puces}>
          {IDEES_SUGGEREES.map((idee) => (
            <Puce
              key={idee.titre}
              libelle={idee.titre}
              onPress={() => ajouter(idee.titre, idee.categorie)}
            />
          ))}
        </View>
      </Carte>

      {aVenir.length > 0 ? (
        <Carte>
          <Texte variante="surtitre">Prévu</Texte>
          <View style={styles.liste}>
            {aVenir.map((initiative) => (
              <View key={initiative.id} style={styles.entree}>
                <Texte variante="corps">
                  {definitionCategorieSortie(initiative.categorie).emoji}{' '}
                  {initiative.titre}
                </Texte>
                <Texte variante="meta">
                  {initiative.prevuePour
                    ? quand(initiative.prevuePour, maintenant)
                    : ''}
                </Texte>
                <Champ
                  placeholder="Un mot pour le journal (facultatif)"
                  value={souvenirs[initiative.id] ?? ''}
                  onChangeText={(v) =>
                    setSouvenirs((s) => ({ ...s, [initiative.id]: v }))
                  }
                />
                <Bouton
                  libelle="On l’a fait"
                  ton="secondaire"
                  onPress={() =>
                    void vivre(
                      coupleId!,
                      partenaireId!,
                      initiative.id,
                      souvenirs[initiative.id],
                    )
                  }
                />
              </View>
            ))}
          </View>
        </Carte>
      ) : null}

      {mesIdees.length > 0 ? (
        <Carte>
          <Texte variante="surtitre">Envies en attente</Texte>
          <View style={styles.liste}>
            {mesIdees.map((initiative) => {
              const auteur = couple.partenaires.find(
                (p) => p.id === initiative.proposeePar,
              );
              return (
                <View key={initiative.id} style={styles.entree}>
                  <Texte variante="corps">
                    {definitionCategorieSortie(initiative.categorie).emoji}{' '}
                    {initiative.titre}
                  </Texte>
                  <Texte variante="meta">
                    proposée par {auteur?.prenom ?? '—'}
                  </Texte>
                  <Champ
                    placeholder="Une date ? AAAA-MM-JJ"
                    value={dates[initiative.id] ?? ''}
                    onChangeText={(v) =>
                      setDates((d) => ({ ...d, [initiative.id]: v }))
                    }
                    keyboardType="numbers-and-punctuation"
                  />
                  <View style={styles.actions}>
                    <Bouton
                      libelle="Programmer"
                      ton="secondaire"
                      onPress={() => {
                        const date = dates[initiative.id] ?? '';
                        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                          void programmerInitiative(
                            coupleId!,
                            partenaireId!,
                            initiative.id,
                            date,
                          );
                        }
                      }}
                      disabled={
                        !/^\d{4}-\d{2}-\d{2}$/.test(dates[initiative.id] ?? '')
                      }
                    />
                    <Bouton
                      libelle="Retirer"
                      ton="discret"
                      onPress={() =>
                        void supprimer(coupleId!, partenaireId!, initiative.id)
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Carte>
      ) : null}

      <Carte>
        <Texte variante="surtitre">Journal</Texte>
        {vecues.length === 0 ? (
          <Texte variante="corpsDoux" style={styles.mention}>
            Rien encore. Le journal se remplit tout seul, à mesure que vous cochez «
            on l’a fait ».
          </Texte>
        ) : (
          <>
            <Texte variante="petit" style={styles.mention}>
              {resume.vecues} sortie{resume.vecues > 1 ? 's' : ''} ·{' '}
              {resume.categoriesExplorees} façon
              {resume.categoriesExplorees > 1 ? 's' : ''} différente
              {resume.categoriesExplorees > 1 ? 's' : ''} de vous retrouver
              {resume.depuisDerniere !== undefined
                ? ` · la dernière ${quand(vecues[0]!.vecueLe!.slice(0, 10), maintenant)}`
                : ''}
            </Texte>
            <View style={styles.liste}>
              {vecues.slice(0, 12).map((initiative) => (
                <View key={initiative.id} style={styles.entree}>
                  <Texte variante="corps">
                    {definitionCategorieSortie(initiative.categorie).emoji}{' '}
                    {initiative.titre}
                  </Texte>
                  <Texte variante="meta">
                    {initiative.vecueLe
                      ? quand(initiative.vecueLe.slice(0, 10), maintenant)
                      : ''}
                  </Texte>
                  {initiative.souvenir ? (
                    <Texte variante="corpsDoux" style={styles.souvenir}>
                      « {initiative.souvenir} »
                    </Texte>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
      </Carte>
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
  mention: { marginTop: espacements.sm },
  liste: { marginTop: espacements.md, gap: espacements.lg },
  entree: {
    gap: espacements.xs,
    paddingBottom: espacements.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bordure,
  },
  actions: { gap: espacements.xs },
  souvenir: { fontStyle: 'italic' },
}));
