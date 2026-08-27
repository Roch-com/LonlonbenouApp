import type {
  CodeAutorisation,
  Compte,
  DepotOAuth,
  JetonRafraichissement,
} from './depotOAuth.ts';

export function creerDepotOAuthMemoire(): DepotOAuth {
  const comptes = new Map<string, Compte>();
  const codes = new Map<string, CodeAutorisation>();
  const rafraichissements = new Map<string, JetonRafraichissement>();
  const revoques = new Map<string, string>();

  const copie = <T>(v: T): T => structuredClone(v);

  return {
    comptes: {
      async parCourriel(courriel) {
        for (const compte of comptes.values()) {
          if (compte.courriel === courriel.toLowerCase()) return copie(compte);
        }
        return undefined;
      },
      async parId(id) {
        const trouve = comptes.get(id);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(compte) {
        comptes.set(compte.id, copie(compte));
      },
    },
    codes: {
      async parCode(code) {
        const trouve = codes.get(code);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(code) {
        codes.set(code.code, copie(code));
      },
    },
    rafraichissements: {
      async parEmpreinte(empreinte) {
        const trouve = rafraichissements.get(empreinte);
        return trouve ? copie(trouve) : undefined;
      },
      async enregistrer(jeton) {
        rafraichissements.set(jeton.empreinte, copie(jeton));
      },
      async revoquerLaFamille(famille, quand) {
        for (const jeton of rafraichissements.values()) {
          if (jeton.famille === famille && !jeton.revoqueLe)
            jeton.revoqueLe = quand;
        }
      },
    },
    revocations: {
      async revoquer(jti, expireLe) {
        revoques.set(jti, expireLe);
      },
      async estRevoque(jti) {
        return revoques.has(jti);
      },
    },
  };
}
