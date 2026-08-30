-- Pôle ① — Signal d'activité : « en ligne », « vu il y a… », « écrit… ».
--
-- Une ligne par personne et par couple, écrasée à chaque battement. On ne
-- garde aucun historique : une liste des connexions de la journée dirait qui
-- dort mal, qui travaille tard, qui ouvre l'app trente fois — ce ne serait
-- plus de la présence mais de la surveillance.
--
-- `saisit_jusqua` est une échéance et non un booléen : un « il écrit » posé à
-- vrai le resterait pour toujours si l'appareil se tait, alors qu'une échéance
-- s'éteint d'elle-même.
CREATE TABLE IF NOT EXISTS activite (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  vu_le         TIMESTAMPTZ NOT NULL,
  saisit_jusqua TIMESTAMPTZ,
  PRIMARY KEY (couple_id, partenaire_id)
);
