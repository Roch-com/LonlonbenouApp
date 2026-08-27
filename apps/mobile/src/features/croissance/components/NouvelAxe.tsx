import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AXES_SUGGERES, THEMES_AXE, type ThemeAxe } from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';

interface Props {
  prenomAutre: string;
  onOuvrir: (theme: ThemeAxe, titre: string) => void;
}

export function NouvelAxe({ prenomAutre, onOuvrir }: Props) {
  const [deplie, setDeplie] = useState(false);
  const [theme, setTheme] = useState<ThemeAxe>('communication');
  const [titre, setTitre] = useState('');

  const valider = () => {
    if (!titre.trim()) return;
    onOuvrir(theme, titre);
    setTitre('');
    setDeplie(false);
  };

  if (!deplie) {
    return <Bouton libelle="Ouvrir un axe" onPress={() => setDeplie(true)} />;
  }

  return (
    <Carte>
      <Texte variante="surtitre">Nouvel axe</Texte>
      <Texte variante="corpsDoux" style={styles.intro}>
        Un axe s’ouvre pour vous deux. {prenomAutre} le verra apparaître et pourra y
        déposer sa part.
      </Texte>

      <View style={styles.puces}>
        {THEMES_AXE.map((t) => (
          <Puce
            key={t.code}
            libelle={t.libelle}
            emoji={t.emoji}
            active={theme === t.code}
            onPress={() => setTheme(t.code)}
          />
        ))}
      </View>

      <View style={styles.champs}>
        <Champ
          etiquette="De quoi s’agit-il ?"
          placeholder="Le sujet, en une phrase."
          value={titre}
          onChangeText={setTitre}
        />

        <Texte variante="meta">Ou partez d’une amorce :</Texte>
        <View style={styles.puces}>
          {AXES_SUGGERES.map((s) => (
            <Puce
              key={s.titre}
              libelle={s.titre}
              active={titre === s.titre}
              onPress={() => {
                setTitre(s.titre);
                setTheme(s.theme);
              }}
            />
          ))}
        </View>

        <Bouton libelle="Ouvrir l’axe" onPress={valider} disabled={!titre.trim()} />
        <Bouton libelle="Annuler" ton="discret" onPress={() => setDeplie(false)} />
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  champs: { gap: espacements.sm, marginTop: espacements.md },
});
