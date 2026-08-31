-- Pôle ③ — Finances partagées (§8.11).
--
-- Le §8.11 exige qu'aucune donnée financière ne soit stockée sans chiffrement
-- renforcé. `contenu_scelle` porte donc le libellé, le montant, la catégorie
-- et qui a avancé l'argent : le serveur ne sait ni combien le couple dépense,
-- ni en quoi, ni qui paie. Il achemine et il range.
--
-- Conséquence directe : aucun total ne se calcule ici. L'équilibre, les
-- répartitions et les budgets se calculent sur les téléphones, après
-- ouverture. C'est le même compromis que pour la position, et il vaut d'être
-- payé pour le sujet sur lequel les couples se déchirent le plus.
--
-- `jour` reste en clair, comme pour les souvenirs : regrouper par mois sans
-- ouvrir chaque enveloppe n'est possible qu'à ce prix. Une date seule dit
-- qu'il y a eu une dépense ce jour-là, sans dire laquelle ni combien.
CREATE TABLE IF NOT EXISTS depenses (
  id             TEXT PRIMARY KEY,
  couple_id      TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  jour           DATE        NOT NULL,
  contenu_scelle TEXT        NOT NULL CHECK (contenu_scelle LIKE 'm1.%'),
  cree_par       TEXT        NOT NULL,
  cree_le        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS depenses_couple_jour
  ON depenses (couple_id, jour DESC);

-- Réglages du module : une ligne par couple.
--
-- `actif` répond à l'exigence du §8.11 (« entièrement optionnelle et
-- désactivable »). Les parts de répartition sont scellées : elles se déduisent
-- des revenus de chacun, ce qui est au moins aussi sensible que les dépenses.
CREATE TABLE IF NOT EXISTS reglages_finances (
  couple_id      TEXT PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  actif          BOOLEAN     NOT NULL DEFAULT false,
  devise         TEXT        NOT NULL DEFAULT 'XOF',
  regles_scelles TEXT        CHECK (regles_scelles IS NULL OR regles_scelles LIKE 'm1.%'),
  maj_le         TIMESTAMPTZ NOT NULL
);
