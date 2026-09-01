-- Pôle ② — importance et progrès reconnus sur les axes (§8.5).
--
-- Deux exigences du §8.5 restées de côté : « niveau d'importance » à
-- l'ouverture d'une carte, et le statut « progrès reconnu » que l'autre est le
-- seul à pouvoir poser.
--
-- Le troisième point du §8.5 — la limite de cartes actives simultanées — ne
-- s'écrit pas ici. Une contrainte SQL ne saurait pas dire *pourquoi* elle
-- refuse, et le refus doit s'accompagner d'une phrase qui invite à refermer ce
-- qui a avancé plutôt que d'annoncer un quota. Le service s'en charge.

-- Nullable, avec une lecture par défaut côté code : les axes déjà ouverts
-- n'ont pas eu à choisir, et leur inventer une importance rétroactivement
-- ferait dire à leur auteur quelque chose qu'il n'a pas dit.
ALTER TABLE axes ADD COLUMN IF NOT EXISTS importance TEXT
  CHECK (importance IS NULL OR importance IN ('douce', 'moyenne', 'forte'));

-- Un progrès reconnu par personne et par axe. La clé primaire l'impose : on
-- reconnaît un progrès, on ne le reconnaît pas deux fois.
--
-- Le texte n'est pas stocké parce qu'il n'y en a pas : reconnaître un progrès
-- est un geste, pas un commentaire. Y adjoindre un champ libre rouvrirait la
-- porte au « oui mais » que tout le module cherche à éviter.
CREATE TABLE IF NOT EXISTS reconnaissances_axe (
  axe_id        TEXT        NOT NULL REFERENCES axes(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  le            TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (axe_id, partenaire_id)
);
