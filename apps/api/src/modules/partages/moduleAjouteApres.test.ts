/**
 * Un module sensible ajouté après l'appairage doit rester activable.
 *
 * Cas réel : le couple pilote, appairé avant l'existence du module `activite`,
 * ne pouvait pas l'activer. L'interrupteur s'affichait — la liste des libellés
 * vit côté mobile — mais restait grisé, faute d'état renvoyé par le serveur ;
 * et une bascule forcée répondait « module_inconnu ».
 */
import { describe, expect, it } from 'vitest';
import { MODULES_SENSIBLES } from '../../domaine/depot.ts';
import {
  COUPLE_ID,
  entete,
  GAELLE,
  monterServeur,
  ROCHAMBEAU,
} from '../../tests/aide.ts';

type Serveur = Awaited<ReturnType<typeof monterServeur>>;

/** Remet le couple dans l'état d'avant l'ajout d'un module. */
async function oublierLeModule(
  { depot }: Serveur,
  module: string,
): Promise<void> {
  const enregistrement = await depot.couples.parId(COUPLE_ID);
  const partages = { ...enregistrement!.partages };
  delete partages[module];
  await depot.couples.enregistrer({ ...enregistrement!, partages });
}

const lister = (serveur: Serveur, qui: string) =>
  serveur.app.inject({
    method: 'GET',
    url: `/couples/${COUPLE_ID}/partages`,
    headers: entete(qui),
  });

const basculer = (serveur: Serveur, qui: string, module: string, actif: boolean) =>
  serveur.app.inject({
    method: 'PUT',
    url: `/couples/${COUPLE_ID}/partages/${module}`,
    headers: entete(qui),
    payload: { actif },
  });

describe('module ajouté après l’appairage', () => {
  it('apparaît dans la liste même sans enregistrement', async () => {
    const serveur = await monterServeur();
    await oublierLeModule(serveur, 'activite');

    const partages = (await lister(serveur, GAELLE)).json().partages;
    const active = partages.find(
      (p: { module: string }) => p.module === 'activite',
    );

    expect(active).toBeDefined();
    expect(active.actif).toBe(false);
    expect(active.monConsentement).toBe(false);
  });

  it('s’active malgré tout', async () => {
    const serveur = await monterServeur();
    await oublierLeModule(serveur, 'activite');

    const reponse = await basculer(serveur, GAELLE, 'activite', true);
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json().partage.monConsentement).toBe(true);
  });

  it('reste réciproque : un seul consentement ne suffit pas', async () => {
    const serveur = await monterServeur();
    await oublierLeModule(serveur, 'activite');

    await basculer(serveur, GAELLE, 'activite', true);
    expect((await lister(serveur, GAELLE)).json().partages
      .find((p: { module: string }) => p.module === 'activite').actif).toBe(false);

    await basculer(serveur, ROCHAMBEAU, 'activite', true);
    expect((await lister(serveur, GAELLE)).json().partages
      .find((p: { module: string }) => p.module === 'activite').actif).toBe(true);
  });

  it('rend tous les modules sensibles, sans exception', async () => {
    // La liste des modules fait autorité, pas ce qui est stocké.
    const serveur = await monterServeur();
    for (const module of MODULES_SENSIBLES) {
      await oublierLeModule(serveur, module);
    }

    const rendus = (await lister(serveur, GAELLE)).json().partages.map(
      (p: { module: string }) => p.module,
    );
    expect(rendus.sort()).toEqual([...MODULES_SENSIBLES].sort());
  });

  it('refuse toujours un module qui n’existe pas', async () => {
    const serveur = await monterServeur();
    const reponse = await basculer(serveur, GAELLE, 'telepathie', true);
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json().motif).toBe('module_inconnu');
  });
});
