import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useCouleurs } from '@/design/ThemeProvider';
import type { ModuleSensible } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import {
  usePartageServeur,
  usePartagesServeur,
} from '../stores/partagesServeurStore';
import { LIBELLES_PARTAGE } from '../stores/sessionStore';

interface Props {
  coupleId: string;
  module: ModuleSensible;
  prenomAutre: string;
  onChange?: (actif: boolean) => void;
}

/**
 * Consentement réciproque, arbitré par le serveur.
 *
 * On n'y bascule que **son propre** consentement ; celui de l'autre est
 * affiché en lecture, pour qu'on sache où en est le partage sans avoir à le
 * deviner — et sans pouvoir agir dessus.
 */
export function ConsentementServeur({
  coupleId,
  module,
  prenomAutre,
  onChange,
}: Props) {
  const colors = useCouleurs();
  // État partagé : le même consentement s'affiche ailleurs, et basculer ici
  // doit s'y voir sans recharger l'écran.
  const etat = usePartageServeur(module);
  const erreur = usePartagesServeur((e) => e.erreur);
  const charger = usePartagesServeur((e) => e.charger);
  const basculerServeur = usePartagesServeur((e) => e.basculer);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    void charger(coupleId);
  }, [charger, coupleId]);

  const basculer = async (actif: boolean) => {
    setEnCours(true);
    try {
      if (await basculerServeur(coupleId, module, actif)) onChange?.(actif);
    } finally {
      setEnCours(false);
    }
  };

  const libelle = LIBELLES_PARTAGE[module];

  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <View style={styles.texte}>
          <Texte variante="corps">{libelle?.titre ?? module}</Texte>
          <Texte variante="petit">{libelle?.detail}</Texte>
        </View>
        <Switch
          value={!!etat?.monConsentement}
          disabled={enCours || !etat}
          onValueChange={(v) => void basculer(v)}
          trackColor={{ true: colors.accentDoux, false: colors.fondNuance }}
          thumbColor={etat?.monConsentement ? colors.accent : undefined}
          accessibilityLabel={libelle?.titre ?? module}
        />
      </View>

      <Texte variante="meta" style={styles.etat}>
        {etat === undefined
          ? 'Lecture de l’état…'
          : etat.actif
            ? 'Partage actif des deux côtés, dans les mêmes conditions.'
            : etat.monConsentement
              ? `En attente de ${prenomAutre}. Rien n’est visible tant qu’il n’a pas activé de son côté.`
              : etat.consentementDeLautre
                ? `${prenomAutre} a activé de son côté. À vous de voir, sans empressement.`
                : 'Aucun des deux n’a activé ce partage.'}
      </Texte>

      {erreur ? (
        <Texte variante="meta" style={styles.erreur}>
          {erreur}
        </Texte>
      ) : null}
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  bloc: { gap: espacements.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  texte: { flex: 1, gap: espacements.xxs },
  etat: { marginTop: espacements.xxs },
  erreur: { color: colors.tendresse },
}));
