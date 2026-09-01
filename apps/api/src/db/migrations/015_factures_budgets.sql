-- Pôle ③ — Finances : factures récurrentes et budgets de projet (§8.11).
--
-- Deux manques du §8.11 : « budget partagé par projet (relié au module
-- Projets) » et « rappels de factures communes ».
--
-- Même règle que `depenses` : tout ce qui chiffre est scellé, seules les dates
-- restent en clair. Sans échéance lisible le planificateur ne saurait pas quand
-- rappeler ; avec le libellé en clair, on aurait troqué l'exigence de
-- chiffrement du §8.11 contre une notification plus jolie.
--
-- Conséquence assumée : le rappel dit qu'une échéance approche, jamais
-- laquelle. L'application la montre une fois ouverte.
CREATE TABLE IF NOT EXISTS factures (
  id                TEXT PRIMARY KEY,
  couple_id         TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  premiere_echeance DATE        NOT NULL,
  periodicite       TEXT        NOT NULL
                    CHECK (periodicite IN ('mensuelle', 'trimestrielle', 'annuelle')),
  contenu_scelle    TEXT        NOT NULL CHECK (contenu_scelle LIKE 'm1.%'),
  cree_par          TEXT        NOT NULL,
  cree_le           TIMESTAMPTZ NOT NULL,
  -- Arrêtée plutôt que supprimée : des dépenses passées y renvoient, et les
  -- effacer les rendrait orphelines.
  arretee_le        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS factures_couple_actives
  ON factures (couple_id)
  WHERE arretee_le IS NULL;

-- Une enveloppe par projet. Le montant est scellé comme le reste : le serveur
-- range un budget, il n'en connaît pas la hauteur.
--
-- Pas de clé étrangère vers `projets` : le projet peut être un projet surprise
-- que seul son auteur voit, et la contrainte ferait fuir son existence par
-- l'erreur qu'elle renverrait.
CREATE TABLE IF NOT EXISTS budgets_projet (
  couple_id      TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  projet_id      TEXT        NOT NULL,
  montant_scelle TEXT        NOT NULL CHECK (montant_scelle LIKE 'm1.%'),
  maj_le         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couple_id, projet_id)
);
