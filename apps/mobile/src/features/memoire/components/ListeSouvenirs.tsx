import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Souvenir, Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useViePratique } from '@/features/vie-pratique/stores/viePratiqueStore';
import { useSouvenirs } from '../stores/souvenirsStore';

interface Props {
  souvenirs: readonly Souvenir[];
}

/**
 * L'album, du plus récent au plus ancien, regroupé par année.
 *
 * L'année comme séparateur plutôt que le mois : un album de couple se remplit
 * de quelques entrées par mois au mieux, et découper par mois donnerait une
 * suite de titres presque vides.
 */
export function ListeSouvenirs({ souvenirs }: Props) {
  const colors = useCouleurs();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const couple = useSession((e) => e.couple);
  const supprimer = useSouvenirs((e) => e.supprimer);
  const projets = useViePratique((e) => e.projets);
  const initiatives = useViePratique((e) => e.initiatives);

  /**
   * Le nom de ce à quoi le souvenir est rattaché (§8.15).
   *
   * Rend `undefined` si la cible n'existe plus : un projet supprimé ne doit pas
   * laisser une étiquette vide sur un souvenir qui, lui, reste valable.
   */
  const nomDeLOrigine = (origine: Souvenir['contenu']['origine']) => {
    if (!origine) return undefined;
    const cible =
      origine.sorte === 'projet'
        ? projets.find((p) => p.id === origine.id)
        : initiatives.find((i) => i.id === origine.id);
    return cible?.titre;
  };

  if (souvenirs.length === 0) {
    return (
      <Carte discrete>
        <Texte variante="corpsDoux">
          Rien encore. Le premier souvenir est souvent celui qu’on croit trop
          petit pour être noté — c’est pourtant celui qu’on relit.
        </Texte>
      </Carte>
    );
  }

  let anneeCourante: string | undefined;

  return (
    <View style={styles.liste}>
      {souvenirs.map((souvenir) => {
        const annee = souvenir.jour.slice(0, 4);
        const nouvelleAnnee = annee !== anneeCourante;
        anneeCourante = annee;
        const auteur = couple.partenaires.find((p) => p.id === souvenir.creePar);

        return (
          <View key={souvenir.id}>
            {nouvelleAnnee ? (
              <Texte variante="surtitre" style={styles.annee}>
                {annee}
              </Texte>
            ) : null}

            <Carte>
              <View style={styles.entete}>
                <Feather
                  name={souvenir.sorte === 'lieu' ? 'map-pin' : 'bookmark'}
                  size={16}
                  color={colors.accent}
                />
                <Texte variante="corps" style={styles.titre}>
                  {souvenir.contenu.titre}
                </Texte>
              </View>

              <Texte variante="meta" style={styles.date}>
                {dateLongue(souvenir.jour)}
                {auteur ? ` · ajouté par ${auteur.prenom}` : ''}
              </Texte>

              {nomDeLOrigine(souvenir.contenu.origine) ? (
                <Texte variante="petit" style={styles.origine}>
                  {souvenir.contenu.origine!.sorte === 'projet'
                    ? 'Projet'
                    : 'Sortie'}{' '}
                  · {nomDeLOrigine(souvenir.contenu.origine)}
                </Texte>
              ) : null}

              {souvenir.contenu.note ? (
                <Texte variante="corpsDoux" style={styles.note}>
                  {souvenir.contenu.note}
                </Texte>
              ) : null}

              {coupleId && partenaireId ? (
                <View style={styles.actions}>
                  <Bouton
                    libelle="Retirer"
                    ton="discret"
                    pleineLargeur={false}
                    onPress={() =>
                      void supprimer(coupleId, partenaireId, souvenir.id)
                    }
                  />
                </View>
              ) : null}
            </Carte>
          </View>
        );
      })}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  liste: { gap: espacements.md },
  annee: { marginTop: espacements.md, marginBottom: espacements.xs },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espacements.sm },
  titre: { flex: 1, minWidth: 0 },
  date: { marginTop: espacements.xxs },
  origine: { marginTop: espacements.xxs },
  note: { marginTop: espacements.sm },
  actions: { marginTop: espacements.md, alignItems: 'flex-start' },
  fond: { backgroundColor: colors.fond },
}));
