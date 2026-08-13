# Pôle ⑥ — Sécurité & réglages (transverse)

Ce qui existe aujourd'hui :

- identité du couple et partenaire connecté (`stores/sessionStore.ts`) ;
- consentements réciproques, adossés à `@lonlonbenu/shared/privacy/reciprocite` ;
- file de notifications locale, en attendant FCM/APNs ;
- **chiffrement au repos de toutes les données locales** ;
- **verrou d'application** — biométrie + code de secours ;
- **dissociation de compte** — révocation croisée immédiate.

---

## Chiffrement au repos

### Ce qui est chiffré

Tout ce que les stores persistent, c'est-à-dire aujourd'hui : humeurs, notes
douces et messages du chat, statuts de présence, journal de check-in, alertes
SOS, consentements et notifications. Rien n'est écrit en clair sur l'appareil.

### Comment

| Élément | Choix | Où |
| --- | --- | --- |
| Primitive | XChaCha20-Poly1305 (`@noble/ciphers`) | `packages/shared/src/privacy/coffre.ts` |
| Clé | 256 bits, tirée du CSPRNG système (`expo-crypto`) | `src/lib/chiffrement.ts` |
| Garde de la clé | `expo-secure-store` → Keychain iOS / Keystore Android | `src/lib/chiffrement.ts` |
| Support chiffré | AsyncStorage, qui ne voit que des enveloppes | `src/lib/stockage.ts` |

Format d'enveloppe : `lb1.<nonce base64>.<scellé base64>`.

### Pourquoi ces choix

**XChaCha20-Poly1305 plutôt qu'AES-256-GCM.** Le cahier des charges cite
AES-256 au repos ; l'écart est assumé et voici pourquoi. AES en JavaScript pur
n'a pas d'accélération matérielle sous Hermes et reste sensible aux attaques par
cache ; obtenir un AES-GCM natif imposerait `react-native-quick-crypto`, donc un
module natif à maintenir et un `prebuild` obligatoire dès le premier jour.
XChaCha20-Poly1305 offre le même niveau de sécurité (chiffrement authentifié,
256 bits), il est rapide en JS, et son nonce de 192 bits peut être tiré au
hasard à chaque écriture sans risque de collision — pas de compteur à gérer,
donc pas de bug de réutilisation de nonce possible. `@noble/ciphers` est audité
et sans dépendance. À revoir si le backend impose AES pour l'interopérabilité :
le format d'enveloppe est versionné (`lb1`) précisément pour ça.

**La clé ne quitte jamais le trousseau système.** Elle n'est ni dérivée d'un mot
de passe, ni sauvegardée, ni synchronisée. Conséquence directe et voulue :
effacer l'entrée du trousseau (`oublierLaCle()`) rend l'intégralité des données
locales illisibles en une opération. C'est la brique sur laquelle s'appuiera la
**dissociation de compte** — pas besoin de parcourir chaque enregistrement pour
révoquer un accès.

**Le nom du store est authentifié.** Une enveloppe copiée de `lonlonbenu.chat`
vers `lonlonbenu.presence` ne s'ouvre pas. Cela ferme une classe entière de
manipulations sur un appareil rooté.

**Migration transparente.** `estScelle()` distingue une enveloppe d'une valeur
en clair héritée d'une version antérieure : au premier accès, l'ancienne valeur
est rechiffrée sur place. Aucune donnée du couple pilote n'est perdue.

### Ce que ce chiffrement ne fait PAS

- Il **ne protège pas contre un appareil déverrouillé** entre de mauvaises
  mains : c'est le rôle du verrou biométrique, encore à faire.
- Il **n'est pas du bout en bout.** Il n'y a pas encore de réseau ; le jour où
  les données transiteront, le chiffrement de bout en bout (protocole type
  Signal) sera un chantier distinct, et le serveur ne devra jamais voir la clé.
- Il **ne remplace pas le filtre de visibilité.** Chiffrer protège du vol de
  l'appareil, pas d'une lecture indue entre partenaires — c'est
  `visibilite.ts` et `reciprocite.ts` qui s'en chargent.

### Tests

`packages/shared/src/privacy/coffre.test.ts` couvre l'aller-retour, les accents
et emoji, l'altération d'un seul caractère, une clé différente, un contexte
différent, les enveloppes malformées et le base64 sur toutes les longueurs de
rembourrage. La partie non testée automatiquement est la glue native
(trousseau + CSPRNG) : à vérifier à la main sur appareil.

---

---

## Verrou de l'application

Logique calculable dans `packages/shared/src/securite/verrou.ts` (testée),
glue native dans `stores/verrouStore.ts` et `services/secretVerrou.ts`.

**Biométrie d'abord, code PIN en secours.** Le code n'est pas un repli
optionnel : sur un appareil sans capteur, ou quand la reconnaissance échoue, il
faut toujours une porte d'entrée. Un verrou dont on peut se retrouver exclu
n'est pas une protection, c'est un piège.

Le code n'est jamais conservé. On garde un vérificateur dérivé (PBKDF2-SHA256,
sel aléatoire de 16 octets, 120 000 itérations) rangé dans le trousseau système
à côté de la clé du coffre — jamais dans AsyncStorage, même chiffré : un secret
de ce type ne doit pas dépendre d'une autre clé pour être protégé.

**Ce que la dérivation apporte, et ce qu'elle n'apporte pas.** Un code à quatre
chiffres, c'est dix mille possibilités : aucune fonction de dérivation ne rend
cet espace incassable pour qui détient le vérificateur. La protection réelle
tient, dans l'ordre, au trousseau matériel, au durcissement après échecs, puis
seulement à la dérivation. Les 120 000 itérations sont calibrées pour rester
sous la seconde sous Hermes — monter plus haut pousserait surtout les gens à
désactiver le verrou, ce qui protège beaucoup moins bien.

### Hypothèse de menace

Un verrou ne protège de quelque chose que sous certaines conditions. Les
énoncer, c'est aussi énoncer ce qu'il ne faut pas promettre aux utilisateurs.

**Ce qu'on suppose vrai** (si l'une de ces hypothèses tombe, le verrou ne tient
plus) :

- l'appareil n'est **ni rooté ni jailbreaké** ;
- le trousseau matériel (Secure Enclave / StrongBox / TEE) est **non
  extractible** : on ne peut pas en sortir la clé du coffre ni le vérificateur
  du code sans compromettre l'appareil lui-même ;
- l'appareil a son **propre verrouillage système** actif (code, empreinte) ;
- le binaire de l'app n'a pas été altéré, et le système n'est pas compromis
  (clavier malveillant, capture d'écran en arrière-plan, débogueur attaché).

**Ce contre quoi le verrou protège réellement** — et c'est déjà l'essentiel des
situations vécues :

- un téléphone déverrouillé posé sur une table, repris par quelqu'un qui ouvre
  les apps ouvertes ;
- la curiosité d'un proche, d'un collègue, d'un enfant ;
- un téléphone perdu ou volé, entre des mains non spécialisées.

**Ce contre quoi il ne protège pas**, et qu'il ne faut jamais laisser croire :

- **Un partenaire dont l'empreinte ou le visage est enregistré sur l'appareil
  peut ouvrir l'app.** C'est la limite la plus importante pour une app de
  couple : la biométrie authentifie le *jeu d'identités enrôlées sur
  l'appareil*, pas une personne en particulier. Quelqu'un qui craint d'être
  surveillé par son partenaire doit désactiver la biométrie et n'utiliser que
  le code — et savoir que ce code se regarde par-dessus l'épaule.
- **Un appareil rooté**, sur lequel les données de l'app et le trousseau
  deviennent lisibles par un outil dédié.
- **La contrainte physique** : personne ne résiste à « donne-moi ton code ».
  Aucune fonctionnalité de cette app ne prétendra le contraire, et c'est
  précisément pourquoi il n'existe **pas** de faux code, de compartiment caché
  ni de mode leurre — une fonctionnalité de ce genre met en danger celui qui
  s'y fie.
- **L'observation d'écran** : capture, enregistrement, regard par-dessus
  l'épaule.

### Ce que le code PIN ne protège pas

Le verrou et le chiffrement sont **deux mécanismes indépendants**. La clé du
coffre n'est pas dérivée du code PIN : elle est tirée au hasard et gardée par le
trousseau. Conséquence à assumer : quelqu'un qui parvient à extraire le
trousseau obtient la clé du coffre **sans avoir besoin du code**. Le PIN barre
l'accès à l'interface, pas aux octets.

L'alternative — dériver la clé du coffre du code PIN — lierait la
confidentialité des données au secret du code, mais rendrait toutes les données
définitivement illisibles en cas d'oubli, et exposerait le chiffrement à la
faiblesse intrinsèque d'un code à quatre chiffres. Le choix retenu est
l'indépendance des deux ; il est révisable si le modèle de menace évolue.

Détails qui comptent :

- **Aucun effacement après N échecs.** Le durcissement fait attendre (30 s, 60 s,
  5 min, puis 15 min), il ne punit jamais. Un partenaire pourrait saisir de faux
  codes exprès pour détruire ce que l'autre a écrit ; un test verrouille cette
  décision (`EFFACEMENT_APRES_ECHECS`).
- **Le verrou est posé au-dessus du routeur** (`GardeVerrou` dans `app/_layout.tsx`),
  pas sur une route : aucun lien profond ni notification ne peut ouvrir un écran
  en passant à côté.
- **Rien ne s'affiche avant la relecture du réglage.** Montrer le contenu puis le
  masquer laisserait entrevoir ce que le verrou est censé couvrir.
- **Reverrouillage** au lancement à froid systématiquement, et après 30 secondes
  en arrière-plan — de quoi consulter une autre app sans ressaisir son code.
- Les codes trop prévisibles (`0000`, `1234`, suites) sont refusés, avec un
  message qui explique sans faire la leçon.

---

## Dissociation de compte

`services/dissociation.ts`, écran dans `screens/DissociationEcran.tsx`.

**La règle vaut dans les deux sens : plus personne n'accède à rien.** Il
n'existe aucun état où l'un garderait la position, le chat, le cycle ou les
confidences de l'autre après la séparation — ce serait exactement l'observation
à sens unique que les garde-fous interdisent.

L'ordre des opérations est le cœur du mécanisme :

1. **`oublierLaCle()` en premier.** À cet instant précis, tout ce qui est
   chiffré sur l'appareil devient illisible — même si l'effacement qui suit
   était interrompu par une batterie vide, un plantage ou un retrait de l'app.
   C'est ce qui rend la révocation *immédiate* plutôt que « normalement
   complète ».
2. Effacement du code de verrouillage, qui n'a plus d'objet.
3. Suppression des enveloppes dans AsyncStorage, pour ne pas laisser de résidus.
4. Remise à zéro des stores en mémoire, sinon l'écran continuerait d'afficher ce
   qui vient d'être révoqué.
5. Tous les consentements retombent à `false`, des deux côtés simultanément.
6. Pose d'un marqueur `lonlonbenu.dissocie` : sans lui, l'amorce de
   démonstration repeuplerait l'app au lancement suivant, ce qui serait
   insupportable après une séparation.

**Sur la rédaction de l'écran** : dire exactement ce qui va se passer, et ne
jamais tenter de retenir. Pas de « êtes-vous sûr, pensez à tous ces
souvenirs » — quelqu'un qui quitte une relation n'a pas à négocier avec une
application. L'écran prévient en revanche clairement qu'il n'y a ni sauvegarde
ni retour en arrière, et invite à conserver ce qui doit l'être *avant*.

### Ce que le backend devra ajouter

Localement, la dissociation ne peut agir que sur cet appareil. Côté serveur, il
faudra en plus : révoquer les jetons des deux côtés au même instant, notifier
**les deux** partenaires (une révocation silencieuse serait un mode furtif), et
détruire les données partagées plutôt que les rendre orphelines.

---

## Onboarding conjoint

Écran dans `screens/OnboardingEcran.tsx`, logique testée dans
`packages/shared/src/onboarding/`.

L'ordre des étapes n'est pas arbitraire : **on se nomme, on se relie, on nomme
l'espace, puis seulement on règle les partages.** Demander les partages avant
que le couple existe reviendrait à faire consentir dans le vide.

### Invitation du partenaire

Sans serveur, un code reste un secret transmis de la main à la main. Ce qui est
garanti et testé dès maintenant : 8 caractères sur un alphabet de 26 (≈ 38 bits),
**expiration à 15 minutes**, **usage unique**, **cinq essais puis le code est
brûlé**, comparaison à temps constant, et code jamais conservé en clair — seul
un vérificateur dérivé l'est.

L'alphabet exclut les caractères confondables à l'oral. La règle testée n'est
pas « tel caractère est interdit » mais « aucune paire confondable ne subsiste
en entier » : `S` est sans danger dès lors que `5` est absent.

L'appairage lui-même est **simulé** tant que les deux moitiés vivent sur le même
appareil, et l'écran le dit. Le protocole, lui, est écrit pour être rejoué tel
quel côté serveur — c'est le serveur qui devra détenir le vérificateur.

### Nom de l'espace

Des mélanges des deux prénoms sont proposés : coupe à la deuxième voyelle,
accents dépliés, rejet des jonctions à trois voyelles ou lettres triplées.
« Rochambeau » + « Gaëlle » donne bien « Rochaelle » — c'est le cas de test.
Le champ libre reste maître, et « Notre espace » est toujours proposé en repli.

### Partages initiaux : deux mécanismes, volontairement côte à côte

Les voir sur le même écran fait comprendre la différence, qui est au cœur des
garde-fous :

- **Carte & Présence** est un partage **réciproque** : il n'existe que si les
  deux l'activent, chacun de son côté, via `ReglagePartage`.
- **Cycle** ne se négocie pas. Le niveau est choisi **exclusivement par la
  personne concernée**. Si ce n'est pas vous, l'écran affiche « c'est {prénom}
  qui choisira son niveau, depuis son propre appareil » — et
  `definirNiveauCycle` (`shared/types/cycle.ts`) **lève** si quelqu'un d'autre
  essaie. La règle est dans le modèle, pas seulement dans l'interface.

Trois niveaux sont définis (`discret`, `phases`, `complet`) ; seuls les deux
premiers sont proposés, conformément au P0. Baisser son niveau **n'envoie
aucune notification** — annoncer « elle en partage moins » transformerait un
droit en dette. En revanche le niveau courant reste lisible par les deux :
on ne cache pas l'état, on ne commente pas les changements.

---

## Socle de notifications

Logique dans `packages/shared/src/notifications/preferences.ts` (testée),
journal et préférences dans `stores/notificationsStore.ts`, réglages dans
`components/ReglagesNotifications.tsx`.

**Centralisation.** Aucun pôle n'émet de notification directement : tout passe
par `publier`, qui interroge `deciderRemise`. C'est la seule façon de tenir des
règles à l'échelle de l'app plutôt que des exceptions disséminées. Le journal de
réciprocité qui vivait dans `sessionStore` a été déplacé ici.

**Préférences personnelles, pas conjugales.** Mon mode ne pas déranger est le
mien : les préférences sont indexées par partenaire, et mon partenaire n'est pas
informé de mes réglages — ce n'est pas une information qui le concerne.

**Fréquence réglable** par catégorie : tout de suite, groupées, une fois par
jour, jamais. Plus une pause manuelle (1 h, 4 h, jusqu'à demain) qui reprend
d'elle-même.

**Ne pas déranger** avec plage traversant minuit (22:30 → 07:30 par défaut), cas
testé explicitement parce que c'est là que ce genre de logique casse.

Deux garanties tenues par le code et vérifiées par les tests :

1. **Le SOS passe toujours.** Ni le mode ne pas déranger, ni une pause, ni un
   réglage « jamais » ne peuvent le retenir. Une app de couple qui avale une
   alerte de détresse parce qu'il est 23 h a échoué à la seule chose qui
   comptait vraiment.
2. **Les changements de partage sont impératifs eux aussi.** Sinon un partenaire
   pourrait couper les notifications qui tracent ses propres changements de
   réglage, et le mode furtif redeviendrait possible par la bande.

Rien n'est supprimé en silence : une notification retenue est `groupee` ou
`differee`, jamais perdue — sauf choix explicite « jamais », et l'entrée reste
malgré tout au journal avec sa raison.

### Le transport est côté serveur

Le socle décide du sort d'une notification ; c'est le serveur qui la transporte,
en rejouant le même `deciderRemise`. Voir `apps/api/README.md`, section
« Notifications push ». Il reste ici la partie mobile : demander la permission,
et faire connaître l'appareil au serveur.

---

## Notifications poussées — inscription de l'appareil

| Quoi | Où |
| --- | --- |
| Écran de demande de permission | `screens/NotificationsEcran.tsx`, route `/notifications` |
| Permission + inscription | `stores/pushStore.ts` |
| Jeton natif et repli de développement | `services/jetonAppareil.ts` |
| Appel serveur | `api/appareils.api.ts` → `POST /appareils` |
| Resynchronisation à l'ouverture de session | `hooks/useInscriptionPush.ts` |
| Affichage app ouverte | `services/affichagePush.ts` |

**Le jeton natif, pas un jeton Expo.** Le serveur parle directement à FCM et à
APNs : il attend le jeton d'enregistrement FCM côté Android, le jeton APNs
hexadécimal côté iOS. C'est `getDevicePushTokenAsync` qui les rend —
`getExpoPushTokenAsync` produirait un `ExpoPushToken[…]` que nos adaptateurs ne
sauraient pas router.

**On explique avant de demander.** L'écran précède la boîte de dialogue système,
parce qu'une permission demandée sans contexte se refuse par réflexe — et que sur
iOS elle ne se redemande plus jamais ensuite : il faut alors passer par les
réglages du téléphone.

**Un refus est une réponse.** Rien ne relance, ni à l'ouverture, ni après coup.
L'app fonctionne sans : le journal garde tout, consultable à l'ouverture. Et le
partenaire n'en est pas informé — refuser les notifications est un choix
personnel, le signaler à l'autre en ferait un reproche.

**La permission n'est jamais lue depuis le disque.** Seuls l'horodatage
d'inscription et le caractère factice du jeton sont persistés ; l'état de la
permission se relit auprès du système à chaque affichage, parce qu'elle a pu être
retirée dans les réglages iOS ou Android entre deux ouvertures.

**L'inscription suit la session.** `useInscriptionPush` la rejoue à chaque
ouverture de session et à chaque changement de partenaire : un jeton d'appareil
tourne tout seul (réinstallation, restauration de sauvegarde, rotation), et un
jeton périmé finirait délié par le serveur, laissant l'appareil muet pour de bon.
Déconnexion et dissociation appellent `oublier()` : cet appareil ne doit plus
être annoncé comme joignable pour quelqu'un qui vient de le quitter.

### Le jeton de développement — ce qu'il faut remplacer

Tant que le projet Firebase et la clé Apple n'existent pas, aucun jeton natif ne
peut être délivré : la demande échoue en simulateur, dans Expo Go, et sur tout
build sans identifiants. `obtenirLeJeton` retombe alors sur un **jeton factice**
`dev-<plateforme>-<32 hex>`, stable pour l'installation (trousseau système), qui
permet de vérifier toute la chaîne — inscription, réciprocité, dissociation qui
délie les appareils — sans qu'aucune notification n'arrive jamais.

Le préfixe `dev-` le rend reconnaissable au premier coup d'œil dans la table
`appareils` du serveur. L'interface le signale explicitement : quelqu'un qui a
accepté les notifications et n'en reçoit aucune doit savoir pourquoi, sinon il
cherchera une panne sur son téléphone.

**À faire une fois les comptes créés**, dans cet ordre :

1. ~~**Android / Firebase**~~ — **fait le 13 août 2026.** Projet `lonlonbenouapp`,
   app Android `com.lonlonbenu.app`, `google-services.json` dans `apps/mobile/`
   et déclaré dans `app.json`. Le fichier est ignoré par git. Les identifiants
   serveur sont dans `apps/api/.env` (voir l'étape 3), et
   `npm run verifier:fcm --workspace=@lonlonbenu/api` confirme que Google
   authentifie le compte de service.
2. **iOS / Apple** — créer une clé APNs (`.p8`) dans le compte développeur, noter
   son Key ID et le Team ID, et vérifier que le build porte l'entitlement
   `aps-environment` (EAS l'ajoute dès que les identifiants push sont
   configurés). Le bundle identifier est déjà `com.lonlonbenu.app`.
3. **Serveur** — renseigner les variables `LONLONBENU_FCM_*` (fait) et
   `LONLONBENU_APNS_*` dans `apps/api/.env`, documentées dans
   `apps/api/README.md`. Garder
   `LONLONBENU_APNS_PRODUCTION` non défini pour les builds de développement :
   pousser un build de développement vers la production Apple échoue en silence,
   et on cherche longtemps.
4. **Purger les jetons factices** de la table `appareils` :
   `DELETE FROM appareils WHERE jeton_push LIKE 'dev-%'`. Le serveur finirait par
   les délier tout seul — FCM répond `INVALID_ARGUMENT` sur un jeton inventé, ce
   que l'adaptateur classe en jeton mort — mais autant ne pas envoyer un premier
   lot d'échecs pour l'apprendre.
5. **Rien à changer dans le code mobile.** `getDevicePushTokenAsync` se mettra à
   répondre, `factice` passera à `false`, et le repli cessera d'être emprunté. Le
   test de la chaîne se fait alors sur deux appareils physiques — un simulateur
   iOS ne reçoit pas de push.

Ce qui n'est **pas** fait ici : les canaux de notification Android
(`setNotificationChannelAsync`), qui donneraient à l'utilisateur un réglage
système par catégorie. Nos catégories sont déjà réglables dans l'app, et deux
jeux de réglages concurrents pour la même chose se contrediraient. À revoir si le
regroupement Android le demande.

---

## Reste à faire

- [ ] Identifiants Firebase / Apple, en remplacement du jeton de développement
- [ ] Regroupement planifié côté serveur au-delà de la fenêtre d'une heure

## Règle

Tout nouveau module sensible s'enregistre dans `MODULES_INITIAUX` et passe par
`basculerConsentement` — jamais par une écriture directe du booléen. C'est ce qui
garantit qu'aucun changement ne peut se produire sans que les deux partenaires
soient prévenus.
