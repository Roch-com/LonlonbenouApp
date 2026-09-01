import type { FastifyInstance } from 'fastify';
import type { Depot } from '../../domaine/depot.ts';
import type {
  MotifOAuth,
  ServeurAutorisation,
} from '../../securite/oauth/serveurAutorisation.ts';

/** Correspondance motif → couple (code HTTP, code d'erreur OAuth2 du RFC 6749). */
const ERREURS: Record<MotifOAuth, { statut: number; erreur: string }> = {
  identifiants_invalides: { statut: 401, erreur: 'invalid_grant' },
  client_inconnu: { statut: 401, erreur: 'invalid_client' },
  code_invalide: { statut: 400, erreur: 'invalid_grant' },
  code_expire: { statut: 400, erreur: 'invalid_grant' },
  code_deja_utilise: { statut: 400, erreur: 'invalid_grant' },
  pkce_invalide: { statut: 400, erreur: 'invalid_grant' },
  rafraichissement_invalide: { statut: 400, erreur: 'invalid_grant' },
  rafraichissement_reutilise: { statut: 400, erreur: 'invalid_grant' },
  rafraichissement_expire: { statut: 400, erreur: 'invalid_grant' },
};

export function enregistrerRoutesOAuth(
  app: FastifyInstance,
  autorisation: ServeurAutorisation,
  depot: Depot,
): void {
  /** Clé publique de vérification, pour tout service qui aurait à valider un jeton. */
  app.get('/.well-known/jwks.json', async () => autorisation.jwks());

  /**
   * Création de compte. Elle n'appartient pas à OAuth2 à proprement parler,
   * mais sans elle il n'y a personne à authentifier. À remplacer par une
   * fédération (Apple, Google) le jour où elle sera branchée.
   */
  app.post('/comptes', async (requete, reponse) => {
    const corps = requete.body as { courriel?: string; motDePasse?: string };
    if (!corps?.courriel || !corps.motDePasse) {
      return reponse.code(400).send({ erreur: 'invalid_request' });
    }
    if (corps.motDePasse.length < 10) {
      return reponse.code(400).send({
        erreur: 'invalid_request',
        message: 'Dix caractères au minimum — c’est ce qui protège tout le reste.',
      });
    }

    // Un courriel déjà pris n'est pas une panne : c'est le cas le plus banal
    // qui soit, et il doit se dire. Sans ce contrôle, la contrainte d'unicité
    // de la base remontait en 500, avec son nom en clair dans la réponse — et
    // la personne, devant un « le serveur n'a pas pu répondre », n'avait aucun
    // moyen de deviner qu'il lui suffisait de se connecter.
    if (await autorisation.compteExiste(corps.courriel)) {
      return reponse.code(409).send({
        motif: 'courriel_deja_pris',
        message: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
      });
    }

    const compte = await autorisation.creerCompte(corps.courriel, corps.motDePasse);
    return reponse
      .code(201)
      .send({ partenaireId: compte.id, courriel: compte.courriel });
  });

  /**
   * Étape 1 du flux Authorization Code + PKCE. Le client mobile ne pouvant
   * garder aucun secret, c'est le vérificateur PKCE qui lie le code à
   * l'appareil qui l'a demandé.
   */
  app.post('/oauth/authorize', async (requete, reponse) => {
    const corps = requete.body as {
      courriel?: string;
      motDePasse?: string;
      client_id?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      scope?: string;
    };

    if (
      !corps?.courriel ||
      !corps.motDePasse ||
      !corps.client_id ||
      !corps.code_challenge
    ) {
      return reponse.code(400).send({ erreur: 'invalid_request' });
    }
    if ((corps.code_challenge_method ?? 'S256') !== 'S256') {
      return reponse
        .code(400)
        .send({ erreur: 'invalid_request', message: 'Seul S256 est accepté.' });
    }

    const resultat = await autorisation.autoriser({
      courriel: corps.courriel,
      motDePasse: corps.motDePasse,
      clientId: corps.client_id,
      defiPkce: corps.code_challenge,
      portee: corps.scope,
    });

    if (!resultat.ok) {
      const { statut, erreur } = ERREURS[resultat.motif];
      return reponse.code(statut).send({ erreur, motif: resultat.motif });
    }
    return reponse.code(201).send({ code: resultat.code });
  });

  /** Étape 2, et rotation des jetons de rafraîchissement. */
  app.post('/oauth/token', async (requete, reponse) => {
    const corps = requete.body as {
      grant_type?: string;
      code?: string;
      code_verifier?: string;
      refresh_token?: string;
      client_id?: string;
    };
    if (!corps?.client_id) {
      return reponse.code(400).send({ erreur: 'invalid_request' });
    }

    if (corps.grant_type === 'authorization_code') {
      if (!corps.code || !corps.code_verifier) {
        return reponse.code(400).send({ erreur: 'invalid_request' });
      }
      const resultat = await autorisation.echangerLeCode({
        code: corps.code,
        verificateurPkce: corps.code_verifier,
        clientId: corps.client_id,
      });
      if (!resultat.ok) {
        const { statut, erreur } = ERREURS[resultat.motif];
        return reponse.code(statut).send({ erreur, motif: resultat.motif });
      }
      return resultat.jetons;
    }

    if (corps.grant_type === 'refresh_token') {
      if (!corps.refresh_token) {
        return reponse.code(400).send({ erreur: 'invalid_request' });
      }
      const resultat = await autorisation.rafraichir({
        refreshToken: corps.refresh_token,
        clientId: corps.client_id,
      });
      if (!resultat.ok) {
        const { statut, erreur } = ERREURS[resultat.motif];
        return reponse.code(statut).send({ erreur, motif: resultat.motif });
      }
      return resultat.jetons;
    }

    return reponse.code(400).send({ erreur: 'unsupported_grant_type' });
  });

  /** Déconnexion : le jeton d'accès courant et toute la famille de rotation. */
  app.post('/oauth/revoke', async (requete, reponse) => {
    const entete = requete.headers.authorization;
    const jeton = entete?.startsWith('Bearer ')
      ? entete.slice(7).trim()
      : undefined;
    const charge = jeton ? await autorisation.verifierAcces(jeton) : undefined;
    if (!charge) return reponse.code(401).send({ erreur: 'invalid_token' });

    const corps = requete.body as { refresh_token?: string } | undefined;
    await autorisation.revoquer(charge.jti, corps?.refresh_token);
    return reponse.code(204).send();
  });

  /** Qui suis-je, et de quel couple — utile au démarrage de l'app mobile. */
  app.get('/moi', async (requete, reponse) => {
    const entete = requete.headers.authorization;
    const jeton = entete?.startsWith('Bearer ')
      ? entete.slice(7).trim()
      : undefined;
    const charge = jeton ? await autorisation.verifierAcces(jeton) : undefined;
    if (!charge) return reponse.code(401).send({ motif: 'non_authentifie' });

    const couple = await depot.couples.parPartenaire(charge.partenaireId);
    const actif = couple && !couple.dissocieLe ? couple : undefined;

    return {
      partenaireId: charge.partenaireId,
      coupleId: actif?.id,
      // Le mobile affichait jusqu'ici une date de démonstration codée en dur,
      // faute de connaître celle du couple. Les prénoms suivent : ils viennent
      // de l'appairage, et chaque appareil les redemandait à l'autre.
      depuis: actif?.couple.depuis,
      // Le nom que le couple donne à son espace (§8.18). Absent tant qu'il n'en
      // a pas choisi : l'écran décide alors de ce qu'il affiche à la place.
      nomEspace: actif?.couple.nomEspace,
      partenaires: actif?.couple.partenaires.map((p) => ({
        id: p.id,
        prenom: p.prenom,
        initiales: p.initiales,
      })),
    };
  });
}
