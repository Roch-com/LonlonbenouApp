-- Pôle ④ — mode « désir d'enfant » (§8.13, P1).
--
-- Réglage de la personne concernée, comme le niveau de partage et la durée
-- annoncée : il vit donc sur la même ligne, et `estLaPorteuse` en garde
-- l'écriture. Le partenaire ne peut ni l'activer, ni le désactiver.
--
-- Il ne change rien à ce que l'autre voit : la projection reste celle que le
-- niveau autorise. Un mode qui ouvrirait des informations supplémentaires au
-- partenaire ferait d'un projet commun une attente surveillée.
ALTER TABLE cycle_partage ADD COLUMN IF NOT EXISTS desir_enfant BOOLEAN NOT NULL DEFAULT false;
