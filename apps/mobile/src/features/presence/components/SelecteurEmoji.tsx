import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements, rayons } from '@/design/theme';

/**
 * Sélection d'emoji.
 *
 * ## Pourquoi une sélection et non un clavier complet
 *
 * Les claviers Android et iOS ont déjà le leur, complet, que la personne
 * connaît. En réécrire un serait un travail considérable pour un résultat
 * inférieur — et surtout, il faudrait charger plusieurs milliers de caractères
 * et leurs catégories, pour un usage qui, dans une conversation de couple, se
 * concentre sur une poignée de signes.
 *
 * Ce panneau ne remplace pas le clavier système : il met à portée de pouce ce
 * qui sert vraiment, sans quitter le champ de saisie.
 */
const FAMILLES: { nom: string; emojis: string[] }[] = [
  {
    nom: 'Tendresse',
    emojis: [
      '❤️',
      '🥰',
      '😍',
      '😘',
      '💋',
      '🤍',
      '💕',
      '💖',
      '🫶',
      '🤗',
      '💐',
      '🌹',
    ],
  },
  {
    nom: 'Humeurs',
    emojis: [
      '😊',
      '😂',
      '🙂',
      '😅',
      '😌',
      '🥹',
      '😢',
      '😭',
      '😴',
      '🥱',
      '😤',
      '🙄',
    ],
  },
  {
    nom: 'Du jour',
    emojis: [
      '👍',
      '🙏',
      '👌',
      '✅',
      '⏰',
      '🚗',
      '🏠',
      '🍽️',
      '☕',
      '🛒',
      '💼',
      '📞',
    ],
  },
  {
    nom: 'Ailleurs',
    emojis: [
      '✨',
      '🎉',
      '🎁',
      '🥂',
      '🌙',
      '☀️',
      '🌧️',
      '🔥',
      '⭐',
      '🎵',
      '📷',
      '🧿',
    ],
  },
];

interface Props {
  onChoisir: (emoji: string) => void;
}

export function SelecteurEmoji({ onChoisir }: Props) {
  const [famille, setFamille] = useState(0);
  const courante = FAMILLES[famille]!;

  return (
    <View style={styles.panneau}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.onglets}
      >
        {FAMILLES.map((f, i) => (
          <Pressable
            key={f.nom}
            onPress={() => setFamille(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === famille }}
            style={({ pressed }) => [
              styles.onglet,
              i === famille && styles.ongletActif,
              pressed && styles.presse,
            ]}
          >
            <Texte
              variante="petit"
              style={i === famille ? styles.ongletTexteActif : undefined}
            >
              {f.nom}
            </Texte>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grille}>
        {courante.emojis.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onChoisir(emoji)}
            accessibilityRole="button"
            accessibilityLabel={`Emoji ${emoji}`}
            style={({ pressed }) => [styles.case, pressed && styles.presse]}
          >
            <Texte variante="titre">{emoji}</Texte>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  panneau: {
    backgroundColor: colors.fondEleve,
    borderTopWidth: 1,
    borderTopColor: colors.bordure,
    paddingBottom: espacements.xs,
  },
  onglets: {
    gap: espacements.xs,
    paddingHorizontal: espacements.md,
    paddingVertical: espacements.xs,
  },
  onglet: {
    paddingVertical: espacements.xxs,
    paddingHorizontal: espacements.sm,
    borderRadius: rayons.rond,
    backgroundColor: colors.fondNuance,
  },
  ongletActif: { backgroundColor: colors.effleurement },
  ongletTexteActif: { color: colors.accentFonce },
  presse: { opacity: 0.6 },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: espacements.sm,
  },
  // Six par rangée : au-delà, les cases descendent sous la zone tactile
  // confortable de 44 points.
  case: {
    width: `${100 / 6}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
