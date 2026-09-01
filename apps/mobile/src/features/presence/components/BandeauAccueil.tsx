import { useMemo } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import {
  LIBELLES_BANDE,
  evenementsAVenir,
  prochaineEcheanceProjet,
  quand,
  scoreDuCouple,
} from '@lonlonbenu/shared';
import { Carte, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements } from '@/design/theme';
import { useGestes } from '@/features/croissance/hooks/useGestes';
import { useConfidencesNonLues } from '@/features/croissance/stores/confidencesStore';
import { useViePratique } from '@/features/vie-pratique/stores/viePratiqueStore';
import { useAutre, useMoi } from '@/features/reglages/stores/sessionStore';
import { useSessionServeur } from '@/features/reglages/stores/sessionServeurStore';
import { useMessagesNonLus } from '../stores/chatStore';
import { useFilLisible } from '../hooks/useLecturesDechiffrees';
import { CompteurCarte } from './CompteurCarte';
import { Carrousel, type Diapositive } from './Carrousel';

/**
 * Bandeau d'accueil : le compteur, puis ce qui mérite d'être vu aujourd'hui.
 *
 * ## Ce qui décide de l'ordre
 *
 * Le compteur vient toujours en premier — c'est l'identité du couple, pas une
 * information passagère. Les suivantes sont classées par ce qu'elles demandent
 * d'attention : ce qui attend une réponse avant ce qui se contemple.
 *
 * ## Ce qui décide de la présence
 *
 * **Une carte sans contenu n'apparaît pas.** Un « Aujourd'hui : rien de prévu »
 * qui défile chaque jour n'informe de rien et dilue les cartes qui, elles,
 * disent quelque chose. Seul le compteur est inconditionnel.
 */
export function BandeauAccueil() {
  const moi = useMoi();
  const autre = useAutre();
  const partenaireId = useSessionServeur((e) => e.partenaireId);
  const partenaires = useSessionServeur((e) => e.partenaires);

  const nonLus = useMessagesNonLus(partenaireId ?? '');
  const confidencesNonLues = useConfidencesNonLues(moi.id);
  const evenements = useViePratique((e) => e.evenements);
  const projets = useViePratique((e) => e.projets);
  const fil = useFilLisible();
  const gestes = useGestes();

  const maintenant = new Date().toISOString();

  const aVenir = useMemo(
    () => evenementsAVenir(evenements, maintenant).slice(0, 2),
    [evenements, maintenant],
  );

  // §8.1 demande « la prochaine échéance de projet » sur l'accueil : l'agenda
  // seul ne la portait pas, un jalon n'étant pas un événement de calendrier.
  const echeance = useMemo(
    () => prochaineEcheanceProjet(projets),
    [projets],
  );

  // §8.1 demande aussi « la dernière note douce reçue ». On ne montre que
  // celles de l'autre : relire les siennes n'a jamais fait plaisir à personne.
  const noteRecue = useMemo(
    () =>
      [...fil]
        .reverse()
        .find(
          (m) =>
            m.type === 'note_douce' && m.auteurId !== partenaireId && !m.illisible,
        ),
    [fil, partenaireId],
  );

  const score = useMemo(() => {
    // Le serveur fait autorité, mais il peut ne pas avoir encore répondu ;
    // sans repli, la carte disparaissait et il ne restait qu'une diapositive —
    // un carrousel d'un seul élément ne défile pas et paraît cassé.
    const ids = partenaires?.map((p) => p.id) ?? [moi.id, autre.id];
    if (ids.length !== 2) return undefined;
    return scoreDuCouple(gestes, [ids[0]!, ids[1]!], maintenant);
  }, [gestes, partenaires, moi.id, autre.id, maintenant]);

  const diapositives: Diapositive[] = [
    { cle: 'compteur', contenu: <CompteurCarte enAvant /> },
  ];

  if (aVenir.length > 0) {
    diapositives.push({
      cle: 'agenda',
      contenu: (
        <Carte>
          <Texte variante="surtitre">Ce qui arrive</Texte>
          <View style={styles.liste}>
            {aVenir.map((e) => (
              <View key={e.id} style={styles.ligne}>
                <Texte variante="corps" numberOfLines={2}>
                  {e.titre}
                </Texte>
                <Texte variante="meta">{quand(e.debut, maintenant)}</Texte>
              </View>
            ))}
          </View>
        </Carte>
      ),
    });
  }

  if (noteRecue) {
    diapositives.push({
      cle: 'note',
      contenu: (
        <Carte>
          <Texte variante="surtitre">Un mot de {autre.prenom}</Texte>
          <Texte variante="titre" style={styles.titre}>
            « {noteRecue.texte} »
          </Texte>
          <Texte variante="meta">{quand(noteRecue.envoyeLe, maintenant)}</Texte>
        </Carte>
      ),
    });
  }

  if (echeance) {
    diapositives.push({
      cle: 'echeance',
      contenu: (
        <Carte>
          <Texte variante="surtitre">Prochaine échéance</Texte>
          <Texte variante="titre" style={styles.titre}>
            {echeance.jalon.titre}
          </Texte>
          <Texte variante="corpsDoux">
            {echeance.projetTitre} · {quand(echeance.jalon.echeance!, maintenant)}
          </Texte>
        </Carte>
      ),
    });
  }

  const enAttente = nonLus + confidencesNonLues;
  if (enAttente > 0) {
    diapositives.push({
      cle: 'attente',
      contenu: (
        <Carte>
          <Texte variante="surtitre">Ce qui vous attend</Texte>
          <Texte variante="titre" style={styles.titre}>
            {enAttente} chose{enAttente > 1 ? 's' : ''} à lire
          </Texte>
          <Texte variante="corpsDoux">
            {[
              nonLus > 0
                ? `${nonLus} message${nonLus > 1 ? 's' : ''} de ${autre.prenom}`
                : undefined,
              confidencesNonLues > 0
                ? `${confidencesNonLues} confidence${confidencesNonLues > 1 ? 's' : ''}`
                : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Texte>
        </Carte>
      ),
    });
  }

  if (score) {
    diapositives.push({
      cle: 'elan',
      contenu: (
        <Carte>
          <Texte variante="surtitre">Votre élan</Texte>
          <Texte variante="titre" style={styles.titre}>
            {LIBELLES_BANDE[score.bande]}
          </Texte>
          <Texte variante="corpsDoux">
            {score.joursVivants} jour{score.joursVivants > 1 ? 's' : ''} vivants sur
            les {score.fenetreJours} derniers. C’est une mesure de l’activité, pas
            une note de l’un ou de l’autre.
          </Texte>
        </Carte>
      ),
    });
  }

  // Une dernière carte, sans condition : elle rappelle ce que l'app promet, et
  // garantit qu'il y a toujours au moins deux diapositives — un carrousel qui
  // n'en a qu'une ne défile pas, et se lit comme une panne.
  diapositives.push({
    cle: 'promesse',
    contenu: (
      <Carte>
        <Texte variante="surtitre">Entre vous deux</Texte>
        <Texte variante="titre" style={styles.titre}>
          Rien ne se voit à sens unique
        </Texte>
        <Texte variante="corpsDoux">
          Ce que {autre.prenom} voit de vous, vous le voyez de {autre.prenom}.
          Chaque partage s’active à deux et se coupe d’un seul côté.
        </Texte>
      </Carte>
    ),
  });

  return <Carrousel diapositives={diapositives} />;
}

const styles = stylesDynamiques((_theme: Theme) => ({
  liste: { marginTop: espacements.md, gap: espacements.md },
  ligne: { gap: espacements.xxs },
  titre: { marginTop: espacements.xxs, marginBottom: espacements.xxs },
}));
