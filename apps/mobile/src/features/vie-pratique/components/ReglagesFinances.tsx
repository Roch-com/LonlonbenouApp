import { useState } from 'react';
import { View } from 'react-native';
import {
  DEVISES,
  definitionDevise,
  partsEffectives,
  type ModeRepartition,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre, useMoi } from '@/features/reglages/stores/sessionStore';
import { useFinances, useReglesPartage } from '../stores/financesStore';

const MODES: readonly { code: ModeRepartition; libelle: string; detail: string }[] = [
  {
    code: 'egal',
    libelle: 'Moitié-moitié',
    detail: 'Chacun doit la moitié des dépenses communes.',
  },
  {
    code: 'revenus',
    libelle: 'Selon nos revenus',
    detail:
      'Chacun contribue à hauteur de ce qu’il gagne, pour qu’une dépense pèse pareil des deux côtés.',
  },
  {
    code: 'personnalise',
    libelle: 'Comme on l’a décidé',
    detail: 'Une répartition que vous fixez vous-mêmes, pour vos raisons.',
  },
];

/**
 * Réglages du module (§8.11).
 *
 * ## Les revenus ne sont jamais demandés
 *
 * Le mode « selon nos revenus » se règle par un pourcentage, pas en saisissant
 * deux salaires. Le résultat est le même pour le calcul, et l'app n'a aucune
 * raison de détenir ce que chacun gagne : c'est l'information la plus sensible
 * que ce module pourrait réclamer, et elle ne lui sert à rien.
 *
 * ## Éteindre n'efface pas
 *
 * Le texte le dit explicitement. Un interrupteur qui détruirait l'historique
 * serait un piège, et personne ne lit les conséquences avant de basculer.
 */
export function ReglagesFinances() {
  const moi = useMoi();
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);

  const reglages = useFinances((e) => e.reglages);
  const definirDevise = useFinances((e) => e.definirDevise);
  const definirRegles = useFinances((e) => e.definirRegles);
  const basculerModule = useFinances((e) => e.basculerModule);
  const regles = useReglesPartage();

  const [ouvert, setOuvert] = useState(false);
  const [partMienne, setPartMienne] = useState(() =>
    String(
      Math.round(
        (partsEffectives(regles, [moi.id, autre.id])[moi.id] ?? 0.5) * 100,
      ),
    ),
  );

  if (!coupleId || !partenaireId) return null;

  if (!ouvert) {
    return (
      <Bouton
        libelle="Réglages de nos comptes"
        ton="discret"
        icone="settings"
        onPress={() => setOuvert(true)}
      />
    );
  }

  const appliquerLeMode = (mode: ModeRepartition) => {
    if (mode === 'egal') {
      void definirRegles(coupleId, partenaireId, { mode: 'egal' });
      return;
    }
    const part = Math.min(100, Math.max(0, Number(partMienne) || 50)) / 100;
    void definirRegles(coupleId, partenaireId, {
      mode,
      parts: { [moi.id]: part, [autre.id]: 1 - part },
    });
  };

  return (
    <Carte>
      <Texte variante="surtitre">Réglages de nos comptes</Texte>

      <Texte variante="petit" style={styles.mention}>
        Comment répartir les dépenses communes
      </Texte>
      <View style={styles.modes}>
        {MODES.map((mode) => (
          <View key={mode.code} style={styles.mode}>
            <Texte variante="corps">{mode.libelle}</Texte>
            <Texte variante="petit">{mode.detail}</Texte>
            <Bouton
              libelle={regles.mode === mode.code ? 'Règle actuelle' : 'Choisir'}
              ton={regles.mode === mode.code ? 'discret' : 'secondaire'}
              disabled={regles.mode === mode.code}
              onPress={() => appliquerLeMode(mode.code)}
            />
          </View>
        ))}
      </View>

      {regles.mode !== 'egal' ? (
        <View style={styles.champs}>
          <Champ
            etiquette="Ma part, en pourcentage"
            value={partMienne}
            onChangeText={setPartMienne}
            keyboardType="number-pad"
          />
          <Texte variante="meta">
            {autre.prenom} prend le reste, soit{' '}
            {100 - (Number(partMienne) || 0)} %. Nous ne vous demandons pas vos
            revenus : un pourcentage suffit au calcul, et l’app n’a aucune raison
            de savoir ce que vous gagnez.
          </Texte>
          <Bouton
            libelle="Enregistrer cette répartition"
            ton="secondaire"
            onPress={() => appliquerLeMode(regles.mode)}
          />
        </View>
      ) : null}

      <Texte variante="petit" style={styles.mention}>
        Devise
      </Texte>
      <View style={styles.puces}>
        {DEVISES.map((d) => (
          <Puce
            key={d.code}
            libelle={`${d.code} (${d.symbole})`}
            active={reglages.devise === d.code}
            onPress={() => void definirDevise(coupleId, partenaireId, d.code)}
          />
        ))}
      </View>

      <View style={styles.champs}>
        <Texte variante="meta">
          Éteindre ce module masque les comptes sans rien effacer : tout revient
          si vous le rallumez. Devise actuelle :{' '}
          {definitionDevise(reglages.devise).code}.
        </Texte>
        <Bouton
          libelle="Éteindre nos comptes"
          ton="discret"
          onPress={() => void basculerModule(coupleId, partenaireId, false)}
        />
        <Bouton libelle="Fermer" ton="discret" onPress={() => setOuvert(false)} />
      </View>
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  mention: { marginTop: espacements.lg },
  modes: { marginTop: espacements.sm, gap: espacements.md },
  mode: { gap: espacements.xs },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.sm,
  },
  fond: { backgroundColor: colors.fond },
}));
