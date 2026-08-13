import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type {
  CategorieEvenement,
  CategorieSortie,
} from '@lonlonbenu/shared';
import type { ServiceViePratique } from './viePratique.service.ts';

const CODES: Record<string, number> = {
  couple_introuvable: 404,
  introuvable: 404,
  non_membre: 403,
  couple_dissocie: 410,
  donnees_invalides: 400,
};

const repondre = (motif: string | undefined) => CODES[motif ?? ''] ?? 400;

export function enregistrerRoutesViePratique(
  app: FastifyInstance,
  service: ServiceViePratique,
  authentifier: preHandlerHookHandler,
): void {
  /** Tout le pôle en une lecture : les trois modules vont ensemble à l'écran. */
  app.get(
    '/couples/:coupleId/vie-pratique',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const resultat = await service.lire(coupleId, requete.identite!.partenaireId);
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return resultat.valeur;
    },
  );

  // ------------------------------------------------------------------ agenda

  app.post(
    '/couples/:coupleId/vie-pratique/evenements',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        titre?: string;
        categorie?: CategorieEvenement;
        debut?: string;
        fin?: string;
        journeeEntiere?: boolean;
        lieu?: string;
        note?: string;
        rappelHeures?: number;
      };
      if (!corps?.titre || !corps.categorie || !corps.debut) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await service.ajouterEvenement(
        coupleId,
        requete.identite!.partenaireId,
        {
          titre: corps.titre,
          categorie: corps.categorie,
          debut: corps.debut,
          fin: corps.fin,
          journeeEntiere: corps.journeeEntiere ?? false,
          lieu: corps.lieu,
          note: corps.note,
          rappelHeures: corps.rappelHeures,
        },
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ evenement: resultat.valeur });
    },
  );

  app.delete(
    '/couples/:coupleId/vie-pratique/evenements/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await service.supprimerEvenement(
        coupleId,
        requete.identite!.partenaireId,
        id,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );

  // ----------------------------------------------------------------- projets

  app.post(
    '/couples/:coupleId/vie-pratique/projets',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as { titre?: string; intention?: string };
      if (!corps?.titre) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await service.creerProjet(
        coupleId,
        requete.identite!.partenaireId,
        corps.titre,
        corps.intention,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ projet: resultat.valeur });
    },
  );

  app.post(
    '/couples/:coupleId/vie-pratique/projets/:projetId/jalons',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, projetId } = requete.params as {
        coupleId: string;
        projetId: string;
      };
      const corps = requete.body as { titre?: string; echeance?: string };
      if (!corps?.titre) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await service.ajouterJalon(
        coupleId,
        requete.identite!.partenaireId,
        projetId,
        corps.titre,
        corps.echeance,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ projet: resultat.valeur });
    },
  );

  app.put(
    '/couples/:coupleId/vie-pratique/projets/:projetId/jalons/:jalonId',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, projetId, jalonId } = requete.params as {
        coupleId: string;
        projetId: string;
        jalonId: string;
      };
      const resultat = await service.cocherJalon(
        coupleId,
        requete.identite!.partenaireId,
        projetId,
        jalonId,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return { projet: resultat.valeur };
    },
  );

  app.put(
    '/couples/:coupleId/vie-pratique/projets/:projetId/archive',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, projetId } = requete.params as {
        coupleId: string;
        projetId: string;
      };
      const corps = requete.body as { archive?: boolean };
      if (typeof corps?.archive !== 'boolean') {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await service.archiverProjet(
        coupleId,
        requete.identite!.partenaireId,
        projetId,
        corps.archive,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return { projet: resultat.valeur };
    },
  );

  // ------------------------------------------------------------- initiatives

  app.post(
    '/couples/:coupleId/vie-pratique/initiatives',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId } = requete.params as { coupleId: string };
      const corps = requete.body as {
        titre?: string;
        categorie?: CategorieSortie;
      };
      if (!corps?.titre || !corps.categorie) {
        return reponse.code(400).send({ motif: 'champs_manquants' });
      }

      const resultat = await service.proposerInitiative(
        coupleId,
        requete.identite!.partenaireId,
        corps.titre,
        corps.categorie,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(201).send({ initiative: resultat.valeur });
    },
  );

  app.put(
    '/couples/:coupleId/vie-pratique/initiatives/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const corps = requete.body as {
        action?: 'programmer' | 'vivre';
        prevuePour?: string;
        souvenir?: string;
      };

      const moiId = requete.identite!.partenaireId;
      const resultat =
        corps?.action === 'programmer'
          ? await service.programmerInitiative(
              coupleId,
              moiId,
              id,
              corps.prevuePour ?? '',
            )
          : corps?.action === 'vivre'
            ? await service.vivreInitiative(coupleId, moiId, id, corps.souvenir)
            : { ok: false, motif: 'donnees_invalides' as const };

      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return { initiative: (resultat as { valeur?: unknown }).valeur };
    },
  );

  app.delete(
    '/couples/:coupleId/vie-pratique/initiatives/:id',
    { preHandler: authentifier },
    async (requete, reponse) => {
      const { coupleId, id } = requete.params as { coupleId: string; id: string };
      const resultat = await service.supprimerInitiative(
        coupleId,
        requete.identite!.partenaireId,
        id,
      );
      if (!resultat.ok) {
        return reponse.code(repondre(resultat.motif)).send({ motif: resultat.motif });
      }
      return reponse.code(204).send();
    },
  );
}
