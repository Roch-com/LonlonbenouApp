import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Texte } from './Texte';
import { espacements, rayons } from '@/design/theme';

export type ModeChampDate = 'date' | 'heure';

interface Props {
  etiquette?: string;
  mode?: ModeChampDate;
  /** `AAAA-MM-JJ` en mode date, `HH:MM` en mode heure. Vide = non renseigné. */
  valeur: string;
  onChanger: (valeur: string) => void;
  /** Texte affiché quand rien n'est choisi. */
  placeholder?: string;
  minimum?: Date;
  maximum?: Date;
  desactive?: boolean;
  erreur?: string;
}

/**
 * Choix d'une date ou d'une heure par le sélecteur du système.
 *
 * Remplace une saisie libre au format imposé — « AAAA-MM-JJ », « HH:MM ».
 * Demander à quelqu'un de composer un format machine est une source d'erreur
 * qu'aucune validation ne rattrape vraiment : elle refuse la frappe sans dire
 * ce qu'on aurait dû taper. Un « 9 » complété en « 00009 » a d'ailleurs suffi
 * à fermer tout un module de l'application.
 *
 * Le sélecteur natif résout les deux à la fois : le format ne peut plus être
 * faux, et les conventions locales — ordre des champs, 24 h, premier jour de
 * la semaine — sont celles auxquelles la personne est déjà habituée.
 *
 * Le champ **affiche** en français lisible (« 30 août 2026 ») et **rend** la
 * valeur machine attendue par le serveur : l'écran ne voit jamais de `Date`,
 * et personne n'a à convertir quoi que ce soit.
 */
export function ChampDate({
  etiquette,
  mode = 'date',
  valeur,
  onChanger,
  placeholder,
  minimum,
  maximum,
  desactive,
  erreur,
}: Props) {
  const colors = useCouleurs();
  const [ouvert, setOuvert] = useState(false);

  const courant = versDate(valeur, mode);

  return (
    <View style={styles.bloc}>
      {etiquette ? (
        <Texte variante="petit" style={styles.etiquette}>
          {etiquette}
        </Texte>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiquette ?? (mode === 'date' ? 'Date' : 'Heure')}
        accessibilityValue={{ text: valeur ? lisible(valeur, mode) : 'non défini' }}
        disabled={desactive}
        onPress={() => setOuvert(true)}
        style={({ pressed }) => [
          styles.champ,
          !!erreur && styles.enErreur,
          desactive && styles.desactive,
          pressed && styles.presse,
        ]}
      >
        <Texte
          variante="corps"
          style={valeur ? undefined : styles.absent}
          numberOfLines={1}
        >
          {valeur
            ? lisible(valeur, mode)
            : (placeholder ?? (mode === 'date' ? 'Choisir une date' : 'Choisir une heure'))}
        </Texte>
        <Feather
          name={mode === 'date' ? 'calendar' : 'clock'}
          size={18}
          color={colors.texteDoux}
        />
      </Pressable>

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}

      {ouvert ? (
        <DateTimePicker
          value={courant}
          mode={mode === 'date' ? 'date' : 'time'}
          // Roue sous iOS, boîte de dialogue sous Android : chaque plateforme
          // a sa convention, et l'imposer d'un côté ou de l'autre donne
          // exactement l'impression d'une app portée à la hâte.
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          minimumDate={minimum}
          maximumDate={maximum}
          onChange={(evenement, choisie) => {
            // Android ferme de lui-même ; iOS garde la roue ouverte tant qu'on
            // ne la retire pas.
            if (Platform.OS !== 'ios') setOuvert(false);
            if (evenement.type === 'dismissed' || !choisie) return;
            onChanger(depuisDate(choisie, mode));
          }}
        />
      ) : null}

      {ouvert && Platform.OS === 'ios' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOuvert(false)}
          style={styles.terminer}
        >
          <Texte variante="petit" style={styles.terminerTexte}>
            Terminé
          </Texte>
        </Pressable>
      ) : null}
    </View>
  );
}

/** `AAAA-MM-JJ` ou `HH:MM` → `Date`. Aujourd'hui à défaut, jamais une date folle. */
function versDate(valeur: string, mode: ModeChampDate): Date {
  const maintenant = new Date();
  if (!valeur) return maintenant;

  if (mode === 'heure') {
    const [h, m] = valeur.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return maintenant;
    const d = new Date(maintenant);
    d.setHours(h!, m!, 0, 0);
    return d;
  }

  const [a, mo, j] = valeur.split('-').map(Number);
  if (!a || !mo || !j) return maintenant;
  // Midi local : construire à minuit fait basculer d'un jour selon le fuseau.
  return new Date(a, mo - 1, j, 12, 0, 0, 0);
}

/** `Date` → la forme machine attendue par le serveur. */
function depuisDate(date: Date, mode: ModeChampDate): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  if (mode === 'heure') return `${deux(date.getHours())}:${deux(date.getMinutes())}`;
  // Composants locaux, pas `toISOString` : celui-ci passe en UTC et rend la
  // veille pour toute soirée à l'est de Greenwich.
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** Ce que la personne lit : jamais le format machine. */
function lisible(valeur: string, mode: ModeChampDate): string {
  if (mode === 'heure') return valeur;
  const date = versDate(valeur, 'date');
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bloc: { gap: espacements.xxs },
  etiquette: { marginLeft: espacements.xxs },
  champ: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
    backgroundColor: colors.fondEleve,
    borderRadius: rayons.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.sm,
    minHeight: 50,
  },
  presse: { borderColor: colors.accent, backgroundColor: colors.effleurement },
  desactive: { opacity: 0.5 },
  enErreur: { borderColor: colors.tendresse },
  absent: { color: colors.texteVoile },
  erreur: { color: colors.tendresse, marginLeft: espacements.xxs },
  terminer: { alignSelf: 'flex-end', padding: espacements.sm },
  terminerTexte: { color: colors.accent },
}));
