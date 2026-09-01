import { useState } from 'react';
import { View } from 'react-native';
import {
  definitionDevise,
  definitionPeriodicite,
  montantLisible,
  PERIODICITES,
  prochaineEcheance,
  type Facture,
  type Periodicite,
  type Theme,
} from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { Bouton, Carte, Champ, ChampDate, Puce, Texte } from '@/components/ui';
import { espacements } from '@/design/theme';
import { dateLongue } from '@/lib/temps';
import { useFinances, useFacturesLisibles } from '../stores/financesStore';

interface Props {
  coupleId: string;
  partenaireId: string;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Pôle ③ — factures communes récurrentes (§8.11).
 *
 * ## Une facture s’arrête, elle ne se supprime pas
 *
 * Des dépenses passées y renvoient : l’effacer les rendrait orphelines.
 * L’historique d’un couple n’a pas à se trouer parce qu’un abonnement s’est
 * terminé.
 *
 * ## Ce que la notification ne dira pas
 *
 * Le nom de la facture. Le serveur ne l’a jamais lue — le libellé et le
 * montant sont scellés sur les téléphones. Le rappel dit qu’une échéance
 * approche ; cet écran dit laquelle.
 */
export function SectionFactures({ coupleId, partenaireId }: Props) {
  const reglages = useFinances((e) => e.reglages);
  const ajouterFacture = useFinances((e) => e.ajouterFacture);
  const arreterFacture = useFinances((e) => e.arreterFacture);
  const factures = useFacturesLisibles();

  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [echeance, setEcheance] = useState(aujourdhui());
  const [periodicite, setPeriodicite] = useState<Periodicite>('mensuelle');

  const devise = definitionDevise(reglages.devise);
  const jour = aujourdhui();

  const actives = factures.filter((f) => !f.arreteeLe);
  const arretees = factures.filter((f) => f.arreteeLe);

  const valider = () => {
    const valeur = Math.round(
      Number(montant.replace(',', '.')) * 10 ** devise.decimales,
    );
    if (!libelle.trim() || !Number.isFinite(valeur) || valeur <= 0) return;

    void ajouterFacture(coupleId, partenaireId, echeance, periodicite, {
      libelle: libelle.trim(),
      montant: valeur,
    });
    setLibelle('');
    setMontant('');
    setOuvert(false);
  };

  return (
    <Carte>
      <Texte variante="surtitre">Nos factures communes</Texte>

      {actives.length === 0 && arretees.length === 0 ? (
        <Texte variante="corpsDoux" style={styles.intro}>
          Le loyer, l’électricité, un abonnement partagé. Vous serez prévenus
          tous les deux quelques jours avant l’échéance.
        </Texte>
      ) : null}

      {actives.map((facture) => (
        <LigneFacture
          key={facture.id}
          facture={facture}
          jour={jour}
          devise={reglages.devise}
          onArreter={() => void arreterFacture(coupleId, partenaireId, facture.id)}
        />
      ))}

      {arretees.length > 0 ? (
        <View style={styles.arretees}>
          <Texte variante="meta">Arrêtées</Texte>
          {arretees.map((facture) => (
            <Texte key={facture.id} variante="petit">
              {facture.contenu.libelle}
            </Texte>
          ))}
        </View>
      ) : null}

      {ouvert ? (
        <View style={styles.champs}>
          <Champ
            etiquette="Ce que c’est"
            value={libelle}
            onChangeText={setLibelle}
            placeholder="Loyer, électricité…"
          />
          <Champ
            etiquette={`Montant (${devise.symbole})`}
            value={montant}
            onChangeText={setMontant}
            keyboardType="numeric"
          />
          <ChampDate
            etiquette="Prochaine échéance"
            valeur={echeance}
            onChanger={setEcheance}
          />
          <View style={styles.puces}>
            {PERIODICITES.map((p) => (
              <Puce
                key={p.code}
                libelle={p.libelle}
                active={periodicite === p.code}
                onPress={() => setPeriodicite(p.code)}
              />
            ))}
          </View>
          <Bouton libelle="Enregistrer" onPress={valider} />
          <Bouton
            libelle="Annuler"
            ton="discret"
            onPress={() => setOuvert(false)}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Bouton
            libelle="Ajouter une facture"
            ton="discret"
            onPress={() => setOuvert(true)}
          />
        </View>
      )}
    </Carte>
  );
}

function LigneFacture({
  facture,
  jour,
  devise,
  onArreter,
}: {
  facture: Facture;
  jour: string;
  devise: string;
  onArreter: () => void;
}) {
  const suivante = prochaineEcheance(facture, jour);

  return (
    <View style={styles.facture}>
      <View style={styles.ligne}>
        <View style={styles.ligneTexte}>
          <Texte variante="corps">{facture.contenu.libelle}</Texte>
          <Texte variante="meta">
            {montantLisible(facture.contenu.montant, definitionDevise(devise))} ·{' '}
            {definitionPeriodicite(facture.periodicite).libelle.toLowerCase()}
          </Texte>
          {suivante ? (
            <Texte variante="petit">
              Prochaine échéance le {dateLongue(suivante)}
            </Texte>
          ) : null}
        </View>
        <Bouton libelle="Arrêter" ton="discret" onPress={onArreter} />
      </View>
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  intro: { marginTop: espacements.xs },
  actions: { marginTop: espacements.md },
  champs: { gap: espacements.sm, marginTop: espacements.md },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espacements.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espacements.md },
  ligneTexte: { flex: 1, minWidth: 0, gap: espacements.xxs },
  facture: {
    marginTop: espacements.md,
    paddingBottom: espacements.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  arretees: { marginTop: espacements.md, gap: espacements.xxs },
}));
