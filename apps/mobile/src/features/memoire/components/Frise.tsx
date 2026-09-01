import { View } from 'react-native';
import type { AnneeJournal, EntreeJournal } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Carte, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';

interface Props {
  annees: readonly AnneeJournal[];
}

/**
 * Pôle ⑤ — la frise du journal (§8.17).
 *
 * ## Ce qu’elle n’affiche pas
 *
 * Qui a fait quoi. Le modèle ne le fournit pas, et c’est délibéré : agrégés
 * dans une frise, ces noms deviendraient un décompte, et un décompte devient
 * une comparaison.
 *
 * ## Et quand elle est vide
 *
 * Elle le dit sans le reprocher. Un journal de synthèse est vide au début —
 * c’est normal, pas un manque.
 */
export function Frise({ annees }: Props) {
  if (annees.length === 0) {
    return (
      <Carte>
        <Texte variante="corpsDoux">
          Votre frise se remplira d’elle-même : un projet mené au bout, un axe
          refermé, une sortie vécue, un souvenir ajouté. Rien à faire de plus
          qu’à vivre.
        </Texte>
      </Carte>
    );
  }

  return (
    <View style={styles.pile}>
      {annees.map((annee) => (
        <View key={annee.annee} style={styles.annee}>
          <Texte variante="surtitre">{annee.annee}</Texte>
          {annee.entrees.map((entree) => (
            <LigneFrise key={entree.id} entree={entree} />
          ))}
        </View>
      ))}
    </View>
  );
}

function LigneFrise({ entree }: { entree: EntreeJournal }) {
  return (
    <Carte>
      <View style={styles.ligne}>
        <Texte variante="titre">{entree.emoji}</Texte>
        <View style={styles.texte}>
          <Texte variante="corps">{entree.titre}</Texte>
          {entree.detail ? (
            <Texte variante="petit">{entree.detail}</Texte>
          ) : null}
          <Texte variante="meta">{jourLisible(entree.jour)}</Texte>
        </View>
      </View>
    </Carte>
  );
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/**
 * « 2026-04-02 » devient « 2 avril ».
 *
 * L’année est déjà portée par le groupe : la répéter sur chaque ligne
 * alourdirait la frise sans rien ajouter. Une date illisible se rend telle
 * quelle plutôt que de faire échouer l’affichage.
 */
function jourLisible(jour: string): string {
  const [, mois, quantieme] = jour.split('-');
  const index = Number(mois) - 1;
  if (!MOIS[index] || !quantieme) return jour;
  return `${Number(quantieme)} ${MOIS[index]}`;
}

const styles = stylesDynamiques(() => ({
  pile: { gap: espacements.lg, marginTop: espacements.md },
  annee: { gap: espacements.sm },
  ligne: { flexDirection: 'row', gap: espacements.md, alignItems: 'flex-start' },
  texte: { flex: 1, gap: espacements.xxs },
}));
