-- Réinitialisation de mot de passe.
--
-- Le code envoyé par courriel n'est jamais conservé : seule son empreinte
-- SHA-256 l'est. Quelqu'un qui lirait cette table n'y trouverait pas de quoi
-- prendre un compte, exactement comme pour les codes d'appairage.

CREATE TABLE IF NOT EXISTS reinitialisations (
  empreinte    TEXT PRIMARY KEY,
  compte_id    TEXT        NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  demandee_le  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le    TIMESTAMPTZ NOT NULL,
  utilisee_le  TIMESTAMPTZ,
  -- Compté par demande : c'est ce qui borne la recherche exhaustive une fois
  -- le code émis.
  essais       INTEGER     NOT NULL DEFAULT 0
);

-- Une personne ne doit pas accumuler les demandes en attente : on retrouve les
-- siennes pour invalider les précédentes à chaque nouvelle demande.
CREATE INDEX IF NOT EXISTS reinitialisations_compte
  ON reinitialisations (compte_id);
