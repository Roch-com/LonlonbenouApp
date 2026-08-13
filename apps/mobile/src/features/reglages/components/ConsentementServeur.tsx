import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { ModuleSensible } from '@lonlonbenu/shared';
import { Texte } from '@/components/ui';
import { colors, espacements } from '@/design/theme';
import { messageLisible } from '@/lib/api/erreurs';
import {
  basculerPartageServeur,
  listerPartages,
  type EtatPartageServeur,
} from '../api/partages.api';
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
  const [etat, setEtat] = useState<EtatPartageServeur>();
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    try {
      const partages = await listerPartages(coupleId);
      setEtat(partages.find((p) => p.module === module));
      setErreur(undefined);
    } catch (cause) {
      setErreur(messageLisible(cause));
    }
  }, [coupleId, module]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const basculer = async (actif: boolean) => {
    setEnCours(true);
    setErreur(undefined);
    try {
      const misAJour = await basculerPartageServeur(coupleId, module, actif);
      setEtat(misAJour);
      onChange?.(misAJour.actif);
    } catch (cause) {
      setErreur(messageLisible(cause));
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

const styles = StyleSheet.create({
  bloc: { gap: espacements.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  texte: { flex: 1, gap: espacements.xxs },
  etat: { marginTop: espacements.xxs },
  erreur: { color: colors.tendresse },
});
