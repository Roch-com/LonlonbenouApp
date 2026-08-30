import { StyleSheet, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useRouter } from 'expo-router';
import {
  monElan,
  scoreDuCouple,
  suggestionsPrivees,
  type Composante,
  type TypeGeste,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { ConsentementServeur } from '@/features/reglages/components/ConsentementServeur';
import { ReglagePartage } from '@/features/reglages/components/ReglagePartage';
import { usePartageServeurActif } from '@/features/reglages/stores/partagesServeurStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import {
  useAutre,
  useMoi,
  usePartageActif,
  useSession,
} from '@/features/reglages/stores/sessionStore';
import { useGestes } from '../hooks/useGestes';
import { BoutonTransparence, RESUME_TRANSPARENCE } from './TransparenceScore';

/**
 * Pôle ② — Score d'implication (P0 : base + suggestions privées).
 *
 * Un seul score, celui du couple, identique des deux côtés. Aucun chiffre
 * individuel n'est affiché — ni le mien, ni celui de l'autre. Les suggestions
 * ne concernent que la personne qui les lit et ne produisent aucune
 * notification : le partenaire n'apprend jamais qu'elles ont existé.
 */
export function SectionScore() {
  const moi = useMoi();
  const autre = useAutre();
  const couple = useSession((e) => e.couple);
  const coupleId = useSessionServeur((e) => e.coupleId);
  // Dès que les comptes sont reliés, l'état qui compte est celui du serveur.
  // La copie locale ne connaissait que le consentement de ce téléphone-ci et
  // affirmait que l'autre n'avait rien activé, alors qu'il l'avait fait.
  const actifServeur = usePartageServeurActif('score');
  const actifLocal = usePartageActif('score');
  const actif = coupleId ? actifServeur : actifLocal;
  const gestes = useGestes();

  if (!actif) {
    return (
      <Carte>
        <View style={styles.enteteAvecInfo}>
          <Texte variante="titre" style={styles.titreFlex}>
            Un repère, si vous le voulez
          </Texte>
          <BoutonTransparence />
        </View>
        <Texte variante="corpsDoux" style={styles.intro}>
          Le score ne s’allume qu’à deux, et il ne note personne : il regarde vos
          gestes des deux dernières semaines, pas vos qualités. Tant que l’un des
          deux ne l’a pas activé, il n’existe ni pour vous ni pour {autre.prenom}.
        </Texte>
        <Texte variante="meta" style={styles.intro}>
          Vous pouvez lire le détail complet du calcul avant de décider : touchez
          l’icône d’information ci-dessus.
        </Texte>
        <View style={styles.reglage}>
          {coupleId ? (
            <ConsentementServeur
              coupleId={coupleId}
              module="score"
              prenomAutre={autre.prenom}
            />
          ) : (
            <ReglagePartage module="score" sansTitre />
          )}
        </View>
      </Carte>
    );
  }

  const maintenant = new Date().toISOString();
  const partenaires = [couple.partenaires[0].id, couple.partenaires[1].id] as const;
  const score = scoreDuCouple(gestes, partenaires, maintenant);
  const elan = monElan(gestes, moi.id, maintenant);
  const suggestions = suggestionsPrivees(gestes, moi.id, maintenant);

  return (
    <View style={styles.section}>
      <Carte>
        <View style={styles.enteteAvecInfo}>
          <Texte variante="surtitre" style={styles.titreFlex}>
            Notre élan · {score.fenetreJours} derniers jours
          </Texte>
          <BoutonTransparence />
        </View>
        <Texte variante="titre" style={styles.bande}>
          {score.libelle}
        </Texte>

        <View style={styles.chiffre}>
          <Texte variante="affiche">{score.valeur}</Texte>
          <Texte variante="corpsDoux" style={styles.sur}>
            / 100
          </Texte>
        </View>

        <Texte variante="petit">
          {score.joursVivants} jour{score.joursVivants > 1 ? 's' : ''} où quelque
          chose est passé entre vous.
        </Texte>

        <View style={styles.composantes}>
          {score.composantes.map((c) => (
            <Jauge key={c.code} composante={c} />
          ))}
        </View>
      </Carte>

      {/* Résumé permanent : jamais masquable, jamais « déjà vu ». L'icône
          d'information de l'en-tête mène à l'explication complète. */}
      <Carte discrete>
        <Texte variante="petit">{RESUME_TRANSPARENCE}</Texte>
      </Carte>

      <MonRythme tendance={elan.tendance} joursActifs={elan.joursActifs} />

      {suggestions.length > 0 ? (
        <Carte>
          <Texte variante="surtitre">Pour vous seul·e</Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            {autre.prenom} ne voit pas ces suggestions et n’est pas prévenu·e
            qu’elles vous sont proposées. Rien ne vous oblige à les suivre.
          </Texte>
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Suggestion key={s.geste} geste={s.geste} texte={s.texte} />
            ))}
          </View>
        </Carte>
      ) : null}
    </View>
  );
}

function MonRythme({
  tendance,
  joursActifs,
}: {
  tendance: 'en_hausse' | 'stable' | 'en_retrait';
  joursActifs: number;
}) {
  const phrases = {
    en_hausse: 'Vous avez été plus présent·e que sur la période d’avant.',
    stable: 'Votre rythme ressemble à celui de la période d’avant.',
    en_retrait: 'Vous êtes passé·e par ici moins souvent que d’habitude.',
  } as const;

  return (
    <Carte discrete>
      <Texte variante="surtitre">Mon rythme</Texte>
      <Texte variante="corps" style={styles.intro}>
        {phrases[tendance]}
      </Texte>
      <Texte variante="meta">
        {joursActifs} jour{joursActifs > 1 ? 's' : ''} avec un geste de votre part.
        Cette ligne ne s’affiche que pour vous — elle vous situe par rapport à
        vous-même, jamais par rapport à l’autre.
      </Texte>
    </Carte>
  );
}

const DESTINATIONS: Partial<Record<TypeGeste, { route: string; libelle: string }>> =
  {
    note_douce: { route: '/', libelle: 'Aller à l’accueil' },
    message: { route: '/chat', libelle: 'Ouvrir la conversation' },
    humeur: { route: '/chat', libelle: 'Dire mon humeur' },
    statut: { route: '/presence', libelle: 'Mettre à jour mon statut' },
    check_in: { route: '/presence', libelle: 'Faire un check-in' },
    gratitude: { route: '/croissance', libelle: 'Écrire un merci' },
    lettre: { route: '/croissance', libelle: 'Commencer une lettre' },
  };

function Suggestion({ geste, texte }: { geste: TypeGeste; texte: string }) {
  const router = useRouter();
  const destination = DESTINATIONS[geste];

  return (
    <View style={styles.suggestion}>
      <Texte variante="corps">{texte}</Texte>
      {destination ? (
        <Bouton
          libelle={destination.libelle}
          ton="secondaire"
          onPress={() => router.push(destination.route as never)}
        />
      ) : null}
    </View>
  );
}

function Jauge({ composante }: { composante: Composante }) {
  return (
    <View style={styles.jauge}>
      <View style={styles.jaugeEntete}>
        <Texte variante="petit" style={styles.jaugeLibelle}>
          {composante.libelle}
        </Texte>
        <Texte variante="meta">{composante.valeur}</Texte>
      </View>
      <View
        style={styles.piste}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: composante.valeur, min: 0, max: 100 }}
      >
        <View style={[styles.remplissage, { width: `${composante.valeur}%` }]} />
      </View>
      <Texte variante="meta">{composante.explication}</Texte>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  section: { gap: espacements.md },
  enteteAvecInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacements.sm,
  },
  titreFlex: { flex: 1 },
  intro: { marginTop: espacements.xs },
  reglage: { marginTop: espacements.lg },
  bande: { marginTop: espacements.xs },
  chiffre: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacements.xxs,
    marginTop: espacements.sm,
  },
  sur: { color: colors.texteDoux },
  composantes: {
    marginTop: espacements.lg,
    paddingTop: espacements.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
    gap: espacements.lg,
  },
  jauge: { gap: espacements.xs },
  jaugeEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  jaugeLibelle: { color: colors.texte },
  piste: {
    height: 6,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
    overflow: 'hidden',
  },
  remplissage: {
    height: '100%',
    borderRadius: rayons.rond,
    backgroundColor: colors.accent,
  },
  suggestions: { marginTop: espacements.md, gap: espacements.lg },
  suggestion: { gap: espacements.sm },
}));
