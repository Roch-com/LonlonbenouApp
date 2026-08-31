import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { ModuleSensible, Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { Bouton, Carte, EnTete, Texte } from '@/components/ui';
import { EcranModale } from '@/components/chrome';
import { espacements, rayons } from '@/design/theme';
import { useAutre } from '../stores/sessionStore';
import { useSessionServeur } from '../stores/sessionServeurStore';
import { usePartagesServeur } from '../stores/partagesServeurStore';
import type { EtatPartageServeur } from '../api/partages.api';
import { LIBELLES_PARTAGE } from '../stores/sessionStore';

/**
 * Pôle ⑥ — écran de synthèse « qui voit quoi » (§8.18 du cahier).
 *
 * ## Pourquoi un écran dédié
 *
 * Les consentements se règlent module par module, dans l'écran où ils
 * servent — c'est le bon endroit pour décider. Mais personne ne peut répondre
 * à « qu'est-ce que l'autre voit de moi, en ce moment ? » en parcourant cinq
 * écrans de mémoire. Une app qui promet la réciprocité doit pouvoir montrer
 * l'état complet d'un seul regard, sinon la promesse n'est pas vérifiable.
 *
 * ## Ce qui est dit, et comment
 *
 * Trois états seulement, et chacun nomme **qui** peut agir : actif des deux
 * côtés, en attente de l'autre, ou éteint de mon côté. Le troisième est le
 * seul sur lequel on peut faire quelque chose ici — les deux autres ne
 * demandent rien à personne.
 *
 * Aucune formulation ne présente l'inaction de l'autre comme un manquement.
 * « En attente de Gaëlle » décrit un état ; « Gaëlle n'a pas activé » lui
 * dresse un procès-verbal.
 */
export function QuiVoitQuoiEcran() {
  const router = useRouter();
  const colors = useCouleurs();
  const autre = useAutre();

  const coupleId = useSessionServeur((e) => e.coupleId);
  const parModule = usePartagesServeur((e) => e.parModule);
  const charger = usePartagesServeur((e) => e.charger);

  useFocusEffect(
    useCallback(() => {
      if (coupleId) void charger(coupleId);
    }, [coupleId, charger]),
  );

  if (!coupleId) {
    return (
      <EcranModale section="Confidentialité">
        <EnTete titre="Qui voit quoi" />
        <Carte>
          <Texte variante="corpsDoux">
            Tant que vos comptes ne sont pas reliés, rien n’est partagé — il n’y a
            donc rien à récapituler ici.
          </Texte>
          <View style={styles.action}>
            <Bouton
              libelle="Relier nos comptes"
              onPress={() => router.push('/appairage')}
            />
          </View>
        </Carte>
      </EcranModale>
    );
  }

  const modules = Object.keys(LIBELLES_PARTAGE) as ModuleSensible[];

  return (
    <EcranModale section="Confidentialité">
      <EnTete
        titre="Qui voit quoi"
        sousTitre={`L’état complet de ce que ${autre.prenom} et vous partagez, en ce moment.`}
      />

      <Carte discrete>
        <Texte variante="petit">
          Un partage n’existe que si vous l’avez activé tous les deux. Il n’y a
          aucun réglage permettant de voir sans être vu.
        </Texte>
      </Carte>

      {modules.map((module) => (
        <LigneModule
          key={module}
          module={module}
          etat={parModule[module]}
          prenomAutre={autre.prenom}
          couleurs={colors}
        />
      ))}

      <Carte discrete>
        <Texte variante="surtitre">Le cycle ne figure pas ici</Texte>
        <Texte variante="petit" style={styles.mention}>
          Il ne se négocie pas à deux : la personne concernée choisit seule son
          niveau, et personne ne peut le régler à sa place. Ce réglage vit dans
          le module lui-même.
        </Texte>
        <View style={styles.action}>
          <Bouton
            libelle="Ouvrir le cycle"
            ton="discret"
            onPress={() => router.push('/cycle')}
          />
        </View>
      </Carte>

      <View style={styles.action}>
        <Bouton
          libelle="Modifier mes partages"
          ton="secondaire"
          onPress={() => router.push('/nous')}
        />
      </View>
    </EcranModale>
  );
}

function LigneModule({
  module,
  etat,
  prenomAutre,
  couleurs,
}: {
  module: ModuleSensible;
  etat?: EtatPartageServeur;
  prenomAutre: string;
  couleurs: Theme['colors'];
}) {
  const libelle = LIBELLES_PARTAGE[module];
  const lecture = decrire(etat, prenomAutre);

  return (
    <Carte>
      <View style={styles.entete}>
        <View style={styles.titre}>
          <Texte variante="corps">{libelle?.titre ?? module}</Texte>
          <Texte variante="petit">{libelle?.detail}</Texte>
        </View>
        <View
          style={[
            styles.pastille,
            { backgroundColor: lecture.actif ? couleurs.accent : couleurs.fondNuance },
          ]}
        >
          <Feather
            name={lecture.icone}
            size={14}
            color={lecture.actif ? couleurs.texteInverse : couleurs.texteDoux}
          />
        </View>
      </View>
      <Texte variante="meta" style={styles.etat}>
        {lecture.texte}
      </Texte>
    </Carte>
  );
}

/** Décrit l'état sans jamais désigner un responsable. */
function decrire(
  etat: EtatPartageServeur | undefined,
  prenomAutre: string,
): { actif: boolean; icone: 'eye' | 'clock' | 'eye-off'; texte: string } {
  if (!etat) {
    return { actif: false, icone: 'clock', texte: 'Lecture de l’état…' };
  }
  if (etat.actif) {
    return {
      actif: true,
      icone: 'eye',
      texte: `Visible par vous deux, dans les mêmes conditions.`,
    };
  }
  if (etat.monConsentement) {
    return {
      actif: false,
      icone: 'clock',
      texte: `Vous l’avez activé. Rien n’est visible tant que ${prenomAutre} ne l’a pas fait de son côté.`,
    };
  }
  if (etat.consentementDeLautre) {
    return {
      actif: false,
      icone: 'eye-off',
      texte: `${prenomAutre} l’a activé de son côté. À vous de voir, sans empressement.`,
    };
  }
  return {
    actif: false,
    icone: 'eye-off',
    texte: 'Éteint des deux côtés. Rien ne circule.',
  };
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  entete: { flexDirection: 'row', alignItems: 'flex-start', gap: espacements.md },
  titre: { flex: 1, minWidth: 0, gap: espacements.xxs },
  pastille: {
    width: 32,
    height: 32,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etat: { marginTop: espacements.sm },
  mention: { marginTop: espacements.xs },
  action: { marginTop: espacements.lg },
  fond: { backgroundColor: colors.fond },
}));
