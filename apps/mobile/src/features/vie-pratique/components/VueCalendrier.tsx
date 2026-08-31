import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  grilleDuMois,
  INITIALES_JOURS,
  marquesDuCouple,
  NOMS_MOIS,
  quand,
  type SorteMarque,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Carte, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useCycle } from '@/features/intimite/stores/cycleStore';
import { useViePratique } from '../stores/viePratiqueStore';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Pôle ③ — vue mensuelle agrégée (§8.9 du cahier).
 *
 * Le module demandait « une vue calendrier commune agrégeant cycle, projets,
 * initiatives planifiées, rendez-vous, anniversaires ». L'app n'avait qu'une
 * liste d'événements : rien ne permettait de voir qu'un même week-end portait
 * déjà trois engagements pris dans trois écrans différents.
 *
 * ## Des points, pas des étiquettes
 *
 * Une case de calendrier mensuel fait une trentaine de pixels de large : y
 * écrire des titres donne une bouillie illisible. Chaque case porte donc des
 * points colorés par nature, et le détail du jour s'affiche dessous quand on
 * le touche. C'est ce que font les calendriers qui se lisent d'un coup d'œil.
 *
 * ## Le cycle n'entre ici que par la porte du pôle ④
 *
 * On ne lit jamais les règles : on lit la vue déjà filtrée par le serveur.
 * Pour la personne concernée c'est sa phase, pour le partenaire c'est ce que
 * le niveau autorise — et rien du tout s'il n'y a pas de partage. Un
 * calendrier ne doit pas devenir la porte dérobée du module le plus sensible.
 */
export function VueCalendrier() {
  const colors = useCouleurs();
  const depuis = useSessionServeur((e) => e.depuis);
  const evenements = useViePratique((e) => e.evenements);
  const projets = useViePratique((e) => e.projets);
  const initiatives = useViePratique((e) => e.initiatives);
  const vueCycle = useCycle((e) => e.vue);

  const [curseur, setCurseur] = useState(() => {
    const maintenant = new Date();
    return { annee: maintenant.getFullYear(), mois: maintenant.getMonth() + 1 };
  });
  const [jourChoisi, setJourChoisi] = useState<string>();

  /**
   * Ce que le cycle laisse voir, et rien de plus.
   *
   * On ne marque qu'aujourd'hui, volontairement : la projection reçue par le
   * partenaire ne contient aucune date, et reconstituer un calendrier de
   * phases à partir d'elle reviendrait à déduire ce que le serveur a
   * précisément refusé de donner.
   */
  const phasesCycle = useMemo(() => {
    if (!vueCycle) return [];
    if (vueCycle.role === 'porteuse' && vueCycle.etat) {
      return [{ jour: aujourdhui(), libelle: 'Mon cycle' }];
    }
    if (vueCycle.role === 'partenaire' && vueCycle.vue.partage) {
      return [{ jour: aujourdhui(), libelle: 'Cycle partagé' }];
    }
    return [];
  }, [vueCycle]);

  const marques = useMemo(
    () =>
      marquesDuCouple({
        evenements,
        projets,
        initiatives,
        phasesCycle,
        depuis,
        annee: curseur.annee,
      }),
    [evenements, projets, initiatives, phasesCycle, depuis, curseur.annee],
  );

  const semaines = useMemo(
    () => grilleDuMois(curseur.annee, curseur.mois, marques),
    [curseur, marques],
  );

  const decaler = (pas: number) => {
    setJourChoisi(undefined);
    setCurseur(({ annee, mois }) => {
      const total = annee * 12 + (mois - 1) + pas;
      return { annee: Math.floor(total / 12), mois: (total % 12) + 1 };
    });
  };

  const jour = aujourdhui();
  const duJour = marques.filter((m) => m.jour === jourChoisi);

  return (
    <Carte>
      <View style={styles.entete}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          hitSlop={12}
          onPress={() => decaler(-1)}
          style={({ pressed }) => [styles.fleche, pressed && styles.pressee]}
        >
          <Feather name="chevron-left" size={20} color={colors.texte} />
        </Pressable>

        <Texte variante="sousTitre" style={styles.mois}>
          {NOMS_MOIS[curseur.mois - 1]} {curseur.annee}
        </Texte>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          hitSlop={12}
          onPress={() => decaler(1)}
          style={({ pressed }) => [styles.fleche, pressed && styles.pressee]}
        >
          <Feather name="chevron-right" size={20} color={colors.texte} />
        </Pressable>
      </View>

      <View style={styles.semaine}>
        {INITIALES_JOURS.map((initiale, i) => (
          <Texte key={i} variante="meta" style={styles.initiale}>
            {initiale}
          </Texte>
        ))}
      </View>

      {semaines.map((semaine) => (
        <View key={semaine.jours[0]!.jour} style={styles.semaine}>
          {semaine.jours.map((caseJour) => {
            const estAujourdhui = caseJour.jour === jour;
            const choisi = caseJour.jour === jourChoisi;
            return (
              <Pressable
                key={caseJour.jour}
                accessibilityRole="button"
                accessibilityLabel={etiquetteCase(caseJour.jour, jour, caseJour.marques.length)}
                onPress={() =>
                  setJourChoisi((actuel) =>
                    actuel === caseJour.jour ? undefined : caseJour.jour,
                  )
                }
                style={({ pressed }) => [
                  styles.case_,
                  choisi && styles.caseChoisie,
                  estAujourdhui && !choisi && styles.caseAujourdhui,
                  pressed && styles.pressee,
                ]}
              >
                <Texte
                  variante="petit"
                  style={[
                    !caseJour.duMois && styles.horsMois,
                    choisi && styles.texteChoisi,
                  ]}
                >
                  {Number(caseJour.jour.slice(8))}
                </Texte>
                <View style={styles.points}>
                  {/* Trois points au plus : au-delà, la case devient une tache
                      et ne dit rien de mieux qu'un simple « chargé ». */}
                  {caseJour.marques.slice(0, 3).map((marque, i) => (
                    <View
                      key={i}
                      style={[
                        styles.point,
                        { backgroundColor: couleurDe(marque.sorte, colors) },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {jourChoisi ? (
        <View style={styles.detail}>
          <Texte variante="surtitre">{quand(jourChoisi, jour)}</Texte>
          {duJour.length === 0 ? (
            <Texte variante="corpsDoux" style={styles.vide}>
              Rien de prévu ce jour-là.
            </Texte>
          ) : (
            duJour.map((marque, i) => (
              <View key={i} style={styles.ligne}>
                <View
                  style={[
                    styles.pastille,
                    { backgroundColor: couleurDe(marque.sorte, colors) },
                  ]}
                />
                <View style={styles.ligneTexte}>
                  <Texte variante="corps">{marque.titre}</Texte>
                  <Texte variante="meta">{LIBELLES[marque.sorte]}</Texte>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.legende}>
        {(Object.keys(LIBELLES) as SorteMarque[]).map((sorte) => (
          <View key={sorte} style={styles.legendeItem}>
            <View
              style={[styles.point, { backgroundColor: couleurDe(sorte, colors) }]}
            />
            <Texte variante="meta">{LIBELLES[sorte]}</Texte>
          </View>
        ))}
      </View>
    </Carte>
  );
}

const LIBELLES: Record<SorteMarque, string> = {
  evenement: 'Agenda',
  jalon: 'Projet',
  initiative: 'Sortie',
  cycle: 'Cycle',
  anniversaire: 'Anniversaire',
};

/** Le lecteur d'écran annonce le jour et sa charge, pas un numéro isolé. */
function etiquetteCase(jourCase: string, maintenant: string, nombre: number): string {
  const relatif = quand(jourCase, maintenant);
  if (nombre === 0) return `${relatif}, rien de prévu`;
  return `${relatif}, ${nombre} élément${nombre > 1 ? 's' : ''}`;
}

/**
 * Une teinte par nature. Le cycle garde le rose de la tendresse, déjà celui du
 * pôle ④ : conserver la même couleur d'un écran à l'autre évite de réapprendre
 * la légende à chaque module.
 */
function couleurDe(sorte: SorteMarque, colors: Theme['colors']): string {
  switch (sorte) {
    case 'evenement':
      return colors.accent;
    case 'jalon':
      return colors.or;
    case 'initiative':
      return colors.accentDoux;
    case 'cycle':
      return colors.tendresse;
    default:
      return colors.accentFonce;
  }
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacements.sm,
  },
  fleche: {
    width: 36,
    height: 36,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressee: { backgroundColor: colors.effleurement },
  mois: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  semaine: { flexDirection: 'row', marginTop: espacements.xs },
  initiale: { flex: 1, textAlign: 'center' },
  case_: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: rayons.sm,
  },
  caseAujourdhui: { borderWidth: 1, borderColor: colors.accentDoux },
  caseChoisie: { backgroundColor: colors.accent },
  texteChoisi: { color: colors.texteInverse },
  horsMois: { opacity: 0.35 },
  points: { flexDirection: 'row', gap: 2, height: 5 },
  point: { width: 5, height: 5, borderRadius: 2.5 },
  detail: {
    marginTop: espacements.lg,
    paddingTop: espacements.md,
    borderTopWidth: 1,
    borderTopColor: colors.bordure,
    gap: espacements.sm,
  },
  vide: { marginTop: espacements.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.sm },
  pastille: { width: 8, height: 8, borderRadius: 4 },
  ligneTexte: { flex: 1, minWidth: 0 },
  legende: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.md,
    marginTop: espacements.lg,
  },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: espacements.xxs },
}));
