import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useComplicite, useEchangeLisible } from '../stores/compliciteStore';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Pôle ② — question de complicité du jour (§8.6).
 *
 * ## Ce que l'écran ne montre pas
 *
 * La réponse de l'autre, tant qu'on n'a pas écrit la sienne. Ce n'est pas un
 * suspense : une réponse lue d'avance n'est plus une réponse, c'est un
 * commentaire. Le serveur ne l'envoie même pas — l'écran n'a rien à masquer.
 *
 * ## Le champ reste ouvert après coup
 *
 * On peut réécrire sa réponse. Le miroir protège de l'influence, pas du droit
 * de se reprendre : une phrase qu'on regrette d'avoir mal dite doit pouvoir
 * être corrigée, y compris après que l'autre l'a lue.
 */
export function QuestionDuJour() {
  const autre = useAutre();
  const coupleId = useSessionServeur((e) => e.coupleId);
  const charger = useComplicite((e) => e.charger);
  const repondre = useComplicite((e) => e.repondre);
  const erreur = useComplicite((e) => e.erreur);
  const echange = useEchangeLisible();

  const [brouillon, setBrouillon] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const jour = aujourdhui();

  useFocusEffect(
    useCallback(() => {
      if (coupleId) void charger(coupleId, jour);
    }, [coupleId, charger, jour]),
  );

  if (!coupleId || !echange) return null;

  const envoyer = async () => {
    setEnCours(true);
    try {
      if (await repondre(coupleId, jour, brouillon)) {
        setBrouillon('');
        setOuvert(false);
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte>
      <Texte variante="surtitre">La question du jour</Texte>
      <Texte variante="titre" style={styles.question}>
        {echange.question.texte}
      </Texte>

      {echange.mienne ? (
        <View style={styles.reponse}>
          <Texte variante="meta">Vous</Texte>
          <Texte variante="corps">{echange.mienne}</Texte>
        </View>
      ) : null}

      {echange.sienne ? (
        <View style={[styles.reponse, styles.sienne]}>
          <Texte variante="meta">{autre.prenom}</Texte>
          <Texte variante="corps">{echange.sienne}</Texte>
        </View>
      ) : null}

      <Texte variante="meta" style={styles.lecture}>
        {echange.lecture}
      </Texte>

      {ouvert ? (
        <View style={styles.champs}>
          <Champ
            etiquette={echange.mienne ? 'Reprendre ma réponse' : 'Ma réponse'}
            value={brouillon}
            onChangeText={setBrouillon}
            multiline
          />
          <Bouton
            libelle="Répondre"
            enCours={enCours}
            disabled={!brouillon.trim()}
            onPress={() => void envoyer()}
          />
          <Bouton libelle="Annuler" ton="discret" onPress={() => setOuvert(false)} />
        </View>
      ) : (
        <View style={styles.champs}>
          <Bouton
            libelle={echange.mienne ? 'Reprendre ma réponse' : 'Répondre'}
            ton={echange.mienne ? 'discret' : 'secondaire'}
            onPress={() => {
              setBrouillon(echange.mienne ?? '');
              setOuvert(true);
            }}
          />
        </View>
      )}

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  question: { marginTop: espacements.xs },
  reponse: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    gap: espacements.xxs,
  },
  sienne: { backgroundColor: colors.effleurement },
  lecture: { marginTop: espacements.md },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  erreur: { color: colors.tendresse, marginTop: espacements.sm },
}));
