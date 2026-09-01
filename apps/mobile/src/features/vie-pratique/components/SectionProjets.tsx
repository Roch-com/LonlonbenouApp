import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CATEGORIES_PROJET,
  PROJETS_SUGGERES,
  trierProjets,
  type CategorieProjet,
} from '@lonlonbenu/shared';
import { Bouton, Carte, Champ, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { useSession } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { CarteProjet } from './CarteProjet';
import { useViePratique } from '../stores/viePratiqueStore';

/** Pôle ③ — Projets de couple (P0 : création, jalons, avancement). */
export function SectionProjets() {
  const coupleId = useSessionServeur((e) => e.coupleId);
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const couple = useSession((e) => e.couple);
  const projets = useViePratique((e) => e.projets);
  const creerProjet = useViePratique((e) => e.creerProjet);
  const ajouterJalon = useViePratique((e) => e.ajouterJalon);
  const cocherJalon = useViePratique((e) => e.cocherJalon);
  const archiverProjet = useViePratique((e) => e.archiverProjet);

  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [intention, setIntention] = useState('');
  const [categorie, setCategorie] = useState<CategorieProjet>();

  const maintenant = new Date().toISOString();
  const tries = trierProjets(projets, maintenant);

  const valider = () => {
    if (!titre.trim()) return;
    void creerProjet(coupleId!, partenaireId!, titre, intention, categorie);
    setTitre('');
    setIntention('');
    setCategorie(undefined);
    setOuvert(false);
  };

  return (
    <View style={styles.section}>
      {ouvert ? (
        <Carte>
          <Texte variante="surtitre">Nouveau projet</Texte>
          <View style={styles.puces}>
            {PROJETS_SUGGERES.map((suggestion) => (
              <Puce
                key={suggestion.titre}
                libelle={suggestion.titre}
                active={titre === suggestion.titre}
                onPress={() => {
                  setTitre(suggestion.titre);
                  setIntention(suggestion.intention);
                }}
              />
            ))}
          </View>
          <View style={styles.champs}>
            <Champ etiquette="Le projet" value={titre} onChangeText={setTitre} />

            {/* §8.10 : « titre, catégorie ». Facultative — un projet mal rangé
                ne se retrouve pas mieux qu'un projet non rangé. */}
            <Texte variante="meta">Ranger dans (facultatif) :</Texte>
            <View style={styles.puces}>
              {CATEGORIES_PROJET.map((c) => (
                <Puce
                  key={c.code}
                  libelle={c.libelle}
                  emoji={c.emoji}
                  active={categorie === c.code}
                  onPress={() =>
                    setCategorie((actuelle) =>
                      actuelle === c.code ? undefined : c.code,
                    )
                  }
                />
              ))}
            </View>
            <Champ
              etiquette="Pourquoi il compte (facultatif)"
              placeholder="Ce que vous en attendez, pour vous y remettre plus tard."
              value={intention}
              onChangeText={setIntention}
              multiline
            />
            <Bouton
              libelle="Créer le projet"
              onPress={valider}
              disabled={!titre.trim()}
            />
            <Bouton
              libelle="Annuler"
              ton="discret"
              onPress={() => setOuvert(false)}
            />
          </View>
        </Carte>
      ) : (
        <Bouton libelle="Ouvrir un projet" onPress={() => setOuvert(true)} />
      )}

      {tries.length === 0 ? (
        <Carte discrete>
          <Texte variante="corpsDoux">
            Aucun projet pour l’instant. Un projet, c’est simplement quelque chose
            que vous voulez faire arriver à deux.
          </Texte>
        </Carte>
      ) : (
        tries.map((projet) => (
          <CarteProjet
            key={projet.id}
            projet={projet}
            partenaires={couple.partenaires}
            maintenant={maintenant}
            onCocher={(jalonId) =>
              void cocherJalon(coupleId!, partenaireId!, projet.id, jalonId)
            }
            onAjouterJalon={(titreJalon, echeance, assigneA) =>
              void ajouterJalon(
                coupleId!,
                partenaireId!,
                projet.id,
                titreJalon,
                echeance,
                assigneA,
              )
            }
            onArchiver={(archive) =>
              void archiverProjet(coupleId!, partenaireId!, projet.id, archive)
            }
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: espacements.md },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacements.xs,
    marginTop: espacements.sm,
  },
  champs: { gap: espacements.sm, marginTop: espacements.md },
});
