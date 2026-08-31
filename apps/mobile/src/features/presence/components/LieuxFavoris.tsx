import { useState } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { usePosition } from '../stores/positionStore';
import { LIEUX_SUGGERES, useLieux } from '../stores/lieuxStore';

/**
 * Pôle ① — lieux favoris (§8.2).
 *
 * ## Ce que l'autre reçoit
 *
 * Le nom du lieu, jamais ses coordonnées. Vous enregistrez « Maison » ici, et
 * votre partenaire voit « est à la maison » — l'adresse ne quitte pas ce
 * téléphone. Une liste de lieux nommés est bien plus révélatrice qu'une
 * position ponctuelle : elle dit où l'on dort, où l'on travaille, où vit sa
 * famille, et elle reste vraie des années.
 *
 * ## Un geste, pas une automatisation
 *
 * On enregistre le lieu où l'on se trouve, en le nommant. Pas de détection
 * automatique des lieux fréquentés : deviner que quelqu'un passe ses nuits à
 * telle adresse et le lui proposer serait exactement la surveillance douce que
 * ce projet refuse, même bien intentionnée.
 */
export function LieuxFavoris() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const mienne = usePosition((e) => e.mienne);
  const permission = usePosition((e) => e.permission);
  const lieux = useLieux((e) => e.lieux);
  const ajouter = useLieux((e) => e.ajouter);
  const supprimer = useLieux((e) => e.supprimer);
  const partenaireId = useSessionServeur((e) => e.partenaireId);

  const [nom, setNom] = useState('');
  const [statut, setStatut] = useState<string>();

  if (permission !== 'accordee') return null;

  const enregistrer = () => {
    if (!mienne || !nom.trim()) return;
    ajouter(nom, mienne, statut);
    setNom('');
    setStatut(undefined);
  };

  return (
    <Carte>
      <Texte variante="surtitre">Mes lieux</Texte>
      <Texte variante="petit" style={styles.mention}>
        Ils restent sur ce téléphone. Votre partenaire voit « à la maison »,
        jamais l’adresse de la maison.
      </Texte>

      {lieux.length > 0 ? (
        <View style={styles.liste}>
          {lieux.map((lieu) => (
            <View key={lieu.id} style={styles.ligne}>
              <View style={styles.ligneTexte}>
                <Texte variante="corps">{lieu.nom}</Texte>
                <Texte variante="meta">
                  {lieu.statut
                    ? `pose « ${lieu.statut} » · ${lieu.rayonM} m`
                    : `${lieu.rayonM} m autour`}
                </Texte>
              </View>
              <Bouton
                libelle="Retirer"
                ton="discret"
                pleineLargeur={false}
                onPress={() => supprimer(lieu.id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.champs}>
        <Texte variante="petit">
          {mienne
            ? 'Enregistrer l’endroit où vous êtes en ce moment :'
            : 'En attente d’un premier relevé de position…'}
        </Texte>

        <View style={styles.puces}>
          {LIEUX_SUGGERES.map((suggestion) => (
            <Puce
              key={suggestion.nom}
              libelle={suggestion.nom}
              active={nom === suggestion.nom}
              onPress={() => {
                setNom(suggestion.nom);
                setStatut(suggestion.statut);
              }}
            />
          ))}
        </View>

        <Champ
          etiquette="Nom du lieu"
          value={nom}
          onChangeText={setNom}
          placeholder="Maison, Travail…"
        />

        <Bouton
          libelle="Enregistrer ici"
          ton="secondaire"
          icone="map-pin"
          disabled={!mienne || !nom.trim()}
          onPress={enregistrer}
        />
      </View>

      {/* Poser son statut à la main reste possible : un lieu favori propose,
          il ne décide pas à la place de la personne. */}
      {coupleId && partenaireId && lieux.some((l) => l.statut) ? (
        <View style={styles.champs}>
          <Texte variante="meta">
            Un lieu qui porte un statut le proposera à votre arrivée. Vous
            pouvez toujours en poser un autre à la main juste au-dessus.
          </Texte>
        </View>
      ) : null}
    </Carte>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  mention: { marginTop: espacements.xs },
  liste: { marginTop: espacements.lg, gap: espacements.md },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  ligneTexte: { flex: 1, minWidth: 0, gap: 1 },
  champs: { marginTop: espacements.lg, gap: espacements.sm },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  fond: { backgroundColor: colors.fond },
}));
