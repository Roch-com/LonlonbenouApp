import { Switch, View } from 'react-native';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import { accesDe, type ModuleSensible, type RaisonAcces } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import {
  LIBELLES_PARTAGE,
  useAutre,
  useMoi,
  usePartage,
  useSession,
} from '../stores/sessionStore';

interface Props {
  module: ModuleSensible;
  /** Masque le titre quand le contexte l'a déjà donné. */
  sansTitre?: boolean;
}

/**
 * Interrupteur de consentement, identique pour tous les modules sensibles.
 * Il n'écrit jamais le booléen directement : il passe par `basculerPartage`,
 * qui émet les deux notifications.
 */
export function ReglagePartage({ module, sansTitre }: Props) {
  const colors = useCouleurs();
  const moi = useMoi();
  const autre = useAutre();
  const partage = usePartage(module);
  const basculerPartage = useSession((e) => e.basculerPartage);

  if (!partage) return null;

  const monConsentement = partage.consentements.find(
    (c) => c.partenaireId === moi.id,
  );
  const acces = accesDe(partage, moi.id);
  const libelle = LIBELLES_PARTAGE[module];

  return (
    <View style={styles.bloc}>
      {!sansTitre && libelle ? (
        <Texte variante="surtitre">{libelle.titre}</Texte>
      ) : null}

      <View style={styles.ligne}>
        <View style={styles.texte}>
          <Texte variante="corps">Activer de mon côté</Texte>
          <Texte variante="petit">{explication(acces.raison, autre.prenom)}</Texte>
        </View>
        <Switch
          value={!!monConsentement?.actif}
          onValueChange={(v) => basculerPartage(module, v)}
          trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
          thumbColor={monConsentement?.actif ? colors.accent : undefined}
          accessibilityLabel={libelle?.titre ?? module}
        />
      </View>

      {libelle ? <Texte variante="meta">{libelle.detail}</Texte> : null}
    </View>
  );
}

export function explication(raison: RaisonAcces, prenomAutre: string): string {
  switch (raison) {
    case 'partage_actif':
      return 'Actif des deux côtés, dans les mêmes conditions.';
    case 'en_pause_de_mon_cote':
      return `En pause de votre côté. ${prenomAutre} ne voit rien, vous non plus.`;
    case 'en_pause_cote_partenaire':
      return `${prenomAutre} l’a mis en pause. C’est coupé pour vous deux.`;
    default:
      return 'Pas encore activé.';
  }
}

const styles = stylesDynamiques(() => ({
  bloc: { gap: espacements.sm },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  texte: { flex: 1, gap: espacements.xxs },
}));
