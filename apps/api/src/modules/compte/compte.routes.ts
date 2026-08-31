import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ServiceCompte } from './compte.service.ts';

export function enregistrerRoutesCompte(
  app: FastifyInstance,
  compte: ServiceCompte,
  authentifier: preHandlerHookHandler,
): void {
  /**
   * Portabilité (RGPD). Rend tout ce que la personne a le droit de lire, dans
   * un JSON qu'un autre outil peut reprendre — pas une capture d'écran, pas un
   * PDF : un format qu'on peut réellement réutiliser ailleurs.
   */
  app.get(
    '/moi/export',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const resultat = await compte.exporter(requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse.code(404).send({ motif: resultat.motif });
      }
      return resultat.donnees;
    },
  );

  /**
   * Droit à l'effacement. La double confirmation est demandée par l'interface ;
   * le serveur, lui, exige que le corps porte l'intention en toutes lettres —
   * une requête `DELETE` déclenchée par erreur ne doit pas suffire.
   */
  app.delete('/moi', { preHandler: authentifier }, async (requete, reponse) => {
    const corps = (requete.body ?? {}) as { confirmation?: string };
    if (corps.confirmation !== 'SUPPRIMER') {
      return reponse.code(400).send({ motif: 'confirmation_manquante' });
    }

    const resultat = await compte.supprimer(requete.identite!.partenaireId);
    if (!resultat.ok) {
      return reponse.code(404).send({ motif: resultat.motif });
    }
    return reponse.code(204).send();
  });
}
