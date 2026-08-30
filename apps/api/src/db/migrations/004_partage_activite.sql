-- Le module « activite » doit passer la contrainte de `partages`.
--
-- La liste des modules sensibles vit à deux endroits : l'union TypeScript
-- `ModuleSensible` et cette contrainte. Ajouter un module sans toucher la
-- seconde compile, passe les tests en mémoire — qui n'ont aucune contrainte —
-- et n'échoue qu'à la première écriture réelle, sur le téléphone de quelqu'un.
--
-- La contrainte reste malgré tout : elle est ce qui empêche une faute de
-- frappe dans un nom de module de créer un partage fantôme que plus aucun
-- écran ne saurait afficher ni éteindre.
ALTER TABLE partages DROP CONSTRAINT IF EXISTS partages_module_check;

ALTER TABLE partages ADD CONSTRAINT partages_module_check
  CHECK (module IN ('position','cycle','croissance','score','confidences','activite'));
