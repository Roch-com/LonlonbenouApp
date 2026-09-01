/**
 * Adaptateur PostgreSQL du port `Depot`.
 *
 * Il implémente exactement la même interface que le dépôt en mémoire, et
 * **aucune logique métier ne vit ici** : pas de décision de visibilité, pas de
 * comptage d'essais, pas de politique de notification. Ce fichier traduit des
 * lignes en objets du domaine, rien d'autre. Les invariants restent dans
 * `@lonlonbenu/shared`, rejoués par les services.
 *
 * C'est ce qui rend la substitution vérifiable : la suite de tests de l'API
 * tourne à l'identique contre l'un ou l'autre adaptateur.
 */

import pg from 'pg';
import {
  NOM_ESPACE_PAR_DEFAUT,
  PREFERENCES_PAR_DEFAUT,
  type AvanceeSeance,
  type AxeCroissance,
  type SouvenirScelle,
  type Consentement,
  type ContributionAxe,
  type Confidence,
  type Couple,
  type Evenement,
  type Initiative,
  type FactureScellee,
  type NiveauImportance,
  type ParcoursEngage,
  type PartageCycle,
  type Projet,
  type Partenaire,
  type Symptome,
  type PartageReciproque,
  type PartenaireId,
  type PreferencesNotifications,
  type Reconnaissance,
  type ReponseSeance,
} from '@lonlonbenu/shared';
import type {
  AlerteServeur,
  Appareil,
  CoupleServeur,
  DepenseScellee,
  Depot,
  InvitationServeur,
  NotificationServeur,
} from './depot.ts';

const { Pool, types } = pg;

// Une colonne DATE représente un jour civil, pas un instant. Laissée à
// node-postgres, elle deviendrait un Date à minuit *local*, décalé d'un jour
// selon le fuseau. On la garde telle quelle, en texte.
types.setTypeParser(1082, (valeur: string) => valeur);

export interface OptionsPostgres {
  connectionString: string;
  /** Schéma dédié, utile pour isoler des exécutions concurrentes. */
  schema?: string;
  max?: number;
  /**
   * Chiffrement du lien vers la base. `auto` l'active dès que l'hôte n'est pas
   * local — c'est le cas de toute base hébergée.
   */
  ssl?: 'auto' | 'requis' | 'aucun';
}

/**
 * Un hébergeur de base managée impose TLS, et présente le plus souvent un
 * certificat signé par sa propre autorité interne. `rejectUnauthorized: false`
 * accepte ce certificat.
 *
 * Ce que cela concède, et ce que cela ne concède pas : le lien reste chiffré —
 * personne ne lit les requêtes au passage — mais on ne vérifie plus l'identité
 * du serveur, donc on ne détecte pas un interlocuteur substitué. Le risque est
 * borné au réseau interne de l'hébergeur, entre l'API et sa base. Pour le
 * lever, fournir la chaîne de certification de l'hébergeur.
 */
function reglageSsl(options: OptionsPostgres): pg.PoolConfig['ssl'] {
  const mode = options.ssl ?? 'auto';
  if (mode === 'aucun') return undefined;

  if (mode === 'auto') {
    const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(
      options.connectionString,
    );
    if (local || /sslmode=disable/.test(options.connectionString)) return undefined;
  }

  return { rejectUnauthorized: false };
}

export function creerPool(options: OptionsPostgres): pg.Pool {
  const ssl = reglageSsl(options);
  return new Pool({
    connectionString: options.connectionString,
    max: options.max ?? 4,
    ...(ssl ? { ssl } : {}),
    ...(options.schema ? { options: `-c search_path=${options.schema}` } : {}),
  });
}

/** `TIMESTAMPTZ` → chaîne ISO, le format employé partout dans le domaine. */
function iso(valeur: Date | string | null): string | undefined {
  if (valeur === null) return undefined;
  return valeur instanceof Date
    ? valeur.toISOString()
    : new Date(valeur).toISOString();
}

function isoRequis(valeur: Date | string): string {
  return iso(valeur)!;
}

/** Une ligne de `souvenirs`, telle que pg la rend. */
interface LigneSouvenir {
  id: string;
  sorte: string;
  jour: Date | string;
  contenu_scelle: string;
  cree_par: string;
  cree_le: Date;
}

/**
 * `DATE` revient tantôt en `Date`, tantôt en chaîne selon la configuration du
 * pilote. On ramène les deux à `YYYY-MM-DD`, sans passer par `toISOString` :
 * celui-ci convertit en UTC et rendrait la veille pour toute date lue à l'est
 * de Greenwich.
 */
function jourCivil(valeur: Date | string): string {
  if (typeof valeur === 'string') return valeur.slice(0, 10);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${valeur.getFullYear()}-${deux(valeur.getMonth() + 1)}-${deux(valeur.getDate())}`;
}

interface LigneDepense {
  id: string;
  jour: Date | string;
  contenu_scelle: string;
  cree_par: string;
  cree_le: Date;
}

function versDepense(ligne: LigneDepense): DepenseScellee {
  return {
    id: ligne.id,
    jour: jourCivil(ligne.jour),
    contenuScelle: ligne.contenu_scelle,
    creePar: ligne.cree_par,
    creeLe: isoRequis(ligne.cree_le),
  };
}

function versSouvenir(ligne: LigneSouvenir): SouvenirScelle {
  return {
    id: ligne.id,
    sorte: ligne.sorte as SouvenirScelle['sorte'],
    jour: jourCivil(ligne.jour),
    contenuScelle: ligne.contenu_scelle,
    creePar: ligne.cree_par,
    creeLe: isoRequis(ligne.cree_le),
  };
}

interface LigneFacture {
  id: string;
  premiere_echeance: Date | string;
  periodicite: string;
  contenu_scelle: string;
  cree_par: string;
  cree_le: Date;
  arretee_le: Date | null;
}

function versFacture(ligne: LigneFacture): FactureScellee {
  const arreteeLe = iso(ligne.arretee_le);
  return {
    id: ligne.id,
    premiereEcheance: jourCivil(ligne.premiere_echeance),
    periodicite: ligne.periodicite as FactureScellee['periodicite'],
    contenuScelle: ligne.contenu_scelle,
    creePar: ligne.cree_par,
    creeLe: isoRequis(ligne.cree_le),
    ...(arreteeLe ? { arreteeLe } : {}),
  };
}

export function creerDepotPostgres(pool: pg.Pool): Depot {
  async function chargerCouple(ligne: {
    id: string;
    depuis: string;
    nom_espace?: string | null;
    dissocie_le: Date | null;
  }): Promise<CoupleServeur> {
    const [partenaires, partages] = await Promise.all([
      pool.query<{ id: string; prenom: string; initiales: string; rang: number }>(
        'SELECT id, prenom, initiales, rang FROM partenaires WHERE couple_id = $1 ORDER BY rang',
        [ligne.id],
      ),
      pool.query<{
        module: string;
        partenaire_id: string;
        actif: boolean;
        maj_le: Date;
      }>(
        'SELECT module, partenaire_id, actif, maj_le FROM partages WHERE couple_id = $1',
        [ligne.id],
      ),
    ]);

    const membres = partenaires.rows.map((r): Partenaire => ({
      id: r.id,
      prenom: r.prenom,
      initiales: r.initiales,
    }));

    const couple: Couple = {
      id: ligne.id,
      depuis: ligne.depuis,
      partenaires: [membres[0]!, membres[1]!],
      // Absent plutôt que par défaut : un couple qui n'a pas nommé son espace
      // n'en a pas nommé, et l'écran décide de ce qu'il affiche à la place.
      ...(ligne.nom_espace && ligne.nom_espace !== NOM_ESPACE_PAR_DEFAUT
        ? { nomEspace: ligne.nom_espace }
        : {}),
    };

    const parModule = new Map<string, Consentement[]>();
    for (const r of partages.rows) {
      const liste = parModule.get(r.module) ?? [];
      liste.push({
        partenaireId: r.partenaire_id,
        actif: r.actif,
        majLe: isoRequis(r.maj_le),
      });
      parModule.set(r.module, liste);
    }

    const rang = (id: PartenaireId) => membres.findIndex((m) => m.id === id);
    const complets: Record<string, PartageReciproque> = {};

    for (const [module, liste] of parModule) {
      // L'ordre suit celui des partenaires du couple, pas celui des lignes.
      const ordonnes = [...liste].sort(
        (a, b) => rang(a.partenaireId) - rang(b.partenaireId),
      );
      const complet =
        ordonnes.length === 2 &&
        new Set(ordonnes.map((c) => c.partenaireId)).size === 2;

      // Un module auquel il manque une ligne est un état corrompu : on le rend
      // inactif plutôt que de le laisser passer pour consenti.
      complets[module] = {
        module: module as PartageReciproque['module'],
        consentements: complet
          ? [ordonnes[0]!, ordonnes[1]!]
          : [
              {
                partenaireId: membres[0]!.id,
                actif: false,
                majLe: isoRequis(new Date()),
              },
              {
                partenaireId: membres[1]!.id,
                actif: false,
                majLe: isoRequis(new Date()),
              },
            ],
      };
    }

    return {
      id: ligne.id,
      couple,
      partages: complets,
      dissocieLe: iso(ligne.dissocie_le),
    };
  }

  async function chargerAxes(
    lignes: readonly {
      id: string;
      theme: string;
      titre: string;
      ouvert_par: string;
      ouvert_le: Date;
      cloture_le: Date | null;
      importance: string | null;
    }[],
  ): Promise<AxeCroissance[]> {
    if (lignes.length === 0) return [];

    const contributions = await pool.query<{
      axe_id: string;
      partenaire_id: string;
      ressenti: string;
      besoin: string;
      maj_le: Date;
    }>(
      `SELECT axe_id, partenaire_id, ressenti, besoin, maj_le
         FROM contributions_axe
        WHERE axe_id = ANY($1::text[])
        ORDER BY maj_le`,
      [lignes.map((l) => l.id)],
    );

    const reconnaissances = await pool.query<{
      axe_id: string;
      partenaire_id: string;
      le: Date;
    }>(
      `SELECT axe_id, partenaire_id, le
         FROM reconnaissances_axe
        WHERE axe_id = ANY($1::text[])
        ORDER BY le`,
      [lignes.map((l) => l.id)],
    );

    const reconnuesParAxe = new Map<string, Reconnaissance[]>();
    for (const r of reconnaissances.rows) {
      const liste = reconnuesParAxe.get(r.axe_id) ?? [];
      liste.push({ partenaireId: r.partenaire_id, le: isoRequis(r.le) });
      reconnuesParAxe.set(r.axe_id, liste);
    }

    const parAxe = new Map<string, ContributionAxe[]>();
    for (const c of contributions.rows) {
      const liste = parAxe.get(c.axe_id) ?? [];
      liste.push({
        partenaireId: c.partenaire_id,
        ressenti: c.ressenti,
        besoin: c.besoin,
        majLe: isoRequis(c.maj_le),
      });
      parAxe.set(c.axe_id, liste);
    }

    return lignes.map((l) => ({
      id: l.id,
      theme: l.theme as AxeCroissance['theme'],
      titre: l.titre,
      ouvertPar: l.ouvert_par,
      ouvertLe: isoRequis(l.ouvert_le),
      contributions: parAxe.get(l.id) ?? [],
      // Absente plutôt que par défaut : un axe ouvert avant que l'importance
      // existe n'a pas eu à choisir, et lui en prêter une ferait dire à son
      // auteur quelque chose qu'il n'a pas dit.
      ...(l.importance
        ? { importance: l.importance as NiveauImportance }
        : {}),
      reconnaissances: reconnuesParAxe.get(l.id) ?? [],
      clotureLe: iso(l.cloture_le),
    }));
  }

  /**
   * Recompose des parcours engagés à partir des trois tables.
   *
   * En trois requêtes plutôt qu'en jointure : une jointure sur des séances sans
   * réponse perdrait les avancées tout juste ouvertes, et une jointure externe
   * demanderait de dédoublonner à la main ce que trois `Map` font mieux.
   *
   * Les séances sont rendues dans l'ordre d'ouverture, qui est celui du
   * catalogue : le modèle partagé cherche la première non échangée et n'a donc
   * pas besoin d'un tri, mais un ordre stable rend les tests lisibles.
   */
  async function lireParcours(
    coupleId: string,
    parcoursId?: string,
  ): Promise<ParcoursEngage[]> {
    const filtre = parcoursId ? ' AND parcours_id = $2' : '';
    const args = parcoursId ? [coupleId, parcoursId] : [coupleId];

    const engages = await pool.query<{
      parcours_id: string;
      commence_le: Date;
      termine_le: Date | null;
    }>(
      `SELECT parcours_id, commence_le, termine_le
         FROM parcours_engages WHERE couple_id = $1${filtre}
        ORDER BY commence_le`,
      args,
    );
    if (engages.rows.length === 0) return [];

    const [avancees, reponses] = await Promise.all([
      pool.query<{
        parcours_id: string;
        seance_id: string;
        echange_le: Date | null;
      }>(
        `SELECT parcours_id, seance_id, echange_le
           FROM parcours_avancees WHERE couple_id = $1${filtre}
          ORDER BY seance_id`,
        args,
      ),
      pool.query<{
        parcours_id: string;
        seance_id: string;
        partenaire_id: string;
        texte_scelle: string;
        fait_le: Date;
      }>(
        `SELECT parcours_id, seance_id, partenaire_id, texte_scelle, fait_le
           FROM parcours_reponses WHERE couple_id = $1${filtre}
          ORDER BY fait_le`,
        args,
      ),
    ]);

    const parSeance = new Map<string, ReponseSeance[]>();
    for (const r of reponses.rows) {
      const cle = `${r.parcours_id}|${r.seance_id}`;
      const liste = parSeance.get(cle) ?? [];
      liste.push({
        partenaireId: r.partenaire_id,
        texteScelle: r.texte_scelle,
        faitLe: isoRequis(r.fait_le),
      });
      parSeance.set(cle, liste);
    }

    const parParcours = new Map<string, AvanceeSeance[]>();
    for (const a of avancees.rows) {
      const liste = parParcours.get(a.parcours_id) ?? [];
      const echangeLe = iso(a.echange_le);
      liste.push({
        seanceId: a.seance_id,
        reponses: parSeance.get(`${a.parcours_id}|${a.seance_id}`) ?? [],
        ...(echangeLe ? { echangeLe } : {}),
      });
      parParcours.set(a.parcours_id, liste);
    }

    return engages.rows.map((e) => {
      const termineLe = iso(e.termine_le);
      return {
        parcoursId: e.parcours_id,
        commenceLe: isoRequis(e.commence_le),
        avancees: parParcours.get(e.parcours_id) ?? [],
        ...(termineLe ? { termineLe } : {}),
      };
    });
  }

  return {
    couples: {
      async parId(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, depuis::text AS depuis, nom_espace, dissocie_le
             FROM couples WHERE id = $1`,
          [coupleId],
        );
        return rows[0] ? chargerCouple(rows[0]) : undefined;
      },

      async actifs() {
        const { rows } = await pool.query(
          `SELECT id, depuis::text AS depuis, nom_espace, dissocie_le
             FROM couples WHERE dissocie_le IS NULL`,
        );
        return Promise.all(rows.map((r) => chargerCouple(r)));
      },

      async parPartenaire(partenaireId) {
        const { rows } = await pool.query(
          `SELECT c.id, c.depuis::text AS depuis, c.nom_espace, c.dissocie_le
             FROM couples c
             JOIN partenaires p ON p.couple_id = c.id
            WHERE p.id = $1`,
          [partenaireId],
        );
        return rows[0] ? chargerCouple(rows[0]) : undefined;
      },

      async enregistrer(enregistrement) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          await client.query(
            `INSERT INTO couples (id, depuis, nom_espace, dissocie_le)
                  VALUES ($1, $2::date, $3, $4)
             ON CONFLICT (id) DO UPDATE
                    SET depuis = EXCLUDED.depuis,
                        nom_espace = EXCLUDED.nom_espace,
                        dissocie_le = EXCLUDED.dissocie_le`,
            [
              enregistrement.id,
              enregistrement.couple.depuis,
              // La colonne est NOT NULL : le défaut est posé ici plutôt que
              // laissé à la base, pour que les deux adaptateurs s'accordent.
              enregistrement.couple.nomEspace ?? NOM_ESPACE_PAR_DEFAUT,
              enregistrement.dissocieLe ?? null,
            ],
          );

          for (const [
            rang,
            partenaire,
          ] of enregistrement.couple.partenaires.entries()) {
            await client.query(
              `INSERT INTO partenaires (id, couple_id, prenom, initiales, rang)
                    VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE
                      SET couple_id = EXCLUDED.couple_id,
                          prenom = EXCLUDED.prenom,
                          initiales = EXCLUDED.initiales,
                          rang = EXCLUDED.rang`,
              [
                partenaire.id,
                enregistrement.id,
                partenaire.prenom,
                partenaire.initiales,
                rang,
              ],
            );
          }

          for (const partage of Object.values(enregistrement.partages)) {
            for (const consentement of partage.consentements) {
              await client.query(
                `INSERT INTO partages (couple_id, module, partenaire_id, actif, maj_le)
                      VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (couple_id, module, partenaire_id) DO UPDATE
                        SET actif = EXCLUDED.actif,
                            maj_le = EXCLUDED.maj_le`,
                [
                  enregistrement.id,
                  partage.module,
                  consentement.partenaireId,
                  consentement.actif,
                  consentement.majLe,
                ],
              );
            }
          }

          await client.query('COMMIT');
        } catch (erreur) {
          await client.query('ROLLBACK');
          throw erreur;
        } finally {
          client.release();
        }
      },
    },

    axes: {
      async parCouple(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, theme, titre, ouvert_par, ouvert_le, cloture_le, importance
             FROM axes WHERE couple_id = $1 ORDER BY ouvert_le`,
          [coupleId],
        );
        return chargerAxes(rows);
      },

      async parId(coupleId, axeId) {
        const { rows } = await pool.query(
          `SELECT id, theme, titre, ouvert_par, ouvert_le, cloture_le, importance
             FROM axes WHERE couple_id = $1 AND id = $2`,
          [coupleId, axeId],
        );
        return rows[0] ? (await chargerAxes(rows))[0] : undefined;
      },

      async enregistrer(coupleId, axe) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO axes (id, couple_id, theme, titre, ouvert_par,
                               ouvert_le, cloture_le, importance)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE
                    SET theme = EXCLUDED.theme,
                        titre = EXCLUDED.titre,
                        cloture_le = EXCLUDED.cloture_le,
                        importance = EXCLUDED.importance`,
            [
              axe.id,
              coupleId,
              axe.theme,
              axe.titre,
              axe.ouvertPar,
              axe.ouvertLe,
              axe.clotureLe ?? null,
              axe.importance ?? null,
            ],
          );

          for (const reconnaissance of axe.reconnaissances ?? []) {
            await client.query(
              `INSERT INTO reconnaissances_axe (axe_id, partenaire_id, le)
                    VALUES ($1, $2, $3)
               ON CONFLICT (axe_id, partenaire_id) DO NOTHING`,
              [axe.id, reconnaissance.partenaireId, reconnaissance.le],
            );
          }

          for (const contribution of axe.contributions) {
            await client.query(
              `INSERT INTO contributions_axe (axe_id, partenaire_id, ressenti, besoin, maj_le)
                    VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (axe_id, partenaire_id) DO UPDATE
                      SET ressenti = EXCLUDED.ressenti,
                          besoin = EXCLUDED.besoin,
                          maj_le = EXCLUDED.maj_le`,
              [
                axe.id,
                contribution.partenaireId,
                contribution.ressenti,
                contribution.besoin,
                contribution.majLe,
              ],
            );
          }

          await client.query('COMMIT');
        } catch (erreur) {
          await client.query('ROLLBACK');
          throw erreur;
        } finally {
          client.release();
        }
      },

      async effacerPourCouple(coupleId) {
        // `ON DELETE CASCADE` emporte les contributions.
        await pool.query('DELETE FROM axes WHERE couple_id = $1', [coupleId]);
      },
    },

    invitations: {
      async parId(id) {
        const { rows } = await pool.query<{
          id: string;
          emise_par: string;
          verificateur: string;
          sel: string;
          emise_le: Date;
          expire_le: Date;
          essais: number;
          consommee_le: Date | null;
          couple_id: string | null;
        }>('SELECT * FROM invitations WHERE id = $1', [id]);

        const ligne = rows[0];
        if (!ligne) return undefined;

        return {
          id: ligne.id,
          coupleId: ligne.couple_id ?? undefined,
          invitation: {
            verificateur: ligne.verificateur,
            sel: ligne.sel,
            emisePar: ligne.emise_par,
            emiseLe: isoRequis(ligne.emise_le),
            expireLe: isoRequis(ligne.expire_le),
            essais: ligne.essais,
            consommeeLe: iso(ligne.consommee_le),
          },
        } satisfies InvitationServeur;
      },

      async enregistrer(entree) {
        await pool.query(
          `INSERT INTO invitations
             (id, emise_par, verificateur, sel, emise_le, expire_le, essais, consommee_le, couple_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE
                  SET essais = EXCLUDED.essais,
                      consommee_le = EXCLUDED.consommee_le,
                      couple_id = EXCLUDED.couple_id`,
          [
            entree.id,
            entree.invitation.emisePar,
            entree.invitation.verificateur,
            entree.invitation.sel,
            entree.invitation.emiseLe,
            entree.invitation.expireLe,
            entree.invitation.essais,
            entree.invitation.consommeeLe ?? null,
            entree.coupleId ?? null,
          ],
        );
      },
    },

    notifications: {
      async preferences(partenaireId) {
        const { rows } = await pool.query<{
          preferences: PreferencesNotifications;
        }>(
          'SELECT preferences FROM preferences_notifications WHERE partenaire_id = $1',
          [partenaireId],
        );
        return rows[0]?.preferences ?? PREFERENCES_PAR_DEFAUT;
      },

      async definirPreferences(partenaireId, preferences) {
        await pool.query(
          `INSERT INTO preferences_notifications (partenaire_id, preferences, maj_le)
                VALUES ($1, $2::jsonb, now())
           ON CONFLICT (partenaire_id) DO UPDATE
                  SET preferences = EXCLUDED.preferences, maj_le = now()`,
          [partenaireId, JSON.stringify(preferences)],
        );
      },

      async ajouter(notification) {
        await pool.query(
          `INSERT INTO notifications
             (id, destinataire, categorie, texte, emise_le, remise, raison, expediee_le)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            notification.id,
            notification.destinataireId,
            notification.categorie,
            notification.texte,
            notification.emiseLe,
            notification.remise,
            notification.raison,
            notification.expedieeLe ?? null,
          ],
        );
      },

      async enAttente(partenaireId) {
        const { rows } = await pool.query(
          `SELECT * FROM notifications
            WHERE destinataire = $1
              AND expediee_le IS NULL
              AND remise <> 'ignoree'
            ORDER BY emise_le`,
          [partenaireId],
        );
        return rows.map(versNotification);
      },

      async marquerExpediees(ids, quand) {
        if (ids.length === 0) return;
        await pool.query(
          'UPDATE notifications SET expediee_le = $2 WHERE id = ANY($1::text[])',
          [[...ids], quand],
        );
      },

      async journal(partenaireId) {
        const { rows } = await pool.query(
          'SELECT * FROM notifications WHERE destinataire = $1 ORDER BY emise_le DESC',
          [partenaireId],
        );
        return rows.map(versNotification);
      },
    },

    viePratique: {
      async evenements(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, titre, categorie, debut, fin, journee_entiere, lieu, note,
                  cree_par, cree_le, rappel_heures
             FROM evenements WHERE couple_id = $1 ORDER BY debut`,
          [coupleId],
        );
        return rows.map((r): Evenement => ({
          id: r.id,
          titre: r.titre,
          categorie: r.categorie,
          debut: r.debut,
          fin: r.fin ?? undefined,
          journeeEntiere: r.journee_entiere,
          lieu: r.lieu ?? undefined,
          note: r.note ?? undefined,
          creePar: r.cree_par,
          creeLe: isoRequis(r.cree_le),
          visibilite: 'couple',
          rappelHeures: r.rappel_heures ?? undefined,
        }));
      },

      async enregistrerEvenement(coupleId, e) {
        await pool.query(
          `INSERT INTO evenements
             (id, couple_id, titre, categorie, debut, fin, journee_entiere, lieu, note,
              cree_par, cree_le, rappel_heures)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE
                  SET titre = EXCLUDED.titre, categorie = EXCLUDED.categorie,
                      debut = EXCLUDED.debut, fin = EXCLUDED.fin,
                      journee_entiere = EXCLUDED.journee_entiere,
                      lieu = EXCLUDED.lieu, note = EXCLUDED.note,
                      rappel_heures = EXCLUDED.rappel_heures`,
          [
            e.id,
            coupleId,
            e.titre,
            e.categorie,
            e.debut,
            e.fin ?? null,
            e.journeeEntiere,
            e.lieu ?? null,
            e.note ?? null,
            e.creePar,
            e.creeLe,
            e.rappelHeures ?? null,
          ],
        );
      },

      async supprimerEvenement(coupleId, id) {
        await pool.query(
          'DELETE FROM evenements WHERE couple_id = $1 AND id = $2',
          [coupleId, id],
        );
      },

      async projets(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, titre, intention, echeance::text AS echeance, cree_par, cree_le,
                  archive_le, reveler_le::text AS reveler_le
             FROM projets WHERE couple_id = $1 ORDER BY cree_le DESC`,
          [coupleId],
        );
        if (rows.length === 0) return [];

        const jalons = await pool.query(
          `SELECT id, projet_id, titre, echeance::text AS echeance, fait_le, fait_par
             FROM jalons WHERE projet_id = ANY($1::text[]) ORDER BY rang`,
          [rows.map((r) => r.id)],
        );

        return rows.map((r): Projet => ({
          id: r.id,
          titre: r.titre,
          intention: r.intention ?? undefined,
          echeance: r.echeance ?? undefined,
          creePar: r.cree_par,
          creeLe: isoRequis(r.cree_le),
          archiveLe: iso(r.archive_le),
          revelerLe: r.reveler_le ?? undefined,
          jalons: jalons.rows
            .filter((j) => j.projet_id === r.id)
            .map((j) => ({
              id: j.id,
              titre: j.titre,
              echeance: j.echeance ?? undefined,
              faitLe: iso(j.fait_le),
              faitPar: j.fait_par ?? undefined,
            })),
        }));
      },

      async projetParId(coupleId, id) {
        return (await this.projets(coupleId)).find((p) => p.id === id);
      },

      async enregistrerProjet(coupleId, projet) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO projets (id, couple_id, titre, intention, echeance, cree_par, cree_le, archive_le, reveler_le)
                  VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::date)
             ON CONFLICT (id) DO UPDATE
                    SET titre = EXCLUDED.titre, intention = EXCLUDED.intention,
                        echeance = EXCLUDED.echeance, archive_le = EXCLUDED.archive_le,
                        reveler_le = EXCLUDED.reveler_le`,
            [
              projet.id,
              coupleId,
              projet.titre,
              projet.intention ?? null,
              projet.echeance ?? null,
              projet.creePar,
              projet.creeLe,
              projet.archiveLe ?? null,
              projet.revelerLe ?? null,
            ],
          );
          // Remplacement intégral : un jalon retiré doit disparaître.
          await client.query('DELETE FROM jalons WHERE projet_id = $1', [
            projet.id,
          ]);
          for (const [rang, j] of projet.jalons.entries()) {
            await client.query(
              `INSERT INTO jalons (id, projet_id, titre, echeance, fait_le, fait_par, rang)
                    VALUES ($1,$2,$3,$4::date,$5,$6,$7)`,
              [
                j.id,
                projet.id,
                j.titre,
                j.echeance ?? null,
                j.faitLe ?? null,
                j.faitPar ?? null,
                rang,
              ],
            );
          }
          await client.query('COMMIT');
        } catch (erreur) {
          await client.query('ROLLBACK');
          throw erreur;
        } finally {
          client.release();
        }
      },

      async initiatives(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, titre, categorie, etat, proposee_par, proposee_le,
                  prevue_pour::text AS prevue_pour, vecue_le, souvenir
             FROM initiatives WHERE couple_id = $1 ORDER BY proposee_le DESC`,
          [coupleId],
        );
        return rows.map((r): Initiative => ({
          id: r.id,
          titre: r.titre,
          categorie: r.categorie,
          etat: r.etat,
          proposeePar: r.proposee_par,
          proposeeLe: isoRequis(r.proposee_le),
          prevuePour: r.prevue_pour ?? undefined,
          vecueLe: iso(r.vecue_le),
          souvenir: r.souvenir ?? undefined,
        }));
      },

      async initiativeParId(coupleId, id) {
        return (await this.initiatives(coupleId)).find((i) => i.id === id);
      },

      async enregistrerInitiative(coupleId, i) {
        await pool.query(
          `INSERT INTO initiatives
             (id, couple_id, titre, categorie, etat, proposee_par, proposee_le, prevue_pour, vecue_le, souvenir)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10)
           ON CONFLICT (id) DO UPDATE
                  SET etat = EXCLUDED.etat, prevue_pour = EXCLUDED.prevue_pour,
                      vecue_le = EXCLUDED.vecue_le, souvenir = EXCLUDED.souvenir`,
          [
            i.id,
            coupleId,
            i.titre,
            i.categorie,
            i.etat,
            i.proposeePar,
            i.proposeeLe,
            i.prevuePour ?? null,
            i.vecueLe ?? null,
            i.souvenir ?? null,
          ],
        );
      },

      async supprimerInitiative(coupleId, id) {
        await pool.query(
          'DELETE FROM initiatives WHERE couple_id = $1 AND id = $2',
          [coupleId, id],
        );
      },

      async rappelsEmis(coupleId) {
        const { rows } = await pool.query<{ cle: string }>(
          'SELECT cle FROM rappels_emis WHERE couple_id = $1',
          [coupleId],
        );
        return rows.map((r) => r.cle);
      },

      async noterRappelsEmis(coupleId, cles) {
        for (const cle of cles) {
          await pool.query(
            `INSERT INTO rappels_emis (couple_id, cle) VALUES ($1, $2)
             ON CONFLICT (couple_id, cle) DO NOTHING`,
            [coupleId, cle],
          );
        }
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM rappels_emis WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM initiatives WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM projets WHERE couple_id = $1', [coupleId]);
        await pool.query('DELETE FROM evenements WHERE couple_id = $1', [coupleId]);
      },
    },

    chat: {
      async clePublique(partenaireId) {
        const { rows } = await pool.query<{ cle_publique: string }>(
          'SELECT cle_publique FROM cles_publiques WHERE partenaire_id = $1',
          [partenaireId],
        );
        return rows[0]?.cle_publique;
      },

      async definirClePublique(partenaireId, cle) {
        await pool.query(
          `INSERT INTO cles_publiques (partenaire_id, cle_publique, maj_le)
                VALUES ($1, $2, now())
           ON CONFLICT (partenaire_id) DO UPDATE
                  SET cle_publique = EXCLUDED.cle_publique, maj_le = now()`,
          [partenaireId, cle],
        );
      },

      async messages(coupleId) {
        const { rows } = await pool.query<{
          id: string;
          auteur_id: string;
          enveloppe: string;
          envoye_le: Date;
          lu_le: Date | null;
          remettre_le: Date | null;
        }>(
          `SELECT id, auteur_id, enveloppe, envoye_le, lu_le, remettre_le
             FROM messages WHERE couple_id = $1 ORDER BY envoye_le`,
          [coupleId],
        );
        return rows.map((r) => ({
          id: r.id,
          auteurId: r.auteur_id,
          enveloppe: r.enveloppe,
          envoyeLe: isoRequis(r.envoye_le),
          luLe: iso(r.lu_le),
          remettreLe: iso(r.remettre_le),
        }));
      },

      async ajouter(coupleId, message) {
        await pool.query(
          `INSERT INTO messages
                  (id, couple_id, auteur_id, enveloppe, envoye_le, lu_le, remettre_le)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            message.id,
            coupleId,
            message.auteurId,
            message.enveloppe,
            message.envoyeLe,
            message.luLe ?? null,
            message.remettreLe ?? null,
          ],
        );
      },

      async supprimer(coupleId, id) {
        await pool.query('DELETE FROM messages WHERE couple_id = $1 AND id = $2', [
          coupleId,
          id,
        ]);
      },

      async marquerLus(coupleId, lecteurId, quand) {
        await pool.query(
          `UPDATE messages SET lu_le = $3
            WHERE couple_id = $1 AND auteur_id <> $2 AND lu_le IS NULL`,
          [coupleId, lecteurId, quand],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM messages WHERE couple_id = $1', [coupleId]);
      },
    },

    activite: {
      async parCouple(coupleId) {
        const { rows } = await pool.query<{
          partenaire_id: string;
          vu_le: Date;
          saisit_jusqua: Date | null;
        }>(
          `SELECT partenaire_id, vu_le, saisit_jusqua
             FROM activite WHERE couple_id = $1`,
          [coupleId],
        );
        return rows.map((r) => ({
          partenaireId: r.partenaire_id,
          vuLe: isoRequis(r.vu_le),
          saisitJusqua: iso(r.saisit_jusqua),
        }));
      },

      async signaler(coupleId, brute) {
        // Écrasement : une seule ligne par personne, aucun historique gardé.
        await pool.query(
          `INSERT INTO activite (couple_id, partenaire_id, vu_le, saisit_jusqua)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (couple_id, partenaire_id) DO UPDATE
                   SET vu_le = EXCLUDED.vu_le,
                       saisit_jusqua = EXCLUDED.saisit_jusqua`,
          [coupleId, brute.partenaireId, brute.vuLe, brute.saisitJusqua ?? null],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM activite WHERE couple_id = $1', [coupleId]);
      },
    },

    complicite: {
      async reponses(coupleId, jour) {
        const { rows } = await pool.query<{
          jour: Date | string;
          partenaire_id: string;
          texte_scelle: string;
          repondu_le: Date;
        }>(
          `SELECT jour, partenaire_id, texte_scelle, repondu_le
             FROM reponses_complicite WHERE couple_id = $1 AND jour = $2`,
          [coupleId, jour],
        );
        return rows.map((r) => ({
          jour: jourCivil(r.jour),
          partenaireId: r.partenaire_id,
          texteScelle: r.texte_scelle,
          reponduLe: isoRequis(r.repondu_le),
        }));
      },

      async repondre(coupleId, reponse) {
        await pool.query(
          `INSERT INTO reponses_complicite
                  (couple_id, jour, partenaire_id, texte_scelle, repondu_le)
                VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (couple_id, jour, partenaire_id) DO UPDATE
                  SET texte_scelle = EXCLUDED.texte_scelle,
                      repondu_le = EXCLUDED.repondu_le`,
          [
            coupleId,
            reponse.jour,
            reponse.partenaireId,
            reponse.texteScelle,
            reponse.reponduLe,
          ],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM reponses_complicite WHERE couple_id = $1', [
          coupleId,
        ]);
      },
    },

    connexion: {
      async langages(coupleId) {
        const { rows } = await pool.query<{
          partenaire_id: string;
          choix: Record<string, 'a' | 'b'>;
          maj_le: Date;
        }>(
          `SELECT partenaire_id, choix, maj_le
             FROM reponses_langages WHERE couple_id = $1`,
          [coupleId],
        );
        return rows.map((r) => ({
          partenaireId: r.partenaire_id,
          choix: r.choix,
          majLe: isoRequis(r.maj_le),
        }));
      },

      async definirLangages(coupleId, reponses) {
        await pool.query(
          `INSERT INTO reponses_langages
                  (couple_id, partenaire_id, choix, maj_le)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (couple_id, partenaire_id) DO UPDATE
                  SET choix = EXCLUDED.choix,
                      maj_le = EXCLUDED.maj_le`,
          [
            coupleId,
            reponses.partenaireId,
            JSON.stringify(reponses.choix),
            reponses.majLe,
          ],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query(
          'DELETE FROM reponses_langages WHERE couple_id = $1',
          [coupleId],
        );
      },
    },

    parcours: {
      async engages(coupleId) {
        return lireParcours(coupleId);
      },

      async parId(coupleId, parcoursId) {
        const tous = await lireParcours(coupleId, parcoursId);
        return tous[0];
      },

      /**
       * Réécrit l'avancement d'un parcours en une transaction.
       *
       * On efface les avancées avant de les réécrire : le modèle partagé
       * manipule l'objet entier, et un `INSERT ... ON CONFLICT` seul laisserait
       * en base les séances qu'une correction aurait retirées. La cascade sur
       * `parcours_reponses` emporte les réponses avec.
       */
      async enregistrer(coupleId, engage) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO parcours_engages
                    (couple_id, parcours_id, commence_le, termine_le)
                  VALUES ($1, $2, $3, $4)
             ON CONFLICT (couple_id, parcours_id) DO UPDATE
                    SET commence_le = EXCLUDED.commence_le,
                        termine_le = EXCLUDED.termine_le`,
            [
              coupleId,
              engage.parcoursId,
              engage.commenceLe,
              engage.termineLe ?? null,
            ],
          );
          await client.query(
            'DELETE FROM parcours_avancees WHERE couple_id = $1 AND parcours_id = $2',
            [coupleId, engage.parcoursId],
          );

          for (const avancee of engage.avancees) {
            await client.query(
              `INSERT INTO parcours_avancees
                      (couple_id, parcours_id, seance_id, echange_le)
                    VALUES ($1, $2, $3, $4)`,
              [
                coupleId,
                engage.parcoursId,
                avancee.seanceId,
                avancee.echangeLe ?? null,
              ],
            );
            for (const reponse of avancee.reponses) {
              await client.query(
                `INSERT INTO parcours_reponses
                        (couple_id, parcours_id, seance_id, partenaire_id,
                         texte_scelle, fait_le)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  coupleId,
                  engage.parcoursId,
                  avancee.seanceId,
                  reponse.partenaireId,
                  reponse.texteScelle,
                  reponse.faitLe,
                ],
              );
            }
          }

          await client.query('COMMIT');
        } catch (erreur) {
          await client.query('ROLLBACK');
          throw erreur;
        } finally {
          client.release();
        }
      },

      async effacerPourCouple(coupleId) {
        // La cascade emporte avancées et réponses.
        await pool.query(
          'DELETE FROM parcours_engages WHERE couple_id = $1',
          [coupleId],
        );
      },
    },

    finances: {
      async reglages(coupleId) {
        const { rows } = await pool.query<{
          actif: boolean;
          devise: string;
          regles_scelles: string | null;
          maj_le: Date;
        }>(
          `SELECT actif, devise, regles_scelles, maj_le
             FROM reglages_finances WHERE couple_id = $1`,
          [coupleId],
        );
        const ligne = rows[0];
        return ligne
          ? {
              actif: ligne.actif,
              devise: ligne.devise,
              reglesScellees: ligne.regles_scelles ?? undefined,
              majLe: isoRequis(ligne.maj_le),
            }
          : undefined;
      },

      async definirReglages(coupleId, reglages) {
        await pool.query(
          `INSERT INTO reglages_finances
                  (couple_id, actif, devise, regles_scelles, maj_le)
                VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (couple_id) DO UPDATE
                  SET actif = EXCLUDED.actif,
                      devise = EXCLUDED.devise,
                      regles_scelles = EXCLUDED.regles_scelles,
                      maj_le = EXCLUDED.maj_le`,
          [
            coupleId,
            reglages.actif,
            reglages.devise,
            reglages.reglesScellees ?? null,
            reglages.majLe,
          ],
        );
      },

      async depenses(coupleId) {
        const { rows } = await pool.query<LigneDepense>(
          `SELECT id, jour, contenu_scelle, cree_par, cree_le
             FROM depenses WHERE couple_id = $1 ORDER BY jour DESC`,
          [coupleId],
        );
        return rows.map(versDepense);
      },

      async depenseParId(coupleId, id) {
        const { rows } = await pool.query<LigneDepense>(
          `SELECT id, jour, contenu_scelle, cree_par, cree_le
             FROM depenses WHERE couple_id = $1 AND id = $2`,
          [coupleId, id],
        );
        return rows[0] ? versDepense(rows[0]) : undefined;
      },

      async enregistrerDepense(coupleId, depense) {
        await pool.query(
          `INSERT INTO depenses
                  (id, couple_id, jour, contenu_scelle, cree_par, cree_le)
                VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE
                  SET jour = EXCLUDED.jour,
                      contenu_scelle = EXCLUDED.contenu_scelle`,
          [
            depense.id,
            coupleId,
            depense.jour,
            depense.contenuScelle,
            depense.creePar,
            depense.creeLe,
          ],
        );
      },

      async supprimerDepense(coupleId, id) {
        await pool.query('DELETE FROM depenses WHERE couple_id = $1 AND id = $2', [
          coupleId,
          id,
        ]);
      },

      async factures(coupleId) {
        const { rows } = await pool.query<LigneFacture>(
          `SELECT id, premiere_echeance, periodicite, contenu_scelle,
                  cree_par, cree_le, arretee_le
             FROM factures WHERE couple_id = $1
            ORDER BY premiere_echeance`,
          [coupleId],
        );
        return rows.map(versFacture);
      },

      async factureParId(coupleId, id) {
        const { rows } = await pool.query<LigneFacture>(
          `SELECT id, premiere_echeance, periodicite, contenu_scelle,
                  cree_par, cree_le, arretee_le
             FROM factures WHERE couple_id = $1 AND id = $2`,
          [coupleId, id],
        );
        return rows[0] ? versFacture(rows[0]) : undefined;
      },

      async enregistrerFacture(coupleId, facture) {
        await pool.query(
          `INSERT INTO factures
                  (id, couple_id, premiere_echeance, periodicite,
                   contenu_scelle, cree_par, cree_le, arretee_le)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE
                  SET premiere_echeance = EXCLUDED.premiere_echeance,
                      periodicite = EXCLUDED.periodicite,
                      contenu_scelle = EXCLUDED.contenu_scelle,
                      arretee_le = EXCLUDED.arretee_le`,
          [
            facture.id,
            coupleId,
            facture.premiereEcheance,
            facture.periodicite,
            facture.contenuScelle,
            facture.creePar,
            facture.creeLe,
            facture.arreteeLe ?? null,
          ],
        );
      },

      async budgets(coupleId) {
        const { rows } = await pool.query<{
          projet_id: string;
          montant_scelle: string;
          maj_le: Date;
        }>(
          `SELECT projet_id, montant_scelle, maj_le
             FROM budgets_projet WHERE couple_id = $1`,
          [coupleId],
        );
        return rows.map((r) => ({
          projetId: r.projet_id,
          montantScelle: r.montant_scelle,
          majLe: isoRequis(r.maj_le),
        }));
      },

      async definirBudget(coupleId, budget) {
        await pool.query(
          `INSERT INTO budgets_projet
                  (couple_id, projet_id, montant_scelle, maj_le)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (couple_id, projet_id) DO UPDATE
                  SET montant_scelle = EXCLUDED.montant_scelle,
                      maj_le = EXCLUDED.maj_le`,
          [coupleId, budget.projetId, budget.montantScelle, budget.majLe],
        );
      },

      async supprimerBudget(coupleId, projetId) {
        await pool.query(
          'DELETE FROM budgets_projet WHERE couple_id = $1 AND projet_id = $2',
          [coupleId, projetId],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM depenses WHERE couple_id = $1', [coupleId]);
        await pool.query('DELETE FROM reglages_finances WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM factures WHERE couple_id = $1', [coupleId]);
        await pool.query('DELETE FROM budgets_projet WHERE couple_id = $1', [
          coupleId,
        ]);
      },
    },

    souvenirs: {
      async parCouple(coupleId) {
        const { rows } = await pool.query<LigneSouvenir>(
          `SELECT id, sorte, jour, contenu_scelle, cree_par, cree_le
             FROM souvenirs WHERE couple_id = $1 ORDER BY jour DESC`,
          [coupleId],
        );
        return rows.map(versSouvenir);
      },

      async parId(coupleId, id) {
        const { rows } = await pool.query<LigneSouvenir>(
          `SELECT id, sorte, jour, contenu_scelle, cree_par, cree_le
             FROM souvenirs WHERE couple_id = $1 AND id = $2`,
          [coupleId, id],
        );
        return rows[0] ? versSouvenir(rows[0]) : undefined;
      },

      async enregistrer(coupleId, souvenir) {
        await pool.query(
          `INSERT INTO souvenirs
                  (id, couple_id, sorte, jour, contenu_scelle, cree_par, cree_le)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE
                  SET sorte = EXCLUDED.sorte,
                      jour = EXCLUDED.jour,
                      contenu_scelle = EXCLUDED.contenu_scelle`,
          [
            souvenir.id,
            coupleId,
            souvenir.sorte,
            souvenir.jour,
            souvenir.contenuScelle,
            souvenir.creePar,
            souvenir.creeLe,
          ],
        );
      },

      async supprimer(coupleId, id) {
        await pool.query('DELETE FROM souvenirs WHERE couple_id = $1 AND id = $2', [
          coupleId,
          id,
        ]);
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM souvenirs WHERE couple_id = $1', [coupleId]);
      },
    },

    presence: {
      async positions(coupleId) {
        const { rows } = await pool.query<{
          partenaire_id: string;
          position_scellee: string;
          maj_le: Date;
        }>(
          `SELECT partenaire_id, position_scellee, maj_le
             FROM positions WHERE couple_id = $1`,
          [coupleId],
        );
        return rows.map((r) => ({
          partenaireId: r.partenaire_id,
          positionScellee: r.position_scellee,
          majLe: isoRequis(r.maj_le),
        }));
      },

      async definirPosition(coupleId, position) {
        // Écrasement : une seule ligne par personne, aucun historique gardé.
        await pool.query(
          `INSERT INTO positions
                  (couple_id, partenaire_id, position_scellee, maj_le)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (couple_id, partenaire_id) DO UPDATE
                  SET position_scellee = EXCLUDED.position_scellee,
                      maj_le = EXCLUDED.maj_le`,
          [
            coupleId,
            position.partenaireId,
            position.positionScellee,
            position.majLe,
          ],
        );
      },

      async statuts(coupleId) {
        const { rows } = await pool.query<{
          partenaire_id: string;
          code: string;
          note_scellee: string | null;
          maj_le: Date;
          humeur_code: string | null;
          mot_humeur_scelle: string | null;
          humeur_maj_le: Date | null;
        }>(
          `SELECT partenaire_id, code, note_scellee, maj_le,
                  humeur_code, mot_humeur_scelle, humeur_maj_le
             FROM statuts WHERE couple_id = $1`,
          [coupleId],
        );
        return rows.map((r) => ({
          partenaireId: r.partenaire_id,
          code: r.code,
          noteScellee: r.note_scellee ?? undefined,
          majLe: isoRequis(r.maj_le),
          humeurCode: r.humeur_code ?? undefined,
          motHumeurScelle: r.mot_humeur_scelle ?? undefined,
          humeurMajLe: iso(r.humeur_maj_le),
        }));
      },

      async definirStatut(coupleId, statut) {
        await pool.query(
          `INSERT INTO statuts (couple_id, partenaire_id, code, note_scellee, maj_le)
                VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (couple_id, partenaire_id) DO UPDATE
                  SET code = EXCLUDED.code,
                      note_scellee = EXCLUDED.note_scellee,
                      maj_le = EXCLUDED.maj_le`,
          [
            coupleId,
            statut.partenaireId,
            statut.code,
            statut.noteScellee ?? null,
            statut.majLe,
          ],
        );
      },

      async definirHumeur(coupleId, partenaireId, code, motScelle, quand) {
        await pool.query(
          `INSERT INTO statuts
             (couple_id, partenaire_id, code, maj_le, humeur_code, mot_humeur_scelle, humeur_maj_le)
                VALUES ($1, $2, 'disponible', $5, $3, $4, $5)
           ON CONFLICT (couple_id, partenaire_id) DO UPDATE
                  SET humeur_code = EXCLUDED.humeur_code,
                      mot_humeur_scelle = EXCLUDED.mot_humeur_scelle,
                      humeur_maj_le = EXCLUDED.humeur_maj_le`,
          [coupleId, partenaireId, code, motScelle ?? null, quand],
        );
      },

      async checkIns(coupleId) {
        const { rows } = await pool.query<{
          id: string;
          partenaire_id: string;
          lieu_scelle: string;
          mot_scelle: string | null;
          fait_le: Date;
        }>(
          `SELECT id, partenaire_id, lieu_scelle, mot_scelle, fait_le
             FROM check_ins WHERE couple_id = $1 ORDER BY fait_le DESC`,
          [coupleId],
        );
        return rows.map((r) => ({
          id: r.id,
          partenaireId: r.partenaire_id,
          lieuScelle: r.lieu_scelle,
          motScelle: r.mot_scelle ?? undefined,
          faitLe: isoRequis(r.fait_le),
        }));
      },

      async ajouterCheckIn(coupleId, checkIn) {
        await pool.query(
          `INSERT INTO check_ins (id, couple_id, partenaire_id, lieu_scelle, mot_scelle, fait_le)
                VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            checkIn.id,
            coupleId,
            checkIn.partenaireId,
            checkIn.lieuScelle,
            checkIn.motScelle ?? null,
            checkIn.faitLe,
          ],
        );
      },

      async alertes(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, partenaire_id, lieu_scelle, message_scelle, etat, emise_le, vue_le, resolue_le
             FROM alertes_sos WHERE couple_id = $1 ORDER BY emise_le DESC`,
          [coupleId],
        );
        return rows.map(versAlerte);
      },

      async enregistrerAlerte(coupleId, alerte) {
        await pool.query(
          `INSERT INTO alertes_sos
             (id, couple_id, partenaire_id, lieu_scelle, message_scelle, etat, emise_le, vue_le, resolue_le)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE
                  SET etat = EXCLUDED.etat,
                      vue_le = EXCLUDED.vue_le,
                      resolue_le = EXCLUDED.resolue_le`,
          [
            alerte.id,
            coupleId,
            alerte.partenaireId,
            alerte.lieuScelle ?? null,
            alerte.messageScelle ?? null,
            alerte.etat,
            alerte.emiseLe,
            alerte.vueLe ?? null,
            alerte.resolueLe ?? null,
          ],
        );
      },

      async alerteParId(coupleId, id) {
        const { rows } = await pool.query(
          `SELECT id, partenaire_id, lieu_scelle, message_scelle, etat, emise_le, vue_le, resolue_le
             FROM alertes_sos WHERE couple_id = $1 AND id = $2`,
          [coupleId, id],
        );
        return rows[0] ? versAlerte(rows[0]) : undefined;
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM positions WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM alertes_sos WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM check_ins WHERE couple_id = $1', [coupleId]);
        await pool.query('DELETE FROM statuts WHERE couple_id = $1', [coupleId]);
      },
    },

    confidences: {
      async parCouple(coupleId) {
        const { rows } = await pool.query(
          `SELECT id, auteur_id, type, titre, texte, cree_le, envoyee_le, lu_le
             FROM confidences WHERE couple_id = $1 ORDER BY envoyee_le DESC`,
          [coupleId],
        );
        return rows.map(versConfidence);
      },

      async parId(coupleId, id) {
        const { rows } = await pool.query(
          `SELECT id, auteur_id, type, titre, texte, cree_le, envoyee_le, lu_le
             FROM confidences WHERE couple_id = $1 AND id = $2`,
          [coupleId, id],
        );
        return rows[0] ? versConfidence(rows[0]) : undefined;
      },

      async enregistrer(coupleId, confidence) {
        // La colonne `visibilite` est contrainte à `couple` : un brouillon ne
        // peut littéralement pas être écrit ici.
        await pool.query(
          `INSERT INTO confidences
             (id, couple_id, auteur_id, type, titre, texte, cree_le, envoyee_le, lu_le)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET lu_le = EXCLUDED.lu_le`,
          [
            confidence.id,
            coupleId,
            confidence.auteurId,
            confidence.type,
            confidence.titre ?? null,
            confidence.texte,
            confidence.creeLe,
            confidence.envoyeeLe,
            confidence.luLe ?? null,
          ],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM confidences WHERE couple_id = $1', [
          coupleId,
        ]);
      },
    },

    cycle: {
      async partage(coupleId) {
        const { rows } = await pool.query<{
          porteuse_id: string;
          niveau: string;
          duree_declaree: number | null;
          desir_enfant: boolean;
          maj_le: Date;
        }>(
          `SELECT porteuse_id, niveau, duree_declaree, desir_enfant, maj_le
             FROM cycle_partage WHERE couple_id = $1`,
          [coupleId],
        );
        const ligne = rows[0];
        return ligne
          ? {
              porteuseId: ligne.porteuse_id,
              niveau: ligne.niveau as PartageCycle['niveau'],
              dureeDeclaree: ligne.duree_declaree ?? undefined,
              desirEnfant: ligne.desir_enfant,
              majLe: isoRequis(ligne.maj_le),
            }
          : undefined;
      },

      async definirPartage(coupleId, partage) {
        await pool.query(
          `INSERT INTO cycle_partage
                  (couple_id, porteuse_id, niveau, duree_declaree, desir_enfant, maj_le)
                VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (couple_id) DO UPDATE
                  SET porteuse_id = EXCLUDED.porteuse_id,
                      niveau = EXCLUDED.niveau,
                      duree_declaree = EXCLUDED.duree_declaree,
                      desir_enfant = EXCLUDED.desir_enfant,
                      maj_le = EXCLUDED.maj_le`,
          [
            coupleId,
            partage.porteuseId,
            partage.niveau,
            partage.dureeDeclaree ?? null,
            partage.desirEnfant ?? false,
            partage.majLe,
          ],
        );
      },

      async regles(coupleId) {
        const { rows } = await pool.query<{
          id: string;
          debut_le: string;
          fin_le: string | null;
          saisi_le: Date;
        }>(
          `SELECT id, debut_le::text AS debut_le, fin_le::text AS fin_le, saisi_le
             FROM cycle_regles WHERE couple_id = $1 ORDER BY debut_le DESC`,
          [coupleId],
        );
        return rows.map((r) => ({
          id: r.id,
          debutLe: r.debut_le,
          finLe: r.fin_le ?? undefined,
          saisiLe: isoRequis(r.saisi_le),
        }));
      },

      async ajouterRegles(coupleId, entree) {
        await pool.query(
          `INSERT INTO cycle_regles (id, couple_id, debut_le, fin_le, saisi_le)
                VALUES ($1, $2, $3::date, $4::date, $5)
           ON CONFLICT (couple_id, debut_le) DO UPDATE
                  SET fin_le = EXCLUDED.fin_le`,
          [
            entree.id,
            coupleId,
            entree.debutLe,
            entree.finLe ?? null,
            entree.saisiLe,
          ],
        );
      },

      async supprimerRegles(coupleId, id) {
        await pool.query(
          'DELETE FROM cycle_regles WHERE couple_id = $1 AND id = $2',
          [coupleId, id],
        );
      },

      async symptomes(coupleId) {
        const { rows } = await pool.query<{
          id: string;
          date_jour: string;
          type: string;
          intensite: number;
          note: string | null;
        }>(
          `SELECT id, date_jour::text AS date_jour, type, intensite, note
             FROM cycle_symptomes WHERE couple_id = $1 ORDER BY date_jour DESC`,
          [coupleId],
        );
        return rows.map((r) => ({
          id: r.id,
          date: r.date_jour,
          type: r.type as Symptome['type'],
          intensite: r.intensite as Symptome['intensite'],
          note: r.note ?? undefined,
        }));
      },

      async noterSymptome(coupleId, symptome) {
        await pool.query(
          `INSERT INTO cycle_symptomes (id, couple_id, date_jour, type, intensite, note)
                VALUES ($1, $2, $3::date, $4, $5, $6)
           ON CONFLICT (couple_id, date_jour, type) DO UPDATE
                  SET intensite = EXCLUDED.intensite, note = EXCLUDED.note`,
          [
            symptome.id,
            coupleId,
            symptome.date,
            symptome.type,
            symptome.intensite,
            symptome.note ?? null,
          ],
        );
      },

      async retirerSymptome(coupleId, id) {
        await pool.query(
          'DELETE FROM cycle_symptomes WHERE couple_id = $1 AND id = $2',
          [coupleId, id],
        );
      },

      async effacerPourCouple(coupleId) {
        await pool.query('DELETE FROM cycle_symptomes WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM cycle_regles WHERE couple_id = $1', [
          coupleId,
        ]);
        await pool.query('DELETE FROM cycle_partage WHERE couple_id = $1', [
          coupleId,
        ]);
      },
    },

    appareils: {
      async parPartenaire(partenaireId) {
        const { rows } = await pool.query<{
          partenaire_id: string;
          jeton_push: string;
          plateforme: 'ios' | 'android';
        }>(
          'SELECT partenaire_id, jeton_push, plateforme FROM appareils WHERE partenaire_id = $1 ORDER BY enregistre_le',
          [partenaireId],
        );
        return rows.map((r): Appareil => ({
          partenaireId: r.partenaire_id,
          jetonPush: r.jeton_push,
          plateforme: r.plateforme,
        }));
      },

      async enregistrer(appareil) {
        await pool.query(
          `INSERT INTO appareils (jeton_push, partenaire_id, plateforme)
                VALUES ($1, $2, $3)
           ON CONFLICT (jeton_push) DO UPDATE
                  SET partenaire_id = EXCLUDED.partenaire_id,
                      plateforme = EXCLUDED.plateforme`,
          [appareil.jetonPush, appareil.partenaireId, appareil.plateforme],
        );
      },

      async supprimerParJeton(jetonPush: string) {
        await pool.query('DELETE FROM appareils WHERE jeton_push = $1', [
          jetonPush,
        ]);
      },

      async effacerPourPartenaire(partenaireId: PartenaireId) {
        await pool.query('DELETE FROM appareils WHERE partenaire_id = $1', [
          partenaireId,
        ]);
      },
    },
  };
}

function versAlerte(ligne: {
  id: string;
  partenaire_id: string;
  lieu_scelle: string | null;
  message_scelle: string | null;
  etat: string;
  emise_le: Date;
  vue_le: Date | null;
  resolue_le: Date | null;
}): AlerteServeur {
  return {
    id: ligne.id,
    partenaireId: ligne.partenaire_id,
    lieuScelle: ligne.lieu_scelle ?? undefined,
    messageScelle: ligne.message_scelle ?? undefined,
    etat: ligne.etat as AlerteServeur['etat'],
    emiseLe: isoRequis(ligne.emise_le),
    vueLe: iso(ligne.vue_le),
    resolueLe: iso(ligne.resolue_le),
  };
}

function versConfidence(ligne: {
  id: string;
  auteur_id: string;
  type: string;
  titre: string | null;
  texte: string;
  cree_le: Date;
  envoyee_le: Date;
  lu_le: Date | null;
}): Confidence {
  return {
    id: ligne.id,
    auteurId: ligne.auteur_id,
    type: ligne.type as Confidence['type'],
    titre: ligne.titre ?? undefined,
    texte: ligne.texte,
    creeLe: isoRequis(ligne.cree_le),
    envoyeeLe: isoRequis(ligne.envoyee_le),
    luLe: iso(ligne.lu_le),
    // Le dépôt ne contient que des confidences envoyées.
    visibilite: 'couple',
  };
}

function versNotification(ligne: {
  id: string;
  destinataire: string;
  categorie: string;
  texte: string;
  emise_le: Date;
  remise: string;
  raison: string;
  expediee_le: Date | null;
}): NotificationServeur {
  return {
    id: ligne.id,
    destinataireId: ligne.destinataire,
    categorie: ligne.categorie as NotificationServeur['categorie'],
    texte: ligne.texte,
    emiseLe: isoRequis(ligne.emise_le),
    remise: ligne.remise as NotificationServeur['remise'],
    raison: ligne.raison,
    expedieeLe: iso(ligne.expediee_le),
  };
}
