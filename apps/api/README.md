# API LONLONBENU

Node.js + Fastify + TypeScript, PostgreSQL, OAuth2.

```
src/
  serveur.ts               fabrique Fastify (injectable, testable sans port)
  domaine/depot.ts         port de persistance
  domaine/depotMemoire.ts  adaptateur en mémoire
  domaine/depotPostgres.ts adaptateur PostgreSQL
  db/schema.sql            schéma, appliqué par db/migrations.ts
  securite/                authentification et serveur d'autorisation OAuth2
  modules/axes/            exigence 1
  modules/dissociation/    exigence 2
  modules/appairage/       exigence 3
  modules/notifications/   exigence 4
  modules/oauth/           routes OAuth2
```

## Le principe qui gouverne tout le reste

**Le serveur ne réimplémente aucune règle métier : il rejoue celles de
`@lonlonbenu/shared`.** `axeVisiblePar`, `verifierInvitation`, `deciderRemise`,
`creerPartage` sont importés et exécutés tels quels, pas recopiés. Les tests
d'invariants écrits pour le mobile protègent donc aussi le serveur.

---

## Base de données

L'adaptateur PostgreSQL implémente **exactement le même port** que celui en
mémoire, et **aucune logique métier n'y vit** : pas de décision de visibilité,
pas de comptage d'essais, pas de politique de notification. Il traduit des
lignes en objets du domaine, rien d'autre.

C'est ce qui rend la substitution vérifiable : **la même suite de tests, avec
les mêmes assertions, tourne contre l'un ou l'autre adaptateur.**

```bash
# En mémoire (par défaut) — aucune dépendance, tourne partout
npm test

# Contre PostgreSQL — mêmes tests, mêmes assertions
LONLONBENU_TEST_DATABASE_URL=postgresql://user@host:5432/lonlonbenu_test \
  npx vitest run apps/api
```

Isolation : un schéma par worker vitest (`test_w0`, `test_w1`, …), tables vidées
avant chaque test. Le schéma est créé automatiquement.

### Monter une base jetable

PostgreSQL installé, pas de serveur disponible ? Un cluster indépendant, sur un
port à part, sans toucher à une installation existante :

```bash
initdb -D /chemin/pgdata -U postgres --auth=trust --encoding=UTF8
pg_ctl -D /chemin/pgdata -o "-p 55432 -c listen_addresses=127.0.0.1" -l pg.log start
psql -U postgres -h 127.0.0.1 -p 55432 -c "CREATE DATABASE lonlonbenu_test;"
```

### En production

`DATABASE_URL` suffit : `db/migrations.ts` applique `schema.sql` au démarrage.
Toutes les instructions sont `IF NOT EXISTS`, donc l'appel est idempotent — ce
qui suffit tant qu'il n'y a qu'une version du schéma. Dès la première migration
destructive, il faudra une vraie table de versions.

**Sur les identifiants** : TEXT et non UUID. Un identifiant de partenaire est le
`sub` du jeton OAuth2, dont le format appartient au fournisseur d'identité.

---

## Authentification

**Authorization Code + PKCE (S256)**, le flux que le RFC 8252 impose aux
applications mobiles : un client public ne peut garder aucun secret, donc
l'échange du code est lié à un vérificateur que seul l'appareil demandeur
connaît.

| Élément | Choix |
| --- | --- |
| Jeton d'accès | JWT **RS256**, 10 minutes, `iss` / `aud` / `sub` / `exp` / `jti` |
| Vérification | signature, émetteur, audience, expiration **et** liste de révocation |
| Rafraîchissement | opaque, stocké **haché**, usage unique, **rotatif** |
| Mots de passe | scrypt (N=2¹⁴), jamais stockés en clair |
| Clé publique | `GET /.well-known/jwks.json` |

**Rotation et détection de vol.** Rejouer un jeton de rafraîchissement déjà
tourné révoque **toute la famille**. Mieux vaut reconnecter les deux partenaires
que laisser un voleur poursuivre la rotation indéfiniment.

**L'appartenance au couple n'est pas dans le jeton.** Elle est résolue en base à
chaque requête. Un `coupleId` porté par un JWT resterait vrai dix minutes après
une dissociation, et une révocation qui met dix minutes n'est pas une révocation
immédiate. C'est le point qui rattache l'authentification au garde-fou n°3.

### Routes

```
POST /comptes                       création de compte
POST /oauth/authorize               identifiants + défi PKCE → code
POST /oauth/token                   grant_type=authorization_code | refresh_token
POST /oauth/revoke                  déconnexion (accès + famille de rafraîchissement)
GET  /.well-known/jwks.json         clé publique de vérification
GET  /moi                           identité et couple courant
```

### Variables d'environnement

```
DATABASE_URL                  postgresql://…
LONLONBENU_CLE_PRIVEE_PEM     clé RSA privée de signature (PEM)
LONLONBENU_OAUTH_EMETTEUR     https://auth.exemple
LONLONBENU_OAUTH_AUDIENCE     lonlonbenu-api          (défaut)
LONLONBENU_OAUTH_CLIENTS      lonlonbenu-mobile       (défaut, séparés par des virgules)
LONLONBENU_SECRET_TACHES      secret du déclencheur de rappels (optionnel :
                              sans lui, /taches/rappels n'existe pas)
```

Notifications push — chaque plateforme est indépendante, on peut n'en gréer
qu'une :

```
LONLONBENU_FCM_PROJET_ID                  identifiant du projet Firebase
LONLONBENU_FCM_COURRIEL_COMPTE_SERVICE    …@….iam.gserviceaccount.com
LONLONBENU_FCM_CLE_PRIVEE_PEM             clé privée du compte de service (PEM)

LONLONBENU_APNS_CLE_P8        contenu de la clé .p8 téléchargée chez Apple
LONLONBENU_APNS_ID_CLE        Key ID de cette clé
LONLONBENU_APNS_ID_EQUIPE     Team ID du compte développeur
LONLONBENU_APNS_SUJET         bundle identifier de l'app iOS
LONLONBENU_APNS_PRODUCTION    "true" pour l'App Store ; sinon bac à sable
```

Les clés PEM supportent les `\n` littéraux autant que les vrais sauts de ligne,
parce qu'un `.env` ne transporte pas les seconds.

### Le fichier `.env`

`npm run dev` et `npm run start` chargent `apps/api/.env` via `--env-file`.
`.env.example` en donne le modèle ; `.env` lui-même est ignoré par git, comme la
clé de compte de service Firebase et la clé `.p8` d'Apple, dont il recopie le
contenu.

```bash
# Vérifie que Google authentifie le compte de service, sans appareil ni build.
npm run verifier:fcm --workspace=@lonlonbenu/api
```

Le script pousse vers un jeton d'appareil volontairement faux : un
`400 INVALID_ARGUMENT` en retour prouve que l'authentification, le projet et les
permissions sont bons — seul le destinataire ne l'était pas.

Aucune valeur par défaut pour les secrets : un secret de développement finit
toujours par se retrouver en production.

---

## Exigences non négociables pour le futur backend

### 1. Rejeu serveur du filtrage `axeVisiblePar`

`modules/axes/axes.service.ts`. Trois contrôles enchaînés : appartenance au
couple et couple non dissocié, consentement mutuel au module `croissance`, puis
`axeVisiblePar`.

Le test décisif ne regarde pas la structure de la réponse mais sa **chaîne
sérialisée** : le texte de l'autre n'apparaît nulle part dans le corps HTTP. Ce
qui reste visible, c'est le fait qu'elle ait contribué — information symétrique.

### 2. Dissociation bilatérale, annonce symétrique

`modules/dissociation/dissociation.service.ts`. Coupure d'abord, destruction des
données partagées, puis annonce aux **deux**.

Les appareils sont déliés par l'expéditeur **une fois l'annonce réellement
partie** : les supprimer plus tôt détruirait le canal avant la livraison si
l'annonce est différée par le silence nocturne.

La catégorie `partage` est impérative, donc un réglage « jamais » ne mord pas.
Elle reste soumise au mode ne pas déranger — **seul le SOS le traverse**.

### 3. Appairage rejoué côté serveur

`modules/appairage/appairage.service.ts`. Entropie, expiration, usage unique,
plafond de cinq essais et comparaison à temps constant viennent du partagé.

Deux responsabilités propres au serveur : **détenir le vérificateur** (le code
en clair n'est rendu qu'une fois) et **persister chaque tentative**, sans quoi
le compteur resterait à zéro et le plafond ne servirait à rien.

Les deux endpoints sont authentifiés : l'identité de l'émetteur et celle de
l'invité viennent du jeton, jamais du corps de la requête.

### 4. Transport branché sur `deciderRemise`

`modules/notifications/`. Point de passage unique : tout appelle `publier`, qui
interroge `deciderRemise`. `viderLaFile` remet plus tard ce qui a été mis de
côté, en **un seul message** plutôt qu'en rafale.

Le contenu réel n'entre jamais dans le message poussé : il transite par les
serveurs d'Apple et de Google et s'affiche sur un écran verrouillé.

Les adaptateurs réels sont écrits — voir la section « Notifications push » plus
bas.

---

## Consentements réciproques

`modules/partages/`. `GET /couples/:id/partages` et
`PUT /couples/:id/partages/:module`. Sans cet endpoint, la tranche verticale des
axes ne pouvait pas exister : le module `croissance` serait resté inactif pour
toujours.

Comme partout, le serveur **rejoue** `basculerConsentement` — donc les deux
notifications symétriques partent aussi côté serveur. On ne bascule que **son
propre** consentement : l'identité vient du jeton, jamais du corps de la
requête. Celui de l'autre est lisible, pas modifiable.

## Vie pratique (pôle ③)

`modules/vie-pratique/`. Le rejeu le plus direct des cinq, et c'est normal :
ces données sont **`couple` par construction**. Un agenda commun, des projets
communs, des sorties communes — pas de consentement mutuel à vérifier, pas de
miroir, pas de niveau de partage. Reste le seul contrôle qui compte :
appartenance au couple, et couple non dissocié.

`visibilite` vaut toujours `couple`, **posé par le serveur** : un client qui
réclame `prive` obtient quand même `couple`. Le projet surprise (P1) sera la
seule exception, bornée et consentie à la création.

Rien n'est agrégé par personne : `faitPar` sert à afficher qui a coché *un*
jalon donné, jamais à compter.

## Rappels : le planificateur serveur

`modules/rappels/planificateur.ts`. **C'est ici que les rappels vivent, plus
dans une boucle mobile.** L'ancienne version ne tournait que l'app ouverte : un
rappel du matin n'arrivait que si quelqu'un ouvrait l'app, c'est-à-dire à peu
près jamais au moment utile.

Le calcul reste `rappelsDus` du partagé — mêmes fenêtres, mêmes clés
d'idempotence — et l'émission passe par `expediteur.publier`, donc par
**`deciderRemise`**. Un rappel reste soumis au mode ne pas déranger et aux
fréquences choisies : le planificateur ne s'accorde aucun privilège. Vérifié en
bout en bout, base à l'appui : sous silence total, les rappels sont `differee`
et rien n'est poussé.

Deux façons de le déclencher, et elles coexistent :

- un balayage interne toutes les cinq minutes, suffisant pour une instance ;
- `POST /taches/rappels`, pour une tâche planifiée externe. **Protégé par
  `LONLONBENU_SECRET_TACHES`** — ce n'est pas une route d'utilisateur, et
  l'exposer permettrait de faire sonner les téléphones à volonté. Sans secret
  configuré, la route n'est pas enregistrée du tout : mieux vaut absente
  qu'ouverte.

Les clés d'idempotence sont en base (`rappels_emis`), donc deux instances qui
balaient en parallèle ne dupliqueraient rien.

## Chat (pôle ①) — chiffré de bout en bout

`modules/chat/`. Ici le serveur **n'applique aucune règle de visibilité, parce
qu'il n'a rien compris**. Une enveloppe `m1.<nonce>.<scellé>` entre, la même
ressort.

Ce qui rend la promesse crédible n'est pas une discipline d'appel mais
**l'absence de surface** : aucun champ de texte en clair n'existe — ni dans le
modèle, ni dans le schéma, ni dans les corps acceptés. Le serveur refuse même
une enveloppe qui n'aurait pas la forme scellée, ce qui empêche un client bogué
de déposer du clair par inadvertance.

**Vérifié pour de vrai** : sur la chaîne sérialisée de la réponse, sur le
contenu de la base interrogé en SQL, et sur les journaux du serveur.

### Ce que le serveur voit malgré tout

Qui écrit à qui, quand, à quel rythme, et la taille des messages. **Les
métadonnées ne sont pas chiffrées**, et aucune formulation ne doit laisser
croire le contraire.

### Limites de la crypto, à ne pas taire

L'échange est un X25519 + HKDF, les messages sont scellés en
XChaCha20-Poly1305 (`shared/chiffrement/boutEnBout.ts`).

- **Pas de confidentialité persistante** : la clé de messages est stable. Qui
  obtiendrait une clé privée pourrait déchiffrer l'historique capturé. Un double
  ratchet est la suite logique ; l'écrire à la main serait irresponsable, il
  faudra une bibliothèque auditée.
- **Pas de sécurité post-compromission** : aucun renouvellement de clé.
- **Le serveur pourrait substituer une clé publique.** Parade : le nombre de
  vérification (`empreinteDeVerification`), à comparer de vive voix — le même
  principe que les *safety numbers* de Signal. Tant qu'il n'est pas comparé, la
  confidentialité repose sur l'honnêteté du serveur.
- **Perdre l'appareil, c'est perdre l'historique** : la clé privée n'est ni
  dérivée du mot de passe, ni sauvegardée.

## Présence (pôle ①)

`modules/presence/`. Le serveur **rejoue la réciprocité stricte** : le statut de
l'autre n'est servi que si `position` est consenti des deux côtés — c'est
`estPartageActif` qui tranche, la même fonction que côté mobile. Sans
réciprocité, ni le code ni la note ne franchissent la frontière.

Deux choix explicites :

- **On voit toujours son propre statut**, partage actif ou non. Se le cacher à
  soi-même n'aurait aucun sens, et un écran vide ferait croire à une panne.
- **Le SOS échappe à la règle.** Une alerte passe quel que soit l'état des
  consentements : un partage en pause ne doit jamais empêcher d'appeler à
  l'aide. Testé explicitement.

Les codes de statut et d'humeur circulent en clair — ce sont des valeurs d'un
ensemble fermé, les chiffrer ne cacherait rien. **Tout texte libre est scellé** :
note de statut, mot d'humeur, lieu de check-in, message de SOS.

## Confidences (pôle ②)

`modules/confidences/`. Troisième tranche verticale : le serveur rejoue
`confidencesVisiblesPar` avant sérialisation, comme `axeVisiblePar` et
`vuePartenaire`.

La particularité est ailleurs, dans **ce qui n'arrive jamais jusqu'ici** : un
brouillon. Une lettre s'écrit sur l'appareil de son auteur et ne traverse le
réseau qu'au moment de l'envoi. Trois barrières, de la plus forte à la plus
faible :

1. **La base refuse un brouillon** — `visibilite` est contrainte à `'couple'`.
   Un `INSERT` direct en SQL est rejeté ; vérifié.
2. **Aucun endpoint ne peut en créer un.** `envoyer` (du partagé) pose lui-même
   la visibilité et l'horodatage ; le corps de la requête n'a pas voix au
   chapitre. Un client qui réclame `visibilite: 'prive'` obtient quand même un
   envoi — c'est le seul geste que l'API sache faire.
3. Le client ne transmet pas les brouillons, ce qui était déjà la règle mobile.

**L'envoi est irréversible** : ni `DELETE`, ni `PUT` sur le contenu. Un texte
offert appartient aussi à celui qui l'a reçu ; le reprendre serait le lui
retirer.

L'accusé de lecture n'est posable que par le **destinataire** — sans quoi il ne
signifierait plus que l'autre a reçu — et ne se remet pas à jour à chaque
relecture.

## Cycle & fertilité (pôle ④)

`modules/cycle/`. Deuxième tranche verticale, sur le même principe que les axes :
**le serveur rejoue `vuePartenaire`** et ne rend que l'objet déjà mis en forme.

La réponse de `GET /couples/:id/cycle` a **deux formes**, décidées par le
serveur selon qui demande :

| Qui demande | Ce qu'il reçoit |
| --- | --- |
| La personne concernée | ses règles, ses symptômes, l'état calculé du cycle |
| Le partenaire | la projection de `vuePartenaire`, et rien d'autre |

**Ne franchissent jamais la frontière** vers le partenaire, quel que soit le
niveau : les dates, les symptômes, les notes personnelles, et même le numéro du
jour de cycle — qui permettrait de reconstituer les dates. Un test le vérifie
sur la chaîne sérialisée de la réponse, aux trois niveaux.

### Une seule personne écrit

Plus strict que partout ailleurs : ce n'est **pas** un consentement réciproque
et cela ne passe pas par `basculerConsentement`. `estLaPorteuse` garde chaque
écriture, niveau de partage inclus, et le partenaire ne peut pas se désigner
porteur à la place de l'autre une fois quelqu'un déclaré.

Baisser son niveau **n'émet aucune notification** — annoncer « elle en partage
moins » transformerait un droit en dette. Un test le vérifie.

Le niveau 3 (`complet`) reste refusé en P0 : `niveauxDisponibles()` fait foi.

## Notifications push (FCM / APNs)

`modules/notifications/transportFcm.ts` et `transportApns.ts`, derrière
l'interface `Transport` — un `pousser(message)`, rien d'autre. Le transport ne
décide de rien : il reçoit ce que `deciderRemise` a laissé passer.
`creerTransportParPlateforme` aiguille sur `appareil.plateforme`, et
`creerTransportDepuisEnv` monte ce que l'environnement permet.

### Ce qui part réellement

Un titre (`LONLONBENU`, ou `SOS`) et une phrase générique. **Rien d'autre** :
pas de bloc `data` côté FCM, rien en dehors de `aps` côté APNs, aucun
identifiant de couple. Un test par adaptateur le verrouille en inspectant la
charge sérialisée, sur le même principe que le test de corps HTTP des axes.

Ce n'est pas de la prudence de façade : cette charge transite par des serveurs
tiers et s'affiche sur un écran verrouillé, que n'importe qui peut lire par
dessus l'épaule. Pour le chat, la question ne se pose même pas — le serveur n'a
que des enveloppes scellées.

Seul le SOS demande la priorité haute (`10` chez Apple, `high` chez Google) :
lui seul justifie de réveiller un téléphone au repos.

### Jetons d'autorisation

Les deux fournisseurs veulent un JWT, avec des contraintes opposées :

- **FCM** : assertion RS256 échangée contre un jeton d'accès OAuth2, mis en
  cache jusqu'à une minute avant son expiration. Un seul vol de renouvellement à
  la fois, comme le client mobile.
- **APNs** : JWT ES256 signé avec la clé `.p8`, renouvelé toutes les
  50 minutes. Apple rejette un jeton de plus de 60 minutes
  (`ExpiredProviderToken`) **et** punit le client qui en resigne trop souvent
  (`TooManyProviderTokenUpdates`) : 50 minutes tombent entre les deux.

APNs impose HTTP/2, donc `node:http2` plutôt que `fetch`, avec une session
maintenue ouverte — Apple pénalise explicitement une connexion par notification.

### Jetons d'appareil morts

Un refus est classé par `ErreurPush` : `jetonInvalide` (l'appareil n'existe
plus) ou `reessayable` (panne passagère). Sur `jetonInvalide` — `UNREGISTERED`,
`BadDeviceToken`, `Unregistered`, `DeviceTokenNotForTopic` — l'appareil est
délié via `depot.appareils.supprimerParJeton`, sans quoi on pousserait
indéfiniment vers une app désinstallée.

Tout le reste est traité comme passager, volontairement : une panne de Google ne
doit pas coûter son inscription à un appareil parfaitement valide. Et un
appareil qui refuse n'empêche pas les autres du même partenaire de recevoir —
ils appartiennent à la même personne, pas au même destin.

### Un échec ne perd pas la notification

Si rien n'est parti, `expedieeLe` reste vide : la notification n'est pas
déclarée expédiée et `enAttente` la ressort, pour que `viderLaFile` la retente
(immédiatement pour un envoi qui devait être immédiat, à sa fenêtre pour une
groupée). Marquer « expédiée » un message que personne n'a reçu ferait mentir le
journal *et* perdrait l'information pour de bon.

Un partenaire sans appareil inscrit n'est pas un échec : il n'a rien à recevoir
en push, la notification reste au journal comme les autres.

### Ce qui n'est pas vérifié ici

Les adaptateurs sont testés contre des doubles de `fetch` et de session HTTP/2 :
claims des JWT (vérifiées avec `jose`), mise en cache, forme de la charge utile,
classement des refus, aiguillage. **La remise réelle chez Apple et Google n'a
pas pu être vérifiée** — il faut des identifiants de production, un vrai bundle
signé et un appareil physique. C'est la première chose à faire avec les
téléphones de Rochambeau et Gaëlle, en pointant `LONLONBENU_APNS_PRODUCTION` sur
le bac à sable.

Sans configuration, rien n'est monté : le serveur l'annonce au démarrage et les
notifications restent dans le journal de l'app, sans jamais atteindre un écran
verrouillé.

## Faire tourner l'API

```bash
DATABASE_URL=postgresql://…                 \
LONLONBENU_CLE_PRIVEE_PEM="$(cat cle.pem)"  \
LONLONBENU_OAUTH_EMETTEUR=https://auth.exemple \
npm run start --workspace=@lonlonbenu/api
```

L'API tourne sous **tsx**, pas sous `node --experimental-strip-types` : le
paquet partagé utilise des imports sans extension (ce qu'exigent Metro et
vitest), que le chargeur ESM natif de Node refuse. `packages/shared` déclare
`"type": "module"` pour que ses exports nommés soient statiquement analysables.
Un vrai build (esbuild ou `tsc`) reste la bonne cible avant la mise en ligne.

## Ce qui n'est pas fait

- **Remise push vérifiée pour de vrai.** Les adaptateurs sont écrits et testés
  hors ligne ; personne n'a encore vu une notification arriver sur un téléphone.
  Voir « Ce qui n'est pas vérifié ici ».
- **Identifiants Apple.** Firebase est configuré depuis le 13 août 2026 (projet
  `lonlonbenouapp`) ; APNs attend encore sa clé `.p8`. Et tant qu'aucun build de
  développement n'a tourné sur un téléphone physique, le mobile envoie un
  **jeton de développement** préfixé `dev-`, sur lequel aucun envoi ne peut
  aboutir. La marche à suivre est dans
  `apps/mobile/src/features/reglages/README.md`, section « Le jeton de
  développement — ce qu'il faut remplacer » — elle inclut le
  `DELETE FROM appareils WHERE jeton_push LIKE 'dev-%'` que le serveur ne fait
  pas de lui-même.
- **Politique de reprise des envois ratés.** Un échec passager laisse la
  notification en attente et `viderLaFile` la retente au passage suivant du
  planificateur — mais sans temporisation croissante ni abandon après N essais.
  Une panne longue chez un fournisseur ferait donc réessayer toutes les cinq
  minutes, indéfiniment. Conséquence à connaître : après une dissociation,
  `nettoyerAppareilsSiTermine` attend que plus rien ne soit en attente pour
  délier les appareils — si l'annonce ne part jamais, les lignes `appareils`
  survivent. Elles ne donnent accès à rien (la dissociation a déjà tout révoqué),
  mais elles traînent.
- **Fédération d'identité.** La création de compte est locale (courriel + mot de
  passe). Apple / Google Sign-In se brancheraient en fournisseur supplémentaire
  devant le même serveur d'autorisation.
- **Purge des jetons révoqués.** La table `jetons_revoques` grossit sans
  nettoyage ; une tâche planifiée doit supprimer les entrées expirées.
- **Table de versions de schéma**, nécessaire avant la première migration
  destructive.
- **Chiffrement de bout en bout.** Le serveur ne doit jamais voir la clé du
  coffre. Rien ici ne le compromet, rien ne l'implémente non plus.
- **Le pôle ⑤ (Mémoire & complicité).** Rien en P0 : souvenirs et Love Map sont
  P1, le journal du couple P2.
