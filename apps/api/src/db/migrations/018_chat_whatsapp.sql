-- Pôle ① — épingle, réactions et retrait d'un message (§8.3).
--
-- Trois gestes que tout le monde attend d'une messagerie, et qui manquaient.
--
-- ## Ce que le serveur apprend, et ce qu'il n'apprend pas
--
-- Il sait désormais qu'un message est épinglé, qu'il porte une réaction, ou
-- qu'il a été retiré. Il ne sait toujours ni ce que dit le message, ni quel
-- emoji a été choisi : la réaction est scellée comme le reste.
--
-- Sceller un emoji peut sembler excessif — il y en a peu, et un serveur
-- curieux les devinerait par recoupement. On le fait quand même : la règle
-- « tout ce qu'une personne écrit dans la conversation est scellé » vaut mieux
-- qu'une liste d'exceptions dont chacune se justifie séparément.

-- Un message retiré. Le serveur ne l'efface pas : la ligne reste, l'enveloppe
-- est vidée, et les deux voient « Ce message a été retiré » à sa place.
--
-- Effacer la ligne ferait disparaître un message du milieu d'une conversation
-- sans laisser de trace, et l'autre se demanderait s'il a rêvé.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS retire_le TIMESTAMPTZ;

-- Une réaction par personne et par message : la clé primaire l'impose, comme
-- dans les messageries qu'on connaît. Réagir à nouveau remplace.
CREATE TABLE IF NOT EXISTS reactions_message (
  message_id    TEXT        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  emoji_scelle  TEXT        NOT NULL CHECK (emoji_scelle LIKE 'm1.%'),
  maj_le        TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (message_id, partenaire_id)
);

-- Un seul message épinglé par couple.
--
-- Les messageries grand public en autorisent plusieurs ; à deux, un seul
-- suffit et évite d'avoir à choisir lequel décrocher. Épingler remplace, ce
-- qui est aussi la manière la plus simple de changer d'avis.
CREATE TABLE IF NOT EXISTS epingle_conversation (
  couple_id    TEXT        PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  message_id   TEXT        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  epingle_par  TEXT        NOT NULL,
  epingle_le   TIMESTAMPTZ NOT NULL
);
