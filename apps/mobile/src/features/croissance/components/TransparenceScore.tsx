import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Carte, Ecran, EnTete, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';

/**
 * Ce que le score fait et ne fait pas, en clair.
 *
 * Consultable **à tout moment**, y compris avant d'activer le module : on ne
 * demande pas un consentement à quelqu'un qui n'a pas pu lire ce à quoi il
 * consent. D'où l'icône d'information présente dans les deux états de
 * `SectionScore`, et cette page atteignable en permanence.
 */

/** Version courte, affichée en permanence sous le score. */
export const RESUME_TRANSPARENCE =
  'Ce score parle de gestes, pas de personnes. Il ne compare jamais l’un à ' +
  'l’autre, il n’existe qu’en une seule version — la même pour vous deux — et ' +
  'il ne mesure que ce qui passe par l’app. Une soirée entière sans téléphone ' +
  'n’y apparaîtra pas, et c’est très bien ainsi.';

/** Bouton d'accès, à placer près de tout affichage du score. */
export function BoutonTransparence() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Comprendre le score"
      accessibilityHint="Ouvre l’explication complète du calcul"
      onPress={() => router.push('/transparence-score')}
      hitSlop={12}
      style={({ pressed }) => [styles.bouton, pressed && styles.boutonPresse]}
    >
      <Feather name="info" size={18} color={colors.accentFonce} />
    </Pressable>
  );
}

const SECTIONS: { titre: string; paragraphes: string[] }[] = [
  {
    titre: 'Ce qu’il regarde',
    paragraphes: [
      'Uniquement des gestes que vous avez déjà faits ailleurs dans l’app : un message, une note douce, une humeur, un statut, un check-in, une gratitude, une lettre envoyée, un axe ouvert ou une part déposée sur un axe.',
      'Le score ne lit aucun contenu. Il ne connaît que le type du geste, qui l’a fait, et quel jour. Vos brouillons de lettres n’y entrent pas : ils sont à vous seul·e, et les compter reviendrait à trahir qu’ils existent.',
    ],
  },
  {
    titre: 'Ce qu’il ne fait pas',
    paragraphes: [
      'Il ne note personne. Il n’existe aucun score individuel dans cette app — ni le vôtre, ni celui de votre partenaire. Ce n’est pas un réglage d’affichage : la fonction qui le calculerait n’a pas été écrite, et un test empêche qu’elle apparaisse un jour.',
      'Il ne classe pas. Le score est unique et identique pour vous deux : il n’est pas possible d’en afficher une version à l’un et une autre à l’autre.',
      'Il ne récompense pas le volume. Cinquante messages dans la même journée comptent comme un seul jour vivant. Aucun geste ne pèse plus qu’un autre : une lettre ne « vaut » pas trois messages, parce que décider de ce qui compte le plus dans un couple n’est pas le rôle d’une app.',
      'Il n’y a aucune série à ne pas rompre, aucun compte à rebours. Un mécanisme qui punit l’oubli fabrique de l’anxiété, pas du lien.',
    ],
  },
  {
    titre: 'Comment il est calculé',
    paragraphes: [
      'Sur les quatorze derniers jours, trois choses sont regardées : la régularité (les jours où quelque chose s’est passé, 45 %), l’élan partagé (l’équilibre entre vos deux rythmes, sans jamais dire lequel est lequel, 35 %) et la variété (le nombre de façons différentes de vous rejoindre, 20 %).',
    ],
  },
  {
    titre: 'Les suggestions privées',
    paragraphes: [
      'Elles n’apparaissent que si vous êtes passé·e par ici moins souvent que d’habitude — comparé à vous-même, jamais à votre partenaire.',
      'Votre partenaire ne les voit pas et n’est pas prévenu·e qu’elles vous ont été proposées. Aucune notification n’est envoyée.',
      'Et si c’est votre partenaire qui s’éloigne, on ne vous suggère rien : ce n’est pas à vous de porter son rythme, et ce n’est pas à l’app de vous signaler qu’il a décroché.',
    ],
  },
  {
    titre: 'Sa limite, qu’il faut garder en tête',
    paragraphes: [
      'Ce score mesure l’app, pas votre couple. Une semaine passée ensemble sans toucher un téléphone le fera baisser. Ça ne veut rien dire de vous deux — seulement que vous étiez occupés à mieux.',
    ],
  },
];

export function TransparenceScore() {
  return (
    <Ecran>
      <EnTete
        surtitre="Score d’implication"
        titre="Comment il marche"
        sousTitre="Consultable à tout moment, avant comme après l’avoir activé."
      />

      {SECTIONS.map((section) => (
        <Carte key={section.titre}>
          <Texte variante="surtitre">{section.titre}</Texte>
          <View style={styles.paragraphes}>
            {section.paragraphes.map((p) => (
              <Texte key={p.slice(0, 24)} variante="corps">
                {p}
              </Texte>
            ))}
          </View>
        </Carte>
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bouton: {
    width: 32,
    height: 32,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondNuance,
  },
  boutonPresse: { opacity: 0.7 },
  paragraphes: { marginTop: espacements.sm, gap: espacements.md },
});
