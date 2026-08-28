/**
 * Persistance du serveur d'autorisation. Même principe que le dépôt métier :
 * un port, deux adaptateurs, aucune logique ici.
 */

import type { DemandeReinitialisation } from '@lonlonbenu/shared';

export interface Compte {
  id: string;
  courriel: string;
  /** Vérificateur scrypt sérialisé. Le mot de passe n'est jamais stocké. */
  verificateur: { sel: string; empreinte: string; n: number; r: number; p: number };
}

export interface CodeAutorisation {
  code: string;
  compteId: string;
  clientId: string;
  /** Défi PKCE, méthode S256 uniquement. */
  defiPkce: string;
  portee: string;
  expireLe: string;
  consommeLe?: string;
}

export interface JetonRafraichissement {
  /** SHA-256 du jeton. Le jeton lui-même n'est jamais stocké. */
  empreinte: string;
  /** Chaîne de rotation : réutiliser un maillon révoque toute la famille. */
  famille: string;
  compteId: string;
  clientId: string;
  portee: string;
  emisLe: string;
  expireLe: string;
  utiliseLe?: string;
  revoqueLe?: string;
}

export interface DepotOAuth {
  comptes: {
    parCourriel(courriel: string): Promise<Compte | undefined>;
    parId(id: string): Promise<Compte | undefined>;
    enregistrer(compte: Compte): Promise<void>;
  };
  codes: {
    parCode(code: string): Promise<CodeAutorisation | undefined>;
    enregistrer(code: CodeAutorisation): Promise<void>;
  };
  rafraichissements: {
    parEmpreinte(empreinte: string): Promise<JetonRafraichissement | undefined>;
    enregistrer(jeton: JetonRafraichissement): Promise<void>;
    revoquerLaFamille(famille: string, quand: string): Promise<void>;
  };
  reinitialisations: {
    parEmpreinte(empreinte: string): Promise<DemandeReinitialisation | undefined>;
    enregistrer(demande: DemandeReinitialisation): Promise<void>;
    /** Invalide les demandes en cours d'un compte : une seule à la fois. */
    invaliderPour(compteId: string, quand: string): Promise<void>;
  };
  revocations: {
    revoquer(jti: string, expireLe: string): Promise<void>;
    estRevoque(jti: string): Promise<boolean>;
  };
}
