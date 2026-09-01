-- Pôle ③ — catégorie de projet et jalons assignables (§8.10).
--
-- « Création de projets avec titre, catégorie, échéance, budget prévisionnel,
--   image de couverture » et « jalons assignables à l'un, l'autre ou aux deux ».
--
-- Le budget prévisionnel est déjà couvert par `budgets_projet` (migration
-- 015). L'image de couverture ne l'est pas : elle demande un stockage de
-- médias que le projet n'a pas encore, et c'est le même blocage que les
-- photos de l'album.

-- Nullable : les projets déjà créés n'ont pas eu à choisir, et leur attribuer
-- une catégorie rétroactivement ferait dire à leur auteur ce qu'il n'a pas dit.
ALTER TABLE projets ADD COLUMN IF NOT EXISTS categorie TEXT;

-- À qui revient le jalon. `NULL` signifie « aux deux » — c'est le cas le plus
-- fréquent dans un projet de couple, et en faire le défaut évite de demander
-- un arbitrage à chaque ligne.
--
-- Volontairement sans clé étrangère vers `partenaires` : une dissociation
-- efface les partenaires, et une contrainte ferait alors échouer la
-- suppression du couple au lieu de la laisser aller au bout.
ALTER TABLE jalons ADD COLUMN IF NOT EXISTS assigne_a TEXT;
