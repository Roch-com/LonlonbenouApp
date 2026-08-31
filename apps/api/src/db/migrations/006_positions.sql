-- Pôle ① — position partagée, scellée (§8.2 et §9.5 du cahier).
--
-- Une seule ligne par personne, écrasée à chaque relevé. Le cahier autorise
-- trente jours d'historique de position précise ; n'en garder aucun est plus
-- simple et va dans le même sens. Un historique de positions dit les horaires
-- de travail, les rendez-vous médicaux et les détours du soir — c'est ce que
-- la rétention limitée cherche à borner, et ne rien garder le borne mieux.
--
-- `position_scellee` est une enveloppe `m1.<nonce>.<scellé>` : le serveur ne
-- sait ni où se trouve la personne, ni à quelle distance de l'autre. Toute la
-- géométrie se calcule sur les téléphones, après ouverture.
CREATE TABLE IF NOT EXISTS positions (
  couple_id        TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id    TEXT        NOT NULL,
  position_scellee TEXT        NOT NULL CHECK (position_scellee LIKE 'm1.%'),
  maj_le           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couple_id, partenaire_id)
);
