import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import {
  definitionImportance,
  definitionTheme,
  etatAxe,
  LIBELLES_ETAT_AXE,
  type AxeVisible,
  type Partenaire,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { ilYA } from '@/lib/temps';

interface Props {
  axe: AxeVisible;
  autre: Partenaire;
  /** Aucune écriture possible : hors ligne, le serveur ne peut rien recevoir. */
  lectureSeule?: boolean;
  onContribuer: (ressenti: string, besoin: string) => void;
  onCloturer: () => void;
  onRouvrir: () => void;
  /** Reconnaître le progrès de l'autre (§8.5). Absent sur ses propres axes. */
  onReconnaitreProgres: () => void;
  /** Identifiant du lecteur, pour savoir qui a ouvert l'axe. */
  moiId?: string;
}

export function CarteAxe({
  axe,
  autre,
  lectureSeule,
  onContribuer,
  onCloturer,
  onRouvrir,
  onReconnaitreProgres,
  moiId,
}: Props) {
  const theme = definitionTheme(axe.theme);
  const cloture = !!axe.clotureLe;
  const reconnaissances = axe.reconnaissances ?? [];
  const jaiReconnu = reconnaissances.some((r) => r.partenaireId === moiId);
  // §8.5 : « l'autre ne peut que reconnaître un progrès ». On ne se décerne
  // pas le sien — la valeur du geste tient à ce qu'il vient d'en face.
  const peutReconnaitre =
    !!moiId && axe.ouvertPar !== moiId && !jaiReconnu && !cloture;

  // Le serveur ne renvoie que ce que j'ai le droit de voir : ma contribution
  // est celle qu'il a marquée comme mienne, et s'il y en a une seconde, c'est
  // que le miroir est complet. Rien à recouper avec une identité locale.
  const mienne = axe.contributions.find((c) => c.estLaMienne);
  const sienne = axe.contributions.find((c) => !c.estLaMienne);

  const [ouverte, setOuverte] = useState(false);
  const [enEdition, setEnEdition] = useState(false);
  const [ressenti, setRessenti] = useState(mienne?.ressenti ?? '');
  const [besoin, setBesoin] = useState(mienne?.besoin ?? '');

  const commencerEdition = () => {
    setRessenti(mienne?.ressenti ?? '');
    setBesoin(mienne?.besoin ?? '');
    setEnEdition(true);
    setOuverte(true);
  };

  const valider = () => {
    onContribuer(ressenti, besoin);
    setEnEdition(false);
  };

  return (
    <Carte>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouverte }}
        onPress={() => setOuverte((o) => !o)}
        style={styles.entete}
      >
        <Texte variante="titre" style={styles.titre}>
          {theme.emoji} {axe.titre}
        </Texte>
        <Texte variante="meta">
          {theme.libelle} · ouvert {ilYA(axe.ouvertLe)}
          {axe.importance
            ? ` · ${definitionImportance(axe.importance).libelle.toLowerCase()}`
            : ''}
        </Texte>
        <View style={styles.badge}>
          <Texte variante="petit" style={styles.badgeTexte}>
            {LIBELLES_ETAT_AXE[etatAxe(axe)]}
          </Texte>
        </View>
        <View style={styles.badge}>
          <Texte variante="petit" style={styles.badgeTexte}>
            {resume(axe, autre.prenom)}
          </Texte>
        </View>
      </Pressable>

      {ouverte ? (
        <View style={styles.corps}>
          {/* Mon côté — toujours accessible, toujours modifiable. */}
          <View style={styles.cote}>
            <Texte variante="surtitre">Mon côté</Texte>

            {enEdition ? (
              <View style={styles.formulaire}>
                <Champ
                  etiquette="Ce que je vis"
                  placeholder="Sans accuser : ce que je ressens."
                  value={ressenti}
                  onChangeText={setRessenti}
                  multiline
                />
                <Champ
                  etiquette="Ce dont j’aurais besoin"
                  placeholder="Une demande concrète, pas un reproche."
                  value={besoin}
                  onChangeText={setBesoin}
                  multiline
                />
                <Bouton
                  libelle={mienne ? 'Mettre à jour' : 'Déposer ma part'}
                  onPress={valider}
                  disabled={!ressenti.trim() && !besoin.trim()}
                />
                <Bouton
                  libelle="Annuler"
                  ton="discret"
                  onPress={() => setEnEdition(false)}
                />
              </View>
            ) : mienne ? (
              <View style={styles.contenu}>
                <Texte variante="corps">{mienne.ressenti}</Texte>
                {mienne.besoin ? (
                  <Texte variante="corpsDoux" style={styles.besoin}>
                    Besoin : {mienne.besoin}
                  </Texte>
                ) : null}
                <Texte variante="meta">Déposé {ilYA(mienne.majLe)}</Texte>
                {!lectureSeule ? (
                  <Bouton
                    libelle="Modifier ma part"
                    ton="secondaire"
                    onPress={commencerEdition}
                  />
                ) : null}
              </View>
            ) : (
              <View style={styles.contenu}>
                <Texte variante="corpsDoux">
                  Vous n’avez pas encore écrit votre part.
                </Texte>
                {!lectureSeule ? (
                  <Bouton libelle="Écrire ma part" onPress={commencerEdition} />
                ) : null}
              </View>
            )}
          </View>

          {/* Le côté de l'autre — couvert tant que le miroir n'est pas complet. */}
          <View style={styles.cote}>
            <Texte variante="surtitre">Le côté de {autre.prenom}</Texte>

            {sienne ? (
              <View style={styles.contenu}>
                <Texte variante="corps">{sienne.ressenti}</Texte>
                {sienne.besoin ? (
                  <Texte variante="corpsDoux" style={styles.besoin}>
                    Besoin : {sienne.besoin}
                  </Texte>
                ) : null}
                <Texte variante="meta">Déposé {ilYA(sienne.majLe)}</Texte>
              </View>
            ) : (
              <View style={styles.couvert}>
                <Texte variante="corpsDoux">
                  {axe.lautreAContribue
                    ? `${autre.prenom} a déposé sa part. Elle se découvrira en même temps que la vôtre, dès que vous aurez écrit la vôtre.`
                    : `${autre.prenom} n’a pas encore écrit. Vous découvrirez vos deux textes au même moment.`}
                </Texte>
              </View>
            )}
          </View>

          {reconnaissances.length > 0 ? (
            <Texte variante="petit" style={styles.progres}>
              {jaiReconnu
                ? 'Vous avez reconnu un progrès sur cet axe.'
                : `${autre.prenom} a reconnu un progrès sur cet axe.`}
            </Texte>
          ) : null}

          {peutReconnaitre && !lectureSeule ? (
            <Bouton
              libelle="Reconnaître un progrès"
              ton="secondaire"
              onPress={onReconnaitreProgres}
            />
          ) : null}

          {axe.etat === 'complet' && !cloture && !lectureSeule ? (
            <Bouton
              libelle="Nous avons avancé, clôturer cet axe"
              ton="secondaire"
              onPress={onCloturer}
            />
          ) : null}
          {cloture && !lectureSeule ? (
            <Bouton libelle="Rouvrir cet axe" ton="discret" onPress={onRouvrir} />
          ) : null}
        </View>
      ) : null}
    </Carte>
  );
}

function resume(axe: AxeVisible, prenomAutre: string): string {
  if (axe.clotureLe) return 'Clôturé';
  switch (axe.etat) {
    case 'complet':
      return 'Vos deux parts sont visibles';
    case 'en_attente_de_lautre':
      return `En attente de ${prenomAutre}`;
    case 'en_attente_de_moi':
      return `${prenomAutre} a écrit · à vous`;
    default:
      return 'Personne n’a encore écrit';
  }
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  entete: { gap: espacements.xxs },
  titre: { paddingRight: espacements.lg },
  badge: {
    alignSelf: 'flex-start',
    marginTop: espacements.xs,
    paddingVertical: espacements.xxs,
    paddingHorizontal: espacements.sm,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
  },
  progres: { color: colors.accent },
  badgeTexte: { color: colors.accentFonce },
  corps: {
    marginTop: espacements.lg,
    paddingTop: espacements.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
    gap: espacements.lg,
  },
  cote: { gap: espacements.sm },
  formulaire: { gap: espacements.sm },
  contenu: { gap: espacements.sm },
  besoin: { fontStyle: 'italic' },
  couvert: {
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bordure,
  },
}));
