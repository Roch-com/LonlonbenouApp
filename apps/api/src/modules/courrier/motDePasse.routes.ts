import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  LONGUEUR_CODE,
  LONGUEUR_MOT_DE_PASSE_MIN,
  codeDepuisAlea,
  expirationReinitialisation,
  formaterCode,
  motDePasseAcceptable,
  normaliserCode,
  verifierLaDemande,
} from '@lonlonbenu/shared';
import type { DepotOAuth } from '../../securite/oauth/depotOAuth.ts';
import type { ServeurAutorisation } from '../../securite/oauth/serveurAutorisation.ts';
import type { Courrier } from './courrier.ts';

/** Le code n'est jamais conservé : seule son empreinte l'est. */
function empreinteDe(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Comparaison à temps constant, pour ne rien apprendre par la durée. */
function memeEmpreinte(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

function corpsDuCourriel(code: string): string {
  return [
    'Vous avez demandé à choisir un nouveau mot de passe pour LONLONBENU.',
    '',
    `Votre code : ${formaterCode(code)}`,
    '',
    'Il est valable trente minutes et ne sert qu’une fois.',
    '',
    'Si cette demande ne vient pas de vous, il n’y a rien à faire : sans ce',
    'code, personne ne peut changer votre mot de passe. Votre compte n’a pas',
    'été touché.',
  ].join('\n');
}

export function enregistrerRoutesMotDePasse(
  app: FastifyInstance,
  autorisation: ServeurAutorisation,
  depotOAuth: DepotOAuth,
  courrier: Courrier,
): void {
  /**
   * Demande de réinitialisation.
   *
   * **Répond toujours 202**, que le compte existe ou non. Distinguer les deux
   * cas transformerait cette route en outil pour savoir qui possède un compte —
   * et sur une application de couple, cette seule information en dit déjà trop.
   */
  app.post('/mot-de-passe/demandes', async (requete, reponse) => {
    const corps = requete.body as { courriel?: string };
    if (!corps?.courriel) {
      return reponse.code(400).send({ motif: 'champs_manquants' });
    }

    const compte = await depotOAuth.comptes.parCourriel(
      corps.courriel.trim().toLowerCase(),
    );

    if (compte) {
      const maintenant = new Date().toISOString();
      // Une seule demande valable à la fois : sans cela, plusieurs codes
      // circuleraient en parallèle et le plus ancien resterait ouvert.
      await depotOAuth.reinitialisations.invaliderPour(compte.id, maintenant);

      const code = codeDepuisAlea(randomBytes(LONGUEUR_CODE));
      await depotOAuth.reinitialisations.enregistrer({
        empreinte: empreinteDe(code),
        compteId: compte.id,
        demandeeLe: maintenant,
        expireLe: expirationReinitialisation(maintenant),
        essais: 0,
      });

      try {
        await courrier.envoyer({
          destinataire: compte.courriel,
          sujet: 'Votre code LONLONBENU',
          corps: corpsDuCourriel(code),
        });
      } catch (erreur) {
        // L'échec d'envoi est journalisé mais ne change pas la réponse : la
        // révéler dirait à l'appelant que le compte existe.
        requete.log.error({ err: erreur }, 'code de réinitialisation non expédié');
      }
    }

    return reponse.code(202).send({
      message:
        'Si un compte existe avec cette adresse, un code vient d’y être envoyé.',
    });
  });

  /** Confirmation : le code, puis le nouveau mot de passe. */
  app.post('/mot-de-passe/reinitialisations', async (requete, reponse) => {
    const corps = requete.body as {
      code?: string;
      motDePasse?: string;
    };
    if (!corps?.code || !corps.motDePasse) {
      return reponse.code(400).send({ motif: 'champs_manquants' });
    }

    if (!motDePasseAcceptable(corps.motDePasse)) {
      return reponse.code(400).send({
        motif: 'mot_de_passe_trop_court',
        message: `${LONGUEUR_MOT_DE_PASSE_MIN} caractères au minimum — c’est ce qui protège tout le reste.`,
      });
    }

    const empreinte = empreinteDe(normaliserCode(corps.code));
    const demande = await depotOAuth.reinitialisations.parEmpreinte(empreinte);

    const verdict = verifierLaDemande(
      demande,
      demande ? memeEmpreinte(demande.empreinte, empreinte) : false,
    );

    if (!verdict.ok) {
      // Chaque échec compte, y compris sur une demande qu'on vient de trouver :
      // c'est ce qui borne la recherche exhaustive.
      if (demande && verdict.motif === 'code_incorrect') {
        await depotOAuth.reinitialisations.enregistrer({
          ...demande,
          essais: demande.essais + 1,
        });
      }
      return reponse.code(400).send({
        motif: verdict.motif,
        message:
          verdict.motif === 'expiree'
            ? 'Ce code a expiré. Demandez-en un nouveau.'
            : verdict.motif === 'trop_d_essais'
              ? 'Trop de tentatives sur ce code. Demandez-en un nouveau.'
              : 'Ce code ne correspond pas. Vérifiez-le, ou demandez-en un nouveau.',
      });
    }

    const remplace = await autorisation.remplacerLeMotDePasse(
      demande!.compteId,
      corps.motDePasse,
    );
    if (!remplace) {
      return reponse.code(410).send({ motif: 'compte_absent' });
    }

    await depotOAuth.reinitialisations.enregistrer({
      ...demande!,
      utiliseeLe: new Date().toISOString(),
    });

    return reponse.code(200).send({
      message: 'Mot de passe changé. Vous pouvez vous connecter.',
    });
  });
}
