-- Pôle ① — notes vocales (§8.3).
--
-- ## Pourquoi la voix va en base et pas la photo
--
-- Trente secondes d'Opus pèsent une centaine de kilo-octets. Mille notes
-- vocales tiennent dans une centaine de méga-octets, ce que la base absorbe
-- sans peine — là où quelques vidéos la rempliraient à elles seules.
--
-- C'est ce qui permet de livrer la voix sans attendre le stockage d'objets
-- dont les photos auront besoin. Le plafond de durée n'est donc pas un
-- confort d'interface : c'est lui qui rend ce calcul vrai, et le service le
-- fait respecter.
--
-- ## Ce que le serveur détient
--
-- `audio_scelle` est une enveloppe, comme le texte des messages : chiffrée sur
-- le téléphone, illisible ici. `duree_s` reste en clair pour que l'interface
-- dessine la barre sans avoir à déchiffrer chaque note, y compris celles qu'on
-- ne va pas écouter. Une durée seule ne dit rien de ce qui est dit.
--
-- Une ligne par message, et seulement pour les messages qui en portent une :
-- la table reste vide pour une conversation qui n'en a jamais échangé.
CREATE TABLE IF NOT EXISTS notes_vocales (
  message_id   TEXT     PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  audio_scelle TEXT     NOT NULL CHECK (audio_scelle LIKE 'm1.%'),
  -- Le plafond du modèle partagé, rappelé ici : une enveloppe de plusieurs
  -- méga-octets passerait la contrainte de forme mais pas celle de durée.
  duree_s      SMALLINT NOT NULL CHECK (duree_s >= 1 AND duree_s <= 120)
);
