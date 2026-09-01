-- Pôle ② — Parcours guidé du couple (§8.7).
--
-- Trois tables, parce que trois choses distinctes se conservent : le fait
-- qu'un parcours soit engagé, l'avancement d'une séance, et les réponses.
--
-- `parcours_id` et `seance_id` renvoient au catalogue, qui vit dans le code et
-- non en base : c'est du contenu éditorial versionné avec l'application, pas
-- une donnée du couple. Aucune clé étrangère ne peut donc les contraindre —
-- le service vérifie leur existence avant d'écrire.
--
-- `texte_scelle` est une enveloppe, comme partout dans le pôle ② : le serveur
-- achemine sans lire. Il applique en revanche la règle du miroir, et c'est
-- pour cela qu'il a besoin de savoir *qu'une* réponse existe.

CREATE TABLE IF NOT EXISTS parcours_engages (
  couple_id   TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  parcours_id TEXT        NOT NULL,
  commence_le TIMESTAMPTZ NOT NULL,
  termine_le  TIMESTAMPTZ,
  PRIMARY KEY (couple_id, parcours_id)
);

-- Une ligne par séance entamée. `echange_le` porte le temps « ensemble » :
-- tant qu'il est nul, la séance n'est pas terminée et le parcours n'avance pas.
CREATE TABLE IF NOT EXISTS parcours_avancees (
  couple_id   TEXT NOT NULL,
  parcours_id TEXT NOT NULL,
  seance_id   TEXT NOT NULL,
  echange_le  TIMESTAMPTZ,
  PRIMARY KEY (couple_id, parcours_id, seance_id),
  FOREIGN KEY (couple_id, parcours_id)
    REFERENCES parcours_engages (couple_id, parcours_id) ON DELETE CASCADE
);

-- Une réponse par personne et par séance. La clé primaire l'impose : on ne
-- réécrit pas une réponse, sinon on pourrait la corriger après avoir lu celle
-- de l'autre, ce que tout le module cherche à empêcher.
CREATE TABLE IF NOT EXISTS parcours_reponses (
  couple_id     TEXT        NOT NULL,
  parcours_id   TEXT        NOT NULL,
  seance_id     TEXT        NOT NULL,
  partenaire_id TEXT        NOT NULL,
  texte_scelle  TEXT        NOT NULL CHECK (texte_scelle LIKE 'm1.%'),
  fait_le       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couple_id, parcours_id, seance_id, partenaire_id),
  FOREIGN KEY (couple_id, parcours_id, seance_id)
    REFERENCES parcours_avancees (couple_id, parcours_id, seance_id)
    ON DELETE CASCADE
);
