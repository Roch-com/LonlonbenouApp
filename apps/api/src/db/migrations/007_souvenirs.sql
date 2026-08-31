-- Pôle ⑤ — Souvenirs et Love Map (§8.15, §8.16).
--
-- Une seule table pour les deux modules : l'album et la carte des lieux ne
-- diffèrent que par la présence de coordonnées, qui vivent dans l'enveloppe.
-- En faire deux tables aurait dupliqué stockage, contrôle d'accès et
-- chiffrement pour distinguer ce qu'un champ facultatif distingue déjà.
--
-- `contenu_scelle` porte titre, note et coordonnées éventuelles. `jour` reste
-- en clair, et c'est un choix : « il y a un an » suppose de retrouver les
-- souvenirs d'une date sans les ouvrir, ce qu'aucune clé côté serveur ne
-- permettrait. Une date seule dit qu'il s'est passé quelque chose ce jour-là,
-- sans dire quoi ni où.
CREATE TABLE IF NOT EXISTS souvenirs (
  id             TEXT PRIMARY KEY,
  couple_id      TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sorte          TEXT        NOT NULL CHECK (sorte IN ('moment','lieu')),
  jour           DATE        NOT NULL,
  contenu_scelle TEXT        NOT NULL CHECK (contenu_scelle LIKE 'm1.%'),
  cree_par       TEXT        NOT NULL,
  cree_le        TIMESTAMPTZ NOT NULL
);

-- L'album se parcourt à rebours, et « il y a un an » interroge une date.
CREATE INDEX IF NOT EXISTS souvenirs_couple_jour
  ON souvenirs (couple_id, jour DESC);
