import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  avancementProjet,
  jalonFait,
  LIBELLES_ETAT_PROJET,
  quand,
  type Partenaire,
  type Projet,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Texte } from '@/components/ui';
import { colors, espacements, rayons } from '@/design/theme';

interface Props {
  projet: Projet;
  partenaires: readonly Partenaire[];
  maintenant: string;
  onCocher: (jalonId: string) => void;
  onAjouterJalon: (titre: string, echeance?: string) => void;
  onArchiver: (archive: boolean) => void;
}

export function CarteProjet({
  projet,
  partenaires,
  maintenant,
  onCocher,
  onAjouterJalon,
  onArchiver,
}: Props) {
  const avancement = avancementProjet(projet, maintenant);
  const [deplie, setDeplie] = useState(false);
  const [titreJalon, setTitreJalon] = useState('');
  const [echeance, setEcheance] = useState('');

  const ajouter = () => {
    if (!titreJalon.trim()) return;
    onAjouterJalon(
      titreJalon,
      /^\d{4}-\d{2}-\d{2}$/.test(echeance) ? echeance : undefined,
    );
    setTitreJalon('');
    setEcheance('');
  };

  return (
    <Carte>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: deplie }}
        onPress={() => setDeplie((d) => !d)}
      >
        <Texte variante="titre">{projet.titre}</Texte>
        {projet.intention ? (
          <Texte variante="corpsDoux" style={styles.intention}>
            {projet.intention}
          </Texte>
        ) : null}

        <View style={styles.jauge}>
          <View style={styles.piste}>
            <View
              style={[styles.remplissage, { width: `${avancement.pourcentage}%` }]}
            />
          </View>
          <Texte variante="meta">
            {LIBELLES_ETAT_PROJET[avancement.etat]}
            {avancement.total > 0
              ? ` · ${avancement.faits} jalon${avancement.faits > 1 ? 's' : ''} sur ${avancement.total}`
              : ' · aucun jalon posé'}
          </Texte>
        </View>

        {avancement.prochainJalon && !deplie ? (
          <Texte variante="petit" style={styles.prochain}>
            Prochain : {avancement.prochainJalon.titre}
            {avancement.prochainJalon.echeance
              ? ` · ${quand(avancement.prochainJalon.echeance, maintenant)}`
              : ''}
          </Texte>
        ) : null}

        {avancement.enRetard.length > 0 && !deplie ? (
          <Texte variante="petit" style={styles.retard}>
            {avancement.enRetard.length} échéance
            {avancement.enRetard.length > 1 ? 's' : ''} dépassée
            {avancement.enRetard.length > 1 ? 's' : ''} — sans gravité, à revoir
            ensemble.
          </Texte>
        ) : null}
      </Pressable>

      {deplie ? (
        <View style={styles.corps}>
          {projet.jalons.length === 0 ? (
            <Texte variante="corpsDoux">
              Aucun jalon. Découper le projet en petites étapes le rend beaucoup
              plus facile à reprendre.
            </Texte>
          ) : (
            <View style={styles.jalons}>
              {projet.jalons.map((jalon) => {
                const fait = jalonFait(jalon);
                const auteur = partenaires.find((p) => p.id === jalon.faitPar);
                return (
                  <Pressable
                    key={jalon.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: fait }}
                    onPress={() => onCocher(jalon.id)}
                    style={styles.jalon}
                  >
                    <View style={[styles.case, fait && styles.caseCochee]}>
                      {fait ? (
                        <Feather name="check" size={14} color={colors.texteInverse} />
                      ) : null}
                    </View>
                    <View style={styles.jalonTexte}>
                      <Texte variante="corps" style={fait ? styles.faitTexte : undefined}>
                        {jalon.titre}
                      </Texte>
                      <Texte variante="meta">
                        {jalon.echeance ? quand(jalon.echeance, maintenant) : 'sans date'}
                        {fait && auteur ? ` · coché par ${auteur.prenom}` : ''}
                      </Texte>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.ajout}>
            <Champ
              etiquette="Nouveau jalon"
              value={titreJalon}
              onChangeText={setTitreJalon}
            />
            <Champ
              etiquette="Échéance (facultatif, AAAA-MM-JJ)"
              placeholder="2026-05-01"
              value={echeance}
              onChangeText={setEcheance}
              keyboardType="numbers-and-punctuation"
            />
            <Bouton
              libelle="Ajouter ce jalon"
              ton="secondaire"
              onPress={ajouter}
              disabled={!titreJalon.trim()}
            />
            <Bouton
              libelle={projet.archiveLe ? 'Sortir des archives' : 'Archiver ce projet'}
              ton="discret"
              onPress={() => onArchiver(!projet.archiveLe)}
            />
          </View>
        </View>
      ) : null}
    </Carte>
  );
}

const styles = StyleSheet.create({
  intention: { marginTop: espacements.xxs },
  jauge: { marginTop: espacements.md, gap: espacements.xs },
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
  prochain: { marginTop: espacements.sm },
  retard: { marginTop: espacements.xxs, color: colors.tendresse },
  corps: {
    marginTop: espacements.lg,
    paddingTop: espacements.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bordure,
    gap: espacements.lg,
  },
  jalons: { gap: espacements.md },
  jalon: { flexDirection: 'row', alignItems: 'flex-start', gap: espacements.sm },
  case: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  caseCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
  jalonTexte: { flex: 1, gap: espacements.xxs },
  faitTexte: { color: colors.texteDoux, textDecorationLine: 'line-through' },
  ajout: { gap: espacements.sm },
});
