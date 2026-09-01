-- Pôle ④ — Complicité & connexion : langages de l'amour (§8.14).
--
-- Une ligne par personne. Le questionnaire lui-même vit dans le code, comme
-- les parcours : c'est du contenu éditorial, versionné avec l'application.
--
-- ## Pourquoi les choix ne sont pas scellés
--
-- C'est le seul endroit du pôle ② / ④ où le contenu est en clair, et c'est un
-- arbitrage assumé.
--
-- La règle du miroir — le résultat de l'autre ne s'ouvre qu'une fois les deux
-- questionnaires terminés — n'a de valeur que si le serveur peut vérifier
-- lui-même qu'un questionnaire est complet. Scellé, il devrait croire un
-- indicateur fourni par le client, qu'un client modifié poserait à volonté
-- pour ouvrir le résultat d'en face sans avoir répondu. On préfère un serveur
-- qui applique la règle à un serveur qui l'espère.
--
-- Ce qui est stocké n'est pas du texte libre : quinze arbitrages « a » ou « b »
-- sur des propositions publiques, sans aucune saisie de la personne. La
-- dissociation les efface comme le reste.
CREATE TABLE IF NOT EXISTS reponses_langages (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  choix         JSONB       NOT NULL,
  maj_le        TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (couple_id, partenaire_id)
);
