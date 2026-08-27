-- Schéma PostgreSQL — LONLONBENU
--
-- Appliqué par `db/migrations.ts`. Le dépôt PostgreSQL (`domaine/depotPostgres.ts`)
-- implémente exactement le même port que le dépôt en mémoire, et la suite de
-- tests de l'API tourne à l'identique contre l'un ou l'autre.
--
-- Convention non négociable (CLAUDE.md) : toute entité sensible porte une
-- colonne de visibilité explicite, et aucune requête ne doit la contourner.
--
-- Sur les identifiants : TEXT et non UUID. Un identifiant de partenaire est le
-- `sub` du jeton OAuth2, dont le format appartient au fournisseur d'identité —
-- imposer UUID ici serait une hypothèse sur un composant qui n'est pas le nôtre.

CREATE TABLE IF NOT EXISTS couples (
  id            TEXT PRIMARY KEY,
  depuis        DATE        NOT NULL,
  nom_espace    TEXT        NOT NULL DEFAULT 'Notre espace',
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Une fois posée, cette date coupe tout accès, des deux côtés.
  dissocie_le   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS partenaires (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  prenom        TEXT        NOT NULL,
  initiales     TEXT        NOT NULL,
  -- Ordre dans le couple : préserve la stabilité du tuple `partenaires`.
  rang          SMALLINT    NOT NULL CHECK (rang IN (0, 1)),
  UNIQUE (couple_id, rang)
);
CREATE INDEX IF NOT EXISTS partenaires_couple ON partenaires (couple_id);

-- Consentements réciproques. Une ligne par partenaire et par module : le
-- partage n'est actif que si les deux lignes le sont.
CREATE TABLE IF NOT EXISTS partages (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  module        TEXT        NOT NULL
                CHECK (module IN ('position','cycle','croissance','score','confidences')),
  partenaire_id TEXT        NOT NULL,
  actif         BOOLEAN     NOT NULL DEFAULT false,
  maj_le        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, module, partenaire_id)
);

-- Appairage. Le code en clair n'est jamais stocké : seul le vérificateur dérivé
-- l'est, avec son sel.
CREATE TABLE IF NOT EXISTS invitations (
  id            TEXT PRIMARY KEY,
  emise_par     TEXT        NOT NULL,
  verificateur  TEXT        NOT NULL,
  sel           TEXT        NOT NULL,
  emise_le      TIMESTAMPTZ NOT NULL,
  expire_le     TIMESTAMPTZ NOT NULL,
  essais        SMALLINT    NOT NULL DEFAULT 0,
  consommee_le  TIMESTAMPTZ,
  couple_id     TEXT        REFERENCES couples(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS invitations_expiration
  ON invitations (expire_le) WHERE consommee_le IS NULL;

-- Axes de croissance. Le miroir se joue à la lecture : la contribution de
-- l'autre n'est jamais servie tant que les deux n'ont pas déposé.
CREATE TABLE IF NOT EXISTS axes (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  theme         TEXT        NOT NULL,
  titre         TEXT        NOT NULL,
  ouvert_par    TEXT        NOT NULL,
  ouvert_le     TIMESTAMPTZ NOT NULL,
  cloture_le    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS axes_couple ON axes (couple_id);

CREATE TABLE IF NOT EXISTS contributions_axe (
  axe_id        TEXT        NOT NULL REFERENCES axes(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  ressenti      TEXT        NOT NULL,
  besoin        TEXT        NOT NULL,
  maj_le        TIMESTAMPTZ NOT NULL,
  -- Un axe n'accueille que les deux partenaires du couple, une fois chacun.
  PRIMARY KEY (axe_id, partenaire_id)
);

-- Notifications. `remise` conserve la décision de `deciderRemise`, y compris
-- « ignoree » : la personne doit pouvoir retrouver ce qui ne lui a pas été
-- signalé.
--
-- Pas de clé étrangère vers `partenaires` ici, ni sur `appareils` : une identité
-- existe dès l'authentification, avant tout appairage, et survit à la
-- dissociation du couple. La contrainte serait fausse plus souvent qu'utile.
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  destinataire  TEXT        NOT NULL,
  categorie     TEXT        NOT NULL,
  texte         TEXT        NOT NULL,
  emise_le      TIMESTAMPTZ NOT NULL,
  remise        TEXT        NOT NULL
                CHECK (remise IN ('envoyee','groupee','differee','ignoree')),
  raison        TEXT        NOT NULL,
  expediee_le   TIMESTAMPTZ
);
-- Index de la file : ce que le travail planifié doit balayer.
CREATE INDEX IF NOT EXISTS notifications_en_attente
  ON notifications (destinataire, emise_le)
  WHERE expediee_le IS NULL AND remise IN ('differee','groupee');
CREATE INDEX IF NOT EXISTS notifications_journal
  ON notifications (destinataire, emise_le DESC);

CREATE TABLE IF NOT EXISTS preferences_notifications (
  partenaire_id       TEXT PRIMARY KEY,
  -- Sérialisation de PreferencesNotifications (@lonlonbenu/shared).
  preferences         JSONB       NOT NULL,
  maj_le              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appareils (
  jeton_push    TEXT PRIMARY KEY,
  partenaire_id TEXT        NOT NULL,
  plateforme    TEXT        NOT NULL CHECK (plateforme IN ('ios','android')),
  enregistre_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appareils_partenaire ON appareils (partenaire_id);

-- Vie pratique partagée (pôle ③).
--
-- Ces données sont `couple` par construction : un agenda commun, des projets
-- communs, des sorties communes. Il n'y a **pas de consentement mutuel à
-- vérifier** comme pour les axes — la colonne `visibilite` existe parce que la
-- convention l'impose, et parce que le projet surprise (P1) sera la seule
-- exception, bornée et consentie à la création.
CREATE TABLE IF NOT EXISTS evenements (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  titre         TEXT        NOT NULL,
  categorie     TEXT        NOT NULL,
  debut         TEXT        NOT NULL,
  fin           TEXT,
  journee_entiere BOOLEAN   NOT NULL DEFAULT false,
  lieu          TEXT,
  note          TEXT,
  cree_par      TEXT        NOT NULL,
  cree_le       TIMESTAMPTZ NOT NULL,
  visibilite    TEXT        NOT NULL DEFAULT 'couple' CHECK (visibilite = 'couple'),
  rappel_heures SMALLINT
);
CREATE INDEX IF NOT EXISTS evenements_couple ON evenements (couple_id, debut);

CREATE TABLE IF NOT EXISTS projets (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  titre         TEXT        NOT NULL,
  intention     TEXT,
  echeance      DATE,
  cree_par      TEXT        NOT NULL,
  cree_le       TIMESTAMPTZ NOT NULL,
  archive_le    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS projets_couple ON projets (couple_id, cree_le DESC);

CREATE TABLE IF NOT EXISTS jalons (
  id            TEXT PRIMARY KEY,
  projet_id     TEXT        NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  titre         TEXT        NOT NULL,
  echeance      DATE,
  fait_le       TIMESTAMPTZ,
  -- Conservé pour afficher qui a coché *un* jalon. Jamais agrégé : un projet
  -- de couple avance ou n'avance pas, personne n'avance plus que l'autre.
  fait_par      TEXT,
  rang          INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS jalons_projet ON jalons (projet_id, rang);

CREATE TABLE IF NOT EXISTS initiatives (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  titre         TEXT        NOT NULL,
  categorie     TEXT        NOT NULL,
  etat          TEXT        NOT NULL CHECK (etat IN ('idee','prevue','vecue')),
  proposee_par  TEXT        NOT NULL,
  proposee_le   TIMESTAMPTZ NOT NULL,
  prevue_pour   DATE,
  vecue_le      TIMESTAMPTZ,
  souvenir      TEXT
);
CREATE INDEX IF NOT EXISTS initiatives_couple ON initiatives (couple_id, proposee_le DESC);

-- Rappels déjà émis. C'est ce qui rend le planificateur idempotent : sans cette
-- table, un balayage toutes les cinq minutes redirait la même chose sans fin.
CREATE TABLE IF NOT EXISTS rappels_emis (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  cle           TEXT        NOT NULL,
  emis_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, cle)
);

-- Chat du couple (pôle ①) — chiffré de bout en bout.
--
-- **Il n'existe aucune colonne de texte en clair, et c'est le point.** Le
-- serveur achemine une enveloppe opaque (`m1.<nonce>.<scellé>`) sans jamais
-- pouvoir l'ouvrir : la clé privée ne quitte pas l'appareil. Ce qui n'a pas de
-- place où être stocké ne peut pas fuiter — ni par une requête oubliée, ni par
-- une sauvegarde, ni par un journal.
--
-- Ce que le serveur voit malgré tout, et qu'il faut assumer : qui écrit à qui,
-- quand, et à quel rythme. Les métadonnées ne sont pas chiffrées.
CREATE TABLE IF NOT EXISTS cles_publiques (
  partenaire_id TEXT PRIMARY KEY,
  -- Clé publique X25519. Aucune clé privée ne transite jamais par ici.
  cle_publique  TEXT        NOT NULL,
  maj_le        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  auteur_id     TEXT        NOT NULL,
  enveloppe     TEXT        NOT NULL CHECK (enveloppe LIKE 'm1.%'),
  envoye_le     TIMESTAMPTZ NOT NULL,
  lu_le         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_couple ON messages (couple_id, envoye_le);

-- Présence (pôle ①). Statuts, check-ins et SOS.
--
-- Le code de statut reste en clair : c'est une valeur d'un ensemble fermé, la
-- chiffrer n'apporterait rien contre un serveur qui connaît les cinq valeurs
-- possibles. En revanche **tout texte libre écrit par la personne est scellé** —
-- note de statut, lieu de check-in, message de SOS.
CREATE TABLE IF NOT EXISTS statuts (
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  code          TEXT        NOT NULL,
  note_scellee  TEXT,
  maj_le        TIMESTAMPTZ NOT NULL,
  -- L'humeur du jour partage la ligne : meme personne, meme reciprocite.
  humeur_code       TEXT,
  mot_humeur_scelle TEXT,
  humeur_maj_le     TIMESTAMPTZ,
  PRIMARY KEY (couple_id, partenaire_id)
);

CREATE TABLE IF NOT EXISTS check_ins (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  lieu_scelle   TEXT        NOT NULL,
  mot_scelle    TEXT,
  fait_le       TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS check_ins_couple ON check_ins (couple_id, fait_le DESC);

CREATE TABLE IF NOT EXISTS alertes_sos (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  partenaire_id TEXT        NOT NULL,
  lieu_scelle   TEXT,
  message_scelle TEXT,
  etat          TEXT        NOT NULL CHECK (etat IN ('actif','resolu')),
  emise_le      TIMESTAMPTZ NOT NULL,
  vue_le        TIMESTAMPTZ,
  resolue_le    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alertes_actives
  ON alertes_sos (couple_id, emise_le DESC) WHERE etat = 'actif';

-- Espace de confidences (pôle ②).
--
-- **Cette table ne contient que des confidences envoyées.** Un brouillon reste
-- sur l'appareil de son auteur et ne transite jamais vers le serveur : la
-- contrainte ci-dessous rend l'état « brouillon » impossible à stocker, plutôt
-- que de compter sur la discipline des appels.
--
-- `envoyee_le` est posée par le serveur, jamais reçue du client : l'envoi est
-- un acte, pas un champ que l'appelant déclare.
CREATE TABLE IF NOT EXISTS confidences (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  auteur_id     TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('gratitude','lettre')),
  titre         TEXT,
  texte         TEXT        NOT NULL CHECK (length(btrim(texte)) > 0),
  cree_le       TIMESTAMPTZ NOT NULL,
  envoyee_le    TIMESTAMPTZ NOT NULL,
  lu_le         TIMESTAMPTZ,
  -- Un brouillon n'a pas sa place ici, et la base le refuse.
  visibilite    TEXT        NOT NULL DEFAULT 'couple' CHECK (visibilite = 'couple')
);
CREATE INDEX IF NOT EXISTS confidences_couple
  ON confidences (couple_id, envoyee_le DESC);

-- Cycle & fertilité (pôle ④).
--
-- Le niveau de partage est contrôlé **exclusivement** par la personne
-- concernée : `porteuse_id` est la seule identité autorisée à écrire dans ces
-- trois tables, et le serveur le vérifie à chaque requête.
--
-- Les symptômes ne sortent jamais du serveur en P0, quel que soit le niveau :
-- ils n'entrent dans aucune réponse destinée au partenaire.
CREATE TABLE IF NOT EXISTS cycle_partage (
  couple_id     TEXT PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  porteuse_id   TEXT        NOT NULL,
  niveau        TEXT        NOT NULL
                CHECK (niveau IN ('aucun','discret','phases','complet')),
  maj_le        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle_regles (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  debut_le      DATE        NOT NULL,
  fin_le        DATE,
  saisi_le      TIMESTAMPTZ NOT NULL,
  -- Un même premier jour ne se saisit pas deux fois.
  UNIQUE (couple_id, debut_le)
);
CREATE INDEX IF NOT EXISTS cycle_regles_couple
  ON cycle_regles (couple_id, debut_le DESC);

CREATE TABLE IF NOT EXISTS cycle_symptomes (
  id            TEXT PRIMARY KEY,
  couple_id     TEXT        NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  date_jour     DATE        NOT NULL,
  type          TEXT        NOT NULL,
  intensite     SMALLINT    NOT NULL CHECK (intensite BETWEEN 1 AND 3),
  note          TEXT,
  -- Renoter un symptôme remplace au lieu d'empiler.
  UNIQUE (couple_id, date_jour, type)
);

-- ---------------------------------------------------------------- OAuth2

CREATE TABLE IF NOT EXISTS comptes (
  id              TEXT PRIMARY KEY,
  courriel        TEXT        NOT NULL UNIQUE,
  -- Vérificateur scrypt. Le mot de passe n'est jamais stocké.
  verificateur    JSONB       NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codes d'autorisation (flux Authorization Code + PKCE). Usage unique et
-- durée de vie très courte.
CREATE TABLE IF NOT EXISTS codes_autorisation (
  code            TEXT PRIMARY KEY,
  compte_id       TEXT        NOT NULL,
  client_id       TEXT        NOT NULL,
  defi_pkce       TEXT        NOT NULL,
  methode_pkce    TEXT        NOT NULL CHECK (methode_pkce = 'S256'),
  portee          TEXT        NOT NULL,
  expire_le       TIMESTAMPTZ NOT NULL,
  consomme_le     TIMESTAMPTZ
);

-- Jetons de rafraîchissement : stockés hachés, rotatifs, révocables.
-- `remplace_par` matérialise la chaîne de rotation : réutiliser un jeton déjà
-- tourné est le signe d'un vol, et révoque toute la famille.
CREATE TABLE IF NOT EXISTS jetons_rafraichissement (
  empreinte       TEXT PRIMARY KEY,
  famille         TEXT        NOT NULL,
  compte_id       TEXT        NOT NULL,
  client_id       TEXT        NOT NULL,
  portee          TEXT        NOT NULL,
  emis_le         TIMESTAMPTZ NOT NULL,
  expire_le       TIMESTAMPTZ NOT NULL,
  utilise_le      TIMESTAMPTZ,
  revoque_le      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jetons_famille ON jetons_rafraichissement (famille);

-- Jetons d'accès révoqués avant leur expiration naturelle (déconnexion,
-- dissociation). Purgeable : une entrée expirée ne sert plus à rien.
CREATE TABLE IF NOT EXISTS jetons_revoques (
  jti             TEXT PRIMARY KEY,
  expire_le       TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- Tables restant à définir, une fois les pôles correspondants portés côté
-- serveur. Chacune devra porter sa colonne de visibilité :
--
--   messages          (visibilite, chiffré de bout en bout)
--   confidences       (visibilite : 'prive' tant que brouillon)
--   evenements        (visibilite : 'couple' en P0, autre valeur réservée au
--                      projet surprise P1)
--   projets, jalons, initiatives
--   cycle_regles, cycle_symptomes, cycle_partage
--                     (niveau contrôlé exclusivement par la personne concernée)
--   statuts, check_ins, alertes_sos
