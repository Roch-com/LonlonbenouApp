import type pg from 'pg';
import type {
  CodeAutorisation,
  Compte,
  DepotOAuth,
  JetonRafraichissement,
} from './depotOAuth.ts';

function iso(valeur: Date | null): string | undefined {
  return valeur ? valeur.toISOString() : undefined;
}

export function creerDepotOAuthPostgres(pool: pg.Pool): DepotOAuth {
  return {
    comptes: {
      async parCourriel(courriel) {
        const { rows } = await pool.query(
          'SELECT id, courriel, verificateur FROM comptes WHERE courriel = $1',
          [courriel.trim().toLowerCase()],
        );
        return rows[0] as Compte | undefined;
      },
      async parId(id) {
        const { rows } = await pool.query(
          'SELECT id, courriel, verificateur FROM comptes WHERE id = $1',
          [id],
        );
        return rows[0] as Compte | undefined;
      },
      async enregistrer(compte) {
        await pool.query(
          `INSERT INTO comptes (id, courriel, verificateur)
                VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (id) DO UPDATE
                  SET courriel = EXCLUDED.courriel,
                      verificateur = EXCLUDED.verificateur`,
          [compte.id, compte.courriel, JSON.stringify(compte.verificateur)],
        );
      },
    },

    codes: {
      async parCode(code) {
        const { rows } = await pool.query<{
          code: string;
          compte_id: string;
          client_id: string;
          defi_pkce: string;
          portee: string;
          expire_le: Date;
          consomme_le: Date | null;
        }>('SELECT * FROM codes_autorisation WHERE code = $1', [code]);

        const ligne = rows[0];
        if (!ligne) return undefined;
        return {
          code: ligne.code,
          compteId: ligne.compte_id,
          clientId: ligne.client_id,
          defiPkce: ligne.defi_pkce,
          portee: ligne.portee,
          expireLe: ligne.expire_le.toISOString(),
          consommeLe: iso(ligne.consomme_le),
        } satisfies CodeAutorisation;
      },
      async enregistrer(code) {
        await pool.query(
          `INSERT INTO codes_autorisation
             (code, compte_id, client_id, defi_pkce, methode_pkce, portee, expire_le, consomme_le)
           VALUES ($1, $2, $3, $4, 'S256', $5, $6, $7)
           ON CONFLICT (code) DO UPDATE SET consomme_le = EXCLUDED.consomme_le`,
          [
            code.code,
            code.compteId,
            code.clientId,
            code.defiPkce,
            code.portee,
            code.expireLe,
            code.consommeLe ?? null,
          ],
        );
      },
    },

    rafraichissements: {
      async parEmpreinte(empreinte) {
        const { rows } = await pool.query<{
          empreinte: string;
          famille: string;
          compte_id: string;
          client_id: string;
          portee: string;
          emis_le: Date;
          expire_le: Date;
          utilise_le: Date | null;
          revoque_le: Date | null;
        }>('SELECT * FROM jetons_rafraichissement WHERE empreinte = $1', [
          empreinte,
        ]);

        const ligne = rows[0];
        if (!ligne) return undefined;
        return {
          empreinte: ligne.empreinte,
          famille: ligne.famille,
          compteId: ligne.compte_id,
          clientId: ligne.client_id,
          portee: ligne.portee,
          emisLe: ligne.emis_le.toISOString(),
          expireLe: ligne.expire_le.toISOString(),
          utiliseLe: iso(ligne.utilise_le),
          revoqueLe: iso(ligne.revoque_le),
        } satisfies JetonRafraichissement;
      },
      async enregistrer(jeton) {
        await pool.query(
          `INSERT INTO jetons_rafraichissement
             (empreinte, famille, compte_id, client_id, portee, emis_le, expire_le, utilise_le, revoque_le)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (empreinte) DO UPDATE
                  SET utilise_le = EXCLUDED.utilise_le,
                      revoque_le = EXCLUDED.revoque_le`,
          [
            jeton.empreinte,
            jeton.famille,
            jeton.compteId,
            jeton.clientId,
            jeton.portee,
            jeton.emisLe,
            jeton.expireLe,
            jeton.utiliseLe ?? null,
            jeton.revoqueLe ?? null,
          ],
        );
      },
      async revoquerLaFamille(famille, quand) {
        await pool.query(
          'UPDATE jetons_rafraichissement SET revoque_le = $2 WHERE famille = $1 AND revoque_le IS NULL',
          [famille, quand],
        );
      },
    },

    reinitialisations: {
      async parEmpreinte(empreinte) {
        const { rows } = await pool.query<{
          empreinte: string;
          compte_id: string;
          demandee_le: Date;
          expire_le: Date;
          utilisee_le: Date | null;
          essais: number;
        }>(
          `SELECT empreinte, compte_id, demandee_le, expire_le, utilisee_le, essais
             FROM reinitialisations WHERE empreinte = $1`,
          [empreinte],
        );
        const ligne = rows[0];
        if (!ligne) return undefined;
        return {
          empreinte: ligne.empreinte,
          compteId: ligne.compte_id,
          demandeeLe: ligne.demandee_le.toISOString(),
          expireLe: ligne.expire_le.toISOString(),
          ...(ligne.utilisee_le
            ? { utiliseeLe: ligne.utilisee_le.toISOString() }
            : {}),
          essais: ligne.essais,
        };
      },

      async enregistrer(demande) {
        await pool.query(
          `INSERT INTO reinitialisations
                 (empreinte, compte_id, demandee_le, expire_le, utilisee_le, essais)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (empreinte) DO UPDATE
                  SET utilisee_le = EXCLUDED.utilisee_le,
                      essais = EXCLUDED.essais`,
          [
            demande.empreinte,
            demande.compteId,
            demande.demandeeLe,
            demande.expireLe,
            demande.utiliseeLe ?? null,
            demande.essais,
          ],
        );
      },

      async invaliderPour(compteId, quand) {
        await pool.query(
          `UPDATE reinitialisations SET utilisee_le = $2
            WHERE compte_id = $1 AND utilisee_le IS NULL`,
          [compteId, quand],
        );
      },
    },

    revocations: {
      async revoquer(jti, expireLe) {
        await pool.query(
          `INSERT INTO jetons_revoques (jti, expire_le) VALUES ($1, $2)
           ON CONFLICT (jti) DO NOTHING`,
          [jti, expireLe],
        );
      },
      async estRevoque(jti) {
        const { rows } = await pool.query(
          'SELECT 1 FROM jetons_revoques WHERE jti = $1',
          [jti],
        );
        return rows.length > 0;
      },
    },
  };
}
