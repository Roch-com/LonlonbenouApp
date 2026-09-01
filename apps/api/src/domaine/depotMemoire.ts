/**
 * Adaptateur en mémoire.
 *
 * Sert aux tests et au développement local. L'adaptateur PostgreSQL reste à
 * écrire (voir `src/db/migrations/001_socle.sql`, qui décrit les tables attendues) : ce qui
 * compte à ce stade, c'est que la logique des quatre exigences soit vérifiable
 * sans base de données, donc vérifiable en intégration continue.
 */

import {
  PREFERENCES_PAR_DEFAUT,
  type ActiviteBrute,
  type AxeCroissance,
  type SouvenirScelle,
  type Confidence,
  type Evenement,
  type Initiative,
  type Projet,
  type FactureScellee,
  type ParcoursEngage,
  type PartageCycle,
  type ReponsesLangages,
  type PartenaireId,
  type Regles,
  type Symptome,
} from '@lonlonbenu/shared';
import type {
  AlerteServeur,
  Appareil,
  CheckInServeur,
  CoupleServeur,
  Depot,
  InvitationServeur,
  BudgetProjetScelle,
  DepenseScellee,
  MessageScelle,
  ReponseCompliciteServeur,
  NotificationServeur,
  ReglagesFinancesServeur,
  PositionServeur,
  StatutServeur,
} from './depot.ts';

export function creerDepotMemoire(): Depot {
  const couples = new Map<string, CoupleServeur>();
  const axes = new Map<string, AxeCroissance[]>();
  const invitations = new Map<string, InvitationServeur>();
  const preferences = new Map<PartenaireId, typeof PREFERENCES_PAR_DEFAUT>();
  const notifications: NotificationServeur[] = [];
  const appareils: Appareil[] = [];
  const partagesCycle = new Map<string, PartageCycle>();
  const regles = new Map<string, Regles[]>();
  const symptomes = new Map<string, Symptome[]>();
  const confidences = new Map<string, Confidence[]>();
  const evenements = new Map<string, Evenement[]>();
  const projets = new Map<string, Projet[]>();
  const initiatives = new Map<string, Initiative[]>();
  const rappelsEmis = new Map<string, string[]>();
  const clesPubliques = new Map<string, string>();
  const messages = new Map<string, MessageScelle[]>();
  const activite = new Map<string, ActiviteBrute[]>();
  const souvenirs = new Map<string, SouvenirScelle[]>();
  const depenses = new Map<string, DepenseScellee[]>();
  const complicite = new Map<string, ReponseCompliciteServeur[]>();
  const parcours = new Map<string, ParcoursEngage[]>();
  const langages = new Map<string, ReponsesLangages[]>();
  const factures = new Map<string, FactureScellee[]>();
  const budgets = new Map<string, BudgetProjetScelle[]>();
  const reglagesFinances = new Map<string, ReglagesFinancesServeur>();
  const positions = new Map<string, PositionServeur[]>();
  const statuts = new Map<string, StatutServeur[]>();
  const checkIns = new Map<string, CheckInServeur[]>();
  const alertes = new Map<string, AlerteServeur[]>();

  const copie = <T>(valeur: T): T => structuredClone(valeur);

  return {
    couples: {
      async parId(coupleId) {
        const trouve = couples.get(coupleId);
        return trouve ? copie(trouve) : undefined;
      },
      async parPartenaire(partenaireId) {
        for (const couple of couples.values()) {
          if (couple.couple.partenaires.some((p) => p.id === partenaireId)) {
            return copie(couple);
          }
        }
        return undefined;
      },
      async actifs() {
        return copie([...couples.values()].filter((c) => !c.dissocieLe));
      },
      async enregistrer(couple) {
        couples.set(couple.id, copie(couple));
      },
    },

    axes: {
      async parCouple(coupleId) {
        return copie(axes.get(coupleId) ?? []);
      },
      async parId(coupleId, axeId) {
        const trouve = (axes.get(coupleId) ?? []).find((a) => a.id === axeId);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(coupleId, axe) {
        const liste = axes.get(coupleId) ?? [];
        const index = liste.findIndex((a) => a.id === axe.id);
        if (index >= 0) liste[index] = copie(axe);
        else liste.push(copie(axe));
        axes.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        axes.delete(coupleId);
      },
    },

    invitations: {
      async parId(id) {
        const trouve = invitations.get(id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(entree) {
        invitations.set(entree.id, copie(entree));
      },
    },

    notifications: {
      async preferences(partenaireId) {
        return copie(preferences.get(partenaireId) ?? PREFERENCES_PAR_DEFAUT);
      },
      async definirPreferences(partenaireId, valeur) {
        preferences.set(partenaireId, copie(valeur));
      },
      async ajouter(notification) {
        notifications.push(copie(notification));
      },
      async enAttente(partenaireId) {
        return copie(
          notifications
            .filter(
              (n) =>
                n.destinataireId === partenaireId &&
                !n.expedieeLe &&
                n.remise !== 'ignoree',
            )
            .sort((a, b) => a.emiseLe.localeCompare(b.emiseLe)),
        );
      },
      async marquerExpediees(ids, quand) {
        const aMarquer = new Set(ids);
        for (const notification of notifications) {
          if (aMarquer.has(notification.id)) notification.expedieeLe = quand;
        }
      },
      async journal(partenaireId) {
        return copie(
          notifications
            .filter((n) => n.destinataireId === partenaireId)
            .sort((a, b) => b.emiseLe.localeCompare(a.emiseLe)),
        );
      },
    },

    viePratique: {
      async evenements(coupleId) {
        return copie(evenements.get(coupleId) ?? []);
      },
      async enregistrerEvenement(coupleId, evenement) {
        const liste = (evenements.get(coupleId) ?? []).filter(
          (e) => e.id !== evenement.id,
        );
        liste.push(copie(evenement));
        evenements.set(coupleId, liste);
      },
      async supprimerEvenement(coupleId, id) {
        evenements.set(
          coupleId,
          (evenements.get(coupleId) ?? []).filter((e) => e.id !== id),
        );
      },
      async projets(coupleId) {
        return copie(projets.get(coupleId) ?? []);
      },
      async projetParId(coupleId, id) {
        const trouve = (projets.get(coupleId) ?? []).find((p) => p.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrerProjet(coupleId, projet) {
        const liste = (projets.get(coupleId) ?? []).filter(
          (p) => p.id !== projet.id,
        );
        liste.push(copie(projet));
        projets.set(coupleId, liste);
      },
      async initiatives(coupleId) {
        return copie(initiatives.get(coupleId) ?? []);
      },
      async initiativeParId(coupleId, id) {
        const trouve = (initiatives.get(coupleId) ?? []).find((i) => i.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrerInitiative(coupleId, initiative) {
        const liste = (initiatives.get(coupleId) ?? []).filter(
          (i) => i.id !== initiative.id,
        );
        liste.push(copie(initiative));
        initiatives.set(coupleId, liste);
      },
      async supprimerInitiative(coupleId, id) {
        initiatives.set(
          coupleId,
          (initiatives.get(coupleId) ?? []).filter((i) => i.id !== id),
        );
      },
      async rappelsEmis(coupleId) {
        return copie(rappelsEmis.get(coupleId) ?? []);
      },
      async noterRappelsEmis(coupleId, cles) {
        rappelsEmis.set(coupleId, [...(rappelsEmis.get(coupleId) ?? []), ...cles]);
      },
      async effacerPourCouple(coupleId) {
        evenements.delete(coupleId);
        projets.delete(coupleId);
        initiatives.delete(coupleId);
        rappelsEmis.delete(coupleId);
      },
    },

    chat: {
      async clePublique(partenaireId) {
        return clesPubliques.get(partenaireId);
      },
      async definirClePublique(partenaireId, cle) {
        clesPubliques.set(partenaireId, cle);
      },
      async messages(coupleId) {
        return copie(
          (messages.get(coupleId) ?? []).sort((a, b) =>
            a.envoyeLe.localeCompare(b.envoyeLe),
          ),
        );
      },
      async ajouter(coupleId, message) {
        const liste = messages.get(coupleId) ?? [];
        liste.push(copie(message));
        messages.set(coupleId, liste);
      },
      async supprimer(coupleId, id) {
        messages.set(
          coupleId,
          (messages.get(coupleId) ?? []).filter((m) => m.id !== id),
        );
      },
      async marquerLus(coupleId, lecteurId, quand) {
        for (const m of messages.get(coupleId) ?? []) {
          if (m.auteurId !== lecteurId && !m.luLe) m.luLe = quand;
        }
      },
      async effacerPourCouple(coupleId) {
        messages.delete(coupleId);
      },
    },

    activite: {
      async parCouple(coupleId) {
        return copie(activite.get(coupleId) ?? []);
      },
      async signaler(coupleId, brute) {
        // Écrasement pur : une seule ligne par personne, aucun historique.
        const liste = (activite.get(coupleId) ?? []).filter(
          (a) => a.partenaireId !== brute.partenaireId,
        );
        liste.push(copie(brute));
        activite.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        activite.delete(coupleId);
      },
    },

    complicite: {
      async reponses(coupleId, jour) {
        return copie(
          (complicite.get(coupleId) ?? []).filter((r) => r.jour === jour),
        );
      },
      async repondre(coupleId, reponse) {
        // Une seule réponse par personne et par jour : répondre à nouveau
        // remplace, plutôt que d'empiler des versions successives.
        const liste = (complicite.get(coupleId) ?? []).filter(
          (r) => !(r.jour === reponse.jour && r.partenaireId === reponse.partenaireId),
        );
        liste.push(copie(reponse));
        complicite.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        complicite.delete(coupleId);
      },
    },

    connexion: {
      async langages(coupleId) {
        return copie(langages.get(coupleId) ?? []);
      },
      async definirLangages(coupleId, reponses) {
        const liste = (langages.get(coupleId) ?? []).filter(
          (r) => r.partenaireId !== reponses.partenaireId,
        );
        liste.push(copie(reponses));
        langages.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        langages.delete(coupleId);
      },
    },

    parcours: {
      async engages(coupleId) {
        return copie(parcours.get(coupleId) ?? []);
      },
      async parId(coupleId, parcoursId) {
        const trouve = (parcours.get(coupleId) ?? []).find(
          (e) => e.parcoursId === parcoursId,
        );
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(coupleId, engage) {
        const liste = (parcours.get(coupleId) ?? []).filter(
          (e) => e.parcoursId !== engage.parcoursId,
        );
        liste.push(copie(engage));
        parcours.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        parcours.delete(coupleId);
      },
    },

    finances: {
      async reglages(coupleId) {
        const trouve = reglagesFinances.get(coupleId);
        return trouve ? copie(trouve) : undefined;
      },
      async definirReglages(coupleId, reglages) {
        reglagesFinances.set(coupleId, copie(reglages));
      },
      async depenses(coupleId) {
        return copie(depenses.get(coupleId) ?? []);
      },
      async depenseParId(coupleId, id) {
        const trouve = (depenses.get(coupleId) ?? []).find((d) => d.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrerDepense(coupleId, depense) {
        const liste = (depenses.get(coupleId) ?? []).filter(
          (d) => d.id !== depense.id,
        );
        liste.push(copie(depense));
        depenses.set(coupleId, liste);
      },
      async supprimerDepense(coupleId, id) {
        depenses.set(
          coupleId,
          (depenses.get(coupleId) ?? []).filter((d) => d.id !== id),
        );
      },
      async factures(coupleId) {
        return copie(factures.get(coupleId) ?? []);
      },
      async factureParId(coupleId, id) {
        const trouve = (factures.get(coupleId) ?? []).find((f) => f.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrerFacture(coupleId, facture) {
        const liste = (factures.get(coupleId) ?? []).filter(
          (f) => f.id !== facture.id,
        );
        liste.push(copie(facture));
        factures.set(coupleId, liste);
      },
      async budgets(coupleId) {
        return copie(budgets.get(coupleId) ?? []);
      },
      async definirBudget(coupleId, budget) {
        const liste = (budgets.get(coupleId) ?? []).filter(
          (b) => b.projetId !== budget.projetId,
        );
        liste.push(copie(budget));
        budgets.set(coupleId, liste);
      },
      async supprimerBudget(coupleId, projetId) {
        budgets.set(
          coupleId,
          (budgets.get(coupleId) ?? []).filter((b) => b.projetId !== projetId),
        );
      },
      async effacerPourCouple(coupleId) {
        depenses.delete(coupleId);
        reglagesFinances.delete(coupleId);
        factures.delete(coupleId);
        budgets.delete(coupleId);
      },
    },

    souvenirs: {
      async parCouple(coupleId) {
        return copie(souvenirs.get(coupleId) ?? []);
      },
      async parId(coupleId, id) {
        const trouve = (souvenirs.get(coupleId) ?? []).find((s) => s.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(coupleId, souvenir) {
        const liste = (souvenirs.get(coupleId) ?? []).filter(
          (s) => s.id !== souvenir.id,
        );
        liste.push(copie(souvenir));
        souvenirs.set(coupleId, liste);
      },
      async supprimer(coupleId, id) {
        souvenirs.set(
          coupleId,
          (souvenirs.get(coupleId) ?? []).filter((s) => s.id !== id),
        );
      },
      async effacerPourCouple(coupleId) {
        souvenirs.delete(coupleId);
      },
    },

    presence: {
      async statuts(coupleId) {
        return copie(statuts.get(coupleId) ?? []);
      },
      async positions(coupleId) {
        return copie(positions.get(coupleId) ?? []);
      },
      async definirPosition(coupleId, position) {
        // Écrasement : une seule ligne par personne, aucun historique.
        const liste = (positions.get(coupleId) ?? []).filter(
          (p) => p.partenaireId !== position.partenaireId,
        );
        liste.push(copie(position));
        positions.set(coupleId, liste);
      },
      async definirStatut(coupleId, statut) {
        const liste = statuts.get(coupleId) ?? [];
        const ancien = liste.find((s) => s.partenaireId === statut.partenaireId);
        const fusionne = { ...(ancien ?? {}), ...copie(statut) };
        statuts.set(coupleId, [
          ...liste.filter((s) => s.partenaireId !== statut.partenaireId),
          fusionne,
        ]);
      },
      async definirHumeur(coupleId, partenaireId, code, motScelle, quand) {
        const liste = statuts.get(coupleId) ?? [];
        const existant = liste.find((s) => s.partenaireId === partenaireId);
        if (existant) {
          existant.humeurCode = code;
          existant.motHumeurScelle = motScelle;
          existant.humeurMajLe = quand;
        } else {
          liste.push({
            partenaireId,
            code: 'disponible',
            majLe: quand,
            humeurCode: code,
            motHumeurScelle: motScelle,
            humeurMajLe: quand,
          });
        }
        statuts.set(coupleId, liste);
      },
      async checkIns(coupleId) {
        return copie(
          (checkIns.get(coupleId) ?? []).sort((a, b) =>
            b.faitLe.localeCompare(a.faitLe),
          ),
        );
      },
      async ajouterCheckIn(coupleId, checkIn) {
        const liste = checkIns.get(coupleId) ?? [];
        liste.push(copie(checkIn));
        checkIns.set(coupleId, liste);
      },
      async alertes(coupleId) {
        return copie(
          (alertes.get(coupleId) ?? []).sort((a, b) =>
            b.emiseLe.localeCompare(a.emiseLe),
          ),
        );
      },
      async enregistrerAlerte(coupleId, alerte) {
        const liste = (alertes.get(coupleId) ?? []).filter(
          (a) => a.id !== alerte.id,
        );
        liste.push(copie(alerte));
        alertes.set(coupleId, liste);
      },
      async alerteParId(coupleId, id) {
        const trouve = (alertes.get(coupleId) ?? []).find((a) => a.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async effacerPourCouple(coupleId) {
        positions.delete(coupleId);
        statuts.delete(coupleId);
        checkIns.delete(coupleId);
        alertes.delete(coupleId);
      },
    },

    confidences: {
      async parCouple(coupleId) {
        return copie(
          (confidences.get(coupleId) ?? []).sort((a, b) =>
            (b.envoyeeLe ?? b.creeLe).localeCompare(a.envoyeeLe ?? a.creeLe),
          ),
        );
      },
      async parId(coupleId, id) {
        const trouve = (confidences.get(coupleId) ?? []).find((c) => c.id === id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(coupleId, confidence) {
        const liste = confidences.get(coupleId) ?? [];
        const index = liste.findIndex((c) => c.id === confidence.id);
        if (index >= 0) liste[index] = copie(confidence);
        else liste.push(copie(confidence));
        confidences.set(coupleId, liste);
      },
      async effacerPourCouple(coupleId) {
        confidences.delete(coupleId);
      },
    },

    cycle: {
      async partage(coupleId) {
        const trouve = partagesCycle.get(coupleId);
        return trouve ? copie(trouve) : undefined;
      },
      async definirPartage(coupleId, partage) {
        partagesCycle.set(coupleId, copie(partage));
      },
      async regles(coupleId) {
        return copie(
          (regles.get(coupleId) ?? []).sort((a, b) =>
            b.debutLe.localeCompare(a.debutLe),
          ),
        );
      },
      async ajouterRegles(coupleId, entree) {
        const liste = regles.get(coupleId) ?? [];
        const index = liste.findIndex((r) => r.debutLe === entree.debutLe);
        if (index >= 0) liste[index] = copie(entree);
        else liste.push(copie(entree));
        regles.set(coupleId, liste);
      },
      async supprimerRegles(coupleId, id) {
        regles.set(
          coupleId,
          (regles.get(coupleId) ?? []).filter((r) => r.id !== id),
        );
      },
      async symptomes(coupleId) {
        return copie(
          (symptomes.get(coupleId) ?? []).sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        );
      },
      async noterSymptome(coupleId, symptome) {
        const liste = (symptomes.get(coupleId) ?? []).filter(
          (s) => !(s.date === symptome.date && s.type === symptome.type),
        );
        liste.push(copie(symptome));
        symptomes.set(coupleId, liste);
      },
      async retirerSymptome(coupleId, id) {
        symptomes.set(
          coupleId,
          (symptomes.get(coupleId) ?? []).filter((s) => s.id !== id),
        );
      },
      async effacerPourCouple(coupleId) {
        partagesCycle.delete(coupleId);
        regles.delete(coupleId);
        symptomes.delete(coupleId);
      },
    },

    appareils: {
      async parPartenaire(partenaireId) {
        return copie(appareils.filter((a) => a.partenaireId === partenaireId));
      },
      async enregistrer(appareil) {
        const index = appareils.findIndex(
          (a) => a.jetonPush === appareil.jetonPush,
        );
        if (index >= 0) appareils[index] = copie(appareil);
        else appareils.push(copie(appareil));
      },
      async supprimerParJeton(jetonPush) {
        const index = appareils.findIndex((a) => a.jetonPush === jetonPush);
        if (index >= 0) appareils.splice(index, 1);
      },
      async effacerPourPartenaire(partenaireId) {
        for (let i = appareils.length - 1; i >= 0; i--) {
          if (appareils[i]!.partenaireId === partenaireId) appareils.splice(i, 1);
        }
      },
    },
  };
}
