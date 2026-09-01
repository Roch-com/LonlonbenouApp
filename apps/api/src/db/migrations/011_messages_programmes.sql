-- Pôle ① — messages programmés et capsules temporelles (§8.3).
--
-- Un message déposé maintenant, remis plus tard. `remettreLe` porte cette
-- date ; tant qu'elle n'est pas atteinte, le message n'apparaît dans aucune
-- conversation — pas même celle de son auteur, qui le retrouve dans une liste
-- séparée où il peut encore l'annuler.
--
-- La colonne est nullable : un message ordinaire n'en porte pas, et le
-- filtrage se réduit alors à « remettre_le IS NULL OR remettre_le <= now() ».
--
-- Comme ailleurs, seule la date est en clair. Le serveur sait qu'un message
-- attend, jamais ce qu'il dit.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS remettre_le TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS messages_programmes
  ON messages (couple_id, remettre_le)
  WHERE remettre_le IS NOT NULL;
