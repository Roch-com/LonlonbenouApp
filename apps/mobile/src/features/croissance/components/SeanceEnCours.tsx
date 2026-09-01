import { useState } from 'react';
import { View } from 'react-native';
import {
  AVERTISSEMENT,
  type Theme,
  type VueParcours,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, Texte } from '@/components/ui';
import { espacements, rayons } from '@/design/theme';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { useParcours, useSeanceLisible } from '../stores/parcoursStore';

interface Props {
  vue: VueParcours;
  coupleId: string;
  onRetour: () => void;
}

/**
 * La séance en cours d’un parcours (§8.7).
 *
 * ## Deux temps, dans cet ordre
 *
 * `chacun` est visible dès l’ouverture ; `ensemble` n’apparaît qu’une fois les
 * deux réponses écrites. Montrer d’avance la consigne de comparaison ferait
 * écrire en pensant à ce qui va être comparé, ce que l’exercice cherche
 * précisément à éviter.
 *
 * ## Le bouton « on en a parlé » ne se force pas
 *
 * Il n’apparaît qu’à l’état `a_echanger`. Marquer l’échange fait avancer le
 * parcours **pour les deux** : le proposer plus tôt permettrait à l’un de
 * passer la séance de l’autre.
 */
export function SeanceEnCours({ vue, coupleId, onRetour }: Props) {
  const autre = useAutre();
  const repondre = useParcours((e) => e.repondre);
  const engager = useParcours((e) => e.engager);
  const marquerEchange = useParcours((e) => e.marquerEchange);
  const envoi = useParcours((e) => e.envoi);
  const erreur = useParcours((e) => e.erreur);
  const lisible = useSeanceLisible();

  const [brouillon, setBrouillon] = useState('');

  const parcoursId = vue.parcours.id;
  const courante = vue.courante;

  return (
    <View style={styles.pile}>
      <Bouton libelle="← Tous les parcours" ton="discret" onPress={onRetour} />

      <Carte>
        <Texte variante="surtitre">{vue.parcours.titre}</Texte>
        <Texte variante="corps" style={styles.espace}>
          {vue.parcours.promesse}
        </Texte>
        <Texte variante="meta" style={styles.espace}>
          {vue.lecture}
        </Texte>
      </Carte>

      {!vue.engage ? (
        <Carte>
          <Texte variante="corps">
            À commencer quand vous voulez, tous les deux. Une séance dure cinq
            minutes.
          </Texte>
          <View style={styles.espace}>
            <Bouton
              libelle="Commencer ce parcours"
              enCours={envoi}
              onPress={() => void engager(coupleId, parcoursId)}
            />
          </View>
        </Carte>
      ) : null}

      {courante ? (
        <Carte>
          <Texte variante="surtitre">
            Séance {courante.rang} sur {courante.total}
          </Texte>
          <Texte variante="titre" style={styles.espace}>
            {courante.seance.titre}
          </Texte>
          <Texte variante="meta" style={styles.espace}>
            {courante.seance.intention}
          </Texte>

          <View style={styles.consigne}>
            <Texte variante="meta">Chacun de son côté</Texte>
            <Texte variante="corps">{courante.seance.chacun}</Texte>
          </View>

          {lisible.mienne ? (
            <View style={styles.reponse}>
              <Texte variante="meta">Vous</Texte>
              <Texte variante="corps">{lisible.mienne}</Texte>
            </View>
          ) : null}

          {lisible.sienne ? (
            <View style={[styles.reponse, styles.sienne]}>
              <Texte variante="meta">{autre.prenom}</Texte>
              <Texte variante="corps">{lisible.sienne}</Texte>
            </View>
          ) : null}

          {/* La consigne de comparaison arrive après, jamais avant. */}
          {courante.etat === 'a_echanger' ? (
            <View style={styles.consigne}>
              <Texte variante="meta">Ensemble</Texte>
              <Texte variante="corps">{courante.seance.ensemble}</Texte>
            </View>
          ) : null}

          <Texte variante="meta" style={styles.espace}>
            {courante.lecture}
          </Texte>

          {courante.etat === 'a_faire' || courante.etat === 'lui_seul' ? (
            <View style={styles.champs}>
              <Champ
                etiquette="Ma réponse"
                value={brouillon}
                onChangeText={setBrouillon}
                multiline
              />
              <Bouton
                libelle="Garder ma réponse"
                enCours={envoi}
                disabled={!brouillon.trim()}
                onPress={() => {
                  void repondre(
                    coupleId,
                    parcoursId,
                    courante.seance.id,
                    brouillon,
                  ).then((ok) => {
                    if (ok) setBrouillon('');
                  });
                }}
              />
            </View>
          ) : null}

          {courante.etat === 'a_echanger' ? (
            <View style={styles.champs}>
              <Bouton
                libelle="On en a parlé"
                enCours={envoi}
                onPress={() =>
                  void marquerEchange(coupleId, parcoursId, courante.seance.id)
                }
              />
            </View>
          ) : null}
        </Carte>
      ) : null}

      {vue.termine ? (
        <Carte>
          <Texte variante="titre">Parcours terminé</Texte>
          <Texte variante="corps" style={styles.espace}>
            Les {vue.total} séances ont été faites toutes les deux. Vous pouvez
            y revenir quand vous voulez.
          </Texte>
        </Carte>
      ) : null}

      <Texte variante="petit" style={styles.avertissement}>
        {AVERTISSEMENT}
      </Texte>

      {erreur ? (
        <Texte variante="petit" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  pile: { gap: espacements.md },
  espace: { marginTop: espacements.xs },
  consigne: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.effleurement,
    gap: espacements.xxs,
  },
  reponse: {
    marginTop: espacements.md,
    padding: espacements.md,
    borderRadius: rayons.md,
    backgroundColor: colors.fondNuance,
    gap: espacements.xxs,
  },
  sienne: { backgroundColor: colors.effleurement },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  avertissement: { color: colors.texteDoux },
  erreur: { color: colors.tendresse },
}));
