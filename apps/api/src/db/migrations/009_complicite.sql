-- Pôle ② — questions de complicité (§8.6).
--
-- Une réponse par personne et par jour. La question elle-même n'est pas
-- stockée : elle se dérive de la date, identiquement des deux côtés, ce qui
-- évite qu'un tirage au sort fasse répondre chacun à une question différente.
--
-- `texte_scelle` est une enveloppe : le serveur achemine sans lire, comme pour
-- le reste du pôle ②. Il applique en revanche la règle du miroir — la réponse
-- de l'autre ne sort pas tant que les deux n'ont pas répondu.
CREATE TABLE IF NOT EXISTS reponses_complicite (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  jour          DATE        NOT NULL,
  partenaire_id TEXT        NOT NULL,
  texte_scelle  TEXT        NOT NULL CHECK (texte_scelle LIKE 'm1.%'),
  repondu_le    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couple_id, jour, partenaire_id)
);
