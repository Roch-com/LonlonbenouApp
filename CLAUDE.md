# LONLONBENU — L'application hub du couple

> Contexte projet pour Claude Code. Référence complète : `docs/cahier-des-charges.pdf` (à copier dans le repo).
> Nom de marque : **LONLONBENU** (Lonlon = l'amour, Benou = la chose → « la chose de l'amour »).
> Couple pilote / environnement de test : **Rochaelle** (Rochambeau & Gaëlle).

## Vision

Hub numérique premium pour couples : communication, organisation, présence et intimité dans une seule app. Objectif produit : devenir le "mémoire externe" du couple pour réduire les ruptures liées au manque de communication.

## Garde-fous éthiques — NON NÉGOCIABLES

Ces règles priment sur toute autre considération technique. Toute fonctionnalité touchant aux modules sensibles (position, cycle, axes de croissance, score, confidences) DOIT respecter :

1. **Réciprocité stricte** — ce qui est visible par l'un l'est dans les mêmes conditions pour l'autre. Jamais d'observation à sens unique. À vérifier explicitement dans chaque PR touchant à ces modules.
2. **Consentement et opt-in symétrique** — activation conjointe à l'onboarding, désactivation possible à tout moment par chacun, sans notification négative envoyée à l'autre.
3. **Aucun mode furtif** — aucune fonctionnalité ne doit permettre à un partenaire d'observer l'autre sans que celui-ci en soit informé (ex. : pause du partage de position toujours notifiée symétriquement).
4. **Bienveillance dans les textes** — micro-copy, notifications, messages d'erreur : jamais de ton culpabilisant ou moralisateur.

Si une implémentation demandée contredit ces principes, le signaler avant de coder.

## Stack technique recommandée

- **Mobile** : React Native (cross-platform iOS/Android)
- **Backend** : API REST/GraphQL, Node.js ou équivalent, PostgreSQL pour les données structurées
- **Données sensibles** (position, cycle, chat, confidences) : chiffrement de bout en bout (protocole type Signal), chiffrement au repos AES-256 pour le reste
- **Temps réel** : WebSocket ou service managé (Firebase/Pusher) pour le chat
- **Cartographie** : Mapbox ou Google Maps Platform, géolocalisation adaptative (fréquence réduite à l'arrêt)
- **Notifications** : FCM / APNs
- **Auth** : OAuth2/JWT

## Identité de marque (pour le design système)

**La source de vérité est `packages/shared/src/design/tokens.ts`**, jamais cette
section : elle a décrit pendant un temps une palette dorée qui n'existait plus
dans le code.

- **Le bleu est la couleur principale** : `#1D4E89`, `#123661` en foncé.
- **L'or (`#A98A4C`) est un accent secondaire**, réservé aux moments rares. Le
  répandre le banalise et le fait virer « application bancaire ».
- Rose `#A8455A`, ivoire `#F5F8FC`, encre `#0F1D30`.
- Typographie : serif élégante pour les titres (ex. Cormorant Garamond), sans-serif lisible pour le contenu (ex. Manrope)
- Ton : premium, glamour, fluide — jamais utilitaire ou froid

### Le logo — « Le Creux »

Deux moitiés qui se rejoignent ; le cœur n'est jamais dessiné, c'est le vide
qu'elles laissent entre elles. Trois choix l'éloignent du carré bleu générique :
une **superellipse** plutôt qu'un rectangle arrondi (elle se tient comme un
sceau, pas comme une pastille d'interface), **deux bleus** plutôt qu'un (deux
personnes, pas un bloc), et une **ligne d'or à la jointure, interrompue par le
cœur**.

`design/logo/creux.py` fait foi pour le dessin. Il produit deux choses, et les
deux doivent être régénérées ensemble après toute retouche :

```
python3 design/logo/creux.py apps/mobile/assets          # les icônes
python3 design/logo/creux.py --ts > apps/mobile/src/components/chrome/traces.ts
```

`traces.ts` est engendré — ne pas le modifier à la main. Il porte les mêmes
contours en SVG : les deux moitiés, leurs versions monochromes, le creux et la
jointure. `Marque.tsx` en tire les déclinaisons (couleur, monochrome, inversée
et les assemblages), `MarqueAnimee.tsx` l'ouverture.

La charte complète — construction, déclinaisons, air minimal, interdits, cas
d'usage et spécification du mouvement — est publiée :
<https://claude.ai/code/artifact/1ad1721b-524d-49c1-abd3-dcb294289622>

Elle existe aussi en PDF, `docs/LONLONBENU_Charte_Marque_Le_Creux.pdf`, engendré
de la **même** page — seule change la feuille d'impression :

```
python3 design/logo/charte_pdf.py <charte.html> docs/LONLONBENU_Charte_Marque_Le_Creux.pdf
```

Deux choses à savoir si on y retouche. La feuille d'impression doit redéclarer
ses jetons clairs sur `:root:not([data-theme="light"])` et pas seulement sur
`:root` : la page porte ses jetons sombres sur ce sélecteur-là, plus spécifique,
et un aperçu sorti sur une machine en thème sombre donne du texte clair sur le
fond blanc forcé. Et les polices viennent de Google Fonts au moment du rendu :
sans `--virtual-time-budget`, le PDF sort en police de repli sans rien dire.

Deux pièges rencontrés, à ne pas réintroduire :

- **Le rognage d'Android** ne suit pas la boîte englobante mais le **rayon
  maximal depuis le centre**. Le premier avant-plan débordait du cercle alors
  que sa boîte tenait. `SUR_ANDROID` le calcule.
- **La ligne d'or ne peut pas être percée par « pair-impair »**, contrairement
  au sceau : ce mode inverse ce qui est couvert deux fois, et le cœur étant
  bien plus large que la bande, c'est le cœur entier qui se remplissait d'or.
  La soustraction est faite dans le générateur (`jointure_svg`), qui livre deux
  polygones disjoints.
- **Alléger un contour se fait avant de le couper, jamais après.** La coupe
  introduit les deux sommets qui tiennent le bord droit d'une moitié ; les
  décimer ensuite en supprime un sur six, et le bord devient une diagonale qui
  traverse le sceau.

## Les 6 pôles fonctionnels et priorités MVP

Légende : **P0** = MVP obligatoire · **P1** = V1.1 · **P2** = évolution ultérieure

### Pôle ① — Présence & connexion quotidienne

- Tableau de bord / Accueil — **P0**
- Carte & Présence (géoloc) — **P0** statuts manuels + check-in + SOS · **P1** carte temps réel, ETA, geofencing, point de rencontre à mi-chemin
- Chat du couple — **P0** messagerie + notes douces + humeur · **P1** messages programmés, modèles guidés
- Compteur & Widgets — **P0** compteur · **P1** widgets écran verrouillé

### Pôle ② — Communication profonde & croissance

- Axes de croissance (fonctionnement en miroir obligatoire, jamais à sens unique) — **P0** structure de base · **P1** assistant de reformulation
- Espace de confidences — **P0** gratitude + lettres · **P1** questions de complicité, brouillon différé 24h
- Parcours guidé du couple — **P1**
- Score d'implication (jamais une note de la personne, toujours de l'activité observable ; score de couple mis en avant plutôt que classement individuel) — **P0** base + suggestions privées · **P1** historique avancé

### Pôle ③ — Vie pratique partagée

- Calendrier partagé — **P0**
- Projets de couple — **P0** projets/jalons · **P1** projet surprise (visible d'un seul partenaire jusqu'à révélation programmée)
- Finances partagées — **P1** saisie manuelle · **P2** agrégation bancaire
- Initiatives & sorties — **P0** création/journal · **P1** catalogue algorithmique

### Pôle ④ — Intimité & bien-être

- Cycle & fertilité (3 niveaux de partage contrôlés EXCLUSIVEMENT par la partenaire concernée) — **P0** saisie/calcul/partage niv.1-2 · **P1** synchro santé, mode désir d'enfant
- Complicité & connexion — **P1**

### Pôle ⑤ — Mémoire & complicité

- Souvenirs / Album — **P1**
- Love Map — **P1**
- Journal du couple — **P2**

### Pôle ⑥ — Sécurité & réglages (transverse)

- Réglages du couple — **P0**
- Notifications intelligentes — **P0** socle · **P1** personnalisation fine
- Sécurité & confidentialité (verrou biométrique, dissociation de compte en cas de rupture avec révocation immédiate des accès croisés) — **P0**

## Conventions de code (à ajuster en Sprint 0)

- Structure suggérée : `/apps/mobile`, `/apps/api`, `/packages/shared` (types, design tokens)
- Nommage des dossiers par pôle : `features/presence`, `features/croissance`, `features/vie-pratique`, `features/intimite`, `features/memoire`, `features/reglages`
- Toute entité sensible (position, cycle, confidences, messages) porte un champ de visibilité explicite en base — ne jamais faire de requête qui contourne ce filtre
- Tests obligatoires sur la logique de réciprocité avant de merger un module sensible
- **Toute modification du schéma ou d'un type persisté doit être vérifiée contre PostgreSQL**, pas seulement en mémoire :

  ```
  LONLONBENU_TEST_DATABASE_URL=<url> npx vitest run apps/api
  ```

  Le dépôt en mémoire range l'objet entier ; l'adaptateur SQL n'écrit que les colonnes qu'il nomme, et la base porte des contraintes que la mémoire ignore. Un champ ajouté à un type et oublié dans la migration compile, passe toute la suite en mémoire, et se perd **silencieusement** à chaque écriture réelle. C'est arrivé deux fois : `dureeDeclaree` du cycle, et le module `activite` absent du `CHECK` de `partages`.
- Ne jamais compléter une migration déjà appliquée : le lanceur l'enregistre et ne la rejoue nulle part. Toujours un nouveau fichier numéroté.
- **Monter `expo.version` dès qu’une dépendance native change** (ajout, retrait ou montée de version d’un module natif). La version d’exécution des mises à jour OTA en découle (`runtimeVersion: appVersion`) : l’oublier laisserait un JavaScript neuf atterrir sur un binaire qui ne l’attend pas.

  La politique `fingerprint`, plus automatique, a été essayée puis retirée : elle exige que la machine locale et EAS calculent le même hachage, ce qu’un `app.config.js` conditionnel et des paquets désalignés suffisent à casser. Le build échoue alors à « Configure expo-updates », sans qu’aucune vérification locale ne l’ait vu venir.
- **`eas update` ne lit pas le bloc `env` du profil de build.** Celui-ci ne vaut
  que pour `eas build`. Les variables `EXPO_PUBLIC_*` d'une mise à jour à
  distance viennent des variables d'environnement **EAS** (`eas env:set
  --environment preview`), et elles sont insérées dans le paquet au moment de
  l'empaquetage.

  Publier une mise à jour sans elles produit une application qui cherche son
  serveur sur `127.0.0.1` et n'affiche qu'un « pas de connexion ». Rien ne dit
  que c'est un défaut de configuration. C'est arrivé, et les deux comptes se
  sont retrouvés déconnectés.

  Vérifier avant chaque `eas update` : `npx eas-cli env:list --environment
  preview` doit montrer `EXPO_PUBLIC_API_URL`. Hors développement, l'absence
  d'adresse est désormais signalée à l'écran plutôt que déguisée en panne de
  réseau (`estConfigurationManquante` dans `lib/api/configuration.ts`).
- **Ne jamais interroger la base plus souvent qu'elle ne s'endort.** Le
  balayage des rappels tournait toutes les cinq minutes dans le processus du
  serveur ; Neon suspend son calcul après cinq minutes d'inactivité. La base
  ne dormait donc jamais, tournait jour et nuit, et le palier gratuit a fini
  par refuser toute connexion — `53000`, « quota dépassé ». Plus personne ne
  pouvait se connecter, et `/sante` répondait « ok », puisqu'elle ne regardait
  que le processus.

  `LONLONBENU_RAPPELS_INTERVALLE_MIN=0` éteint le balayage interne ; c'est la
  tâche planifiée externe qui appelle `/taches/rappels` et fixe la cadence.
  La sonde de maintien en éveil de Render doit viser `/sante`, qui ne touche
  pas la base — jamais une route qui s'en sert.

  `/sante/base` donne l'état réel et nomme la cause (`quota_depasse`,
  `mot_de_passe_refuse`, `hote_introuvable`…) sans livrer la chaîne de
  connexion. Elle est séparée de `/sante` à dessein : liée à la sonde de
  l'hébergeur, une base tombée ferait redémarrer le service en boucle.

- Les journaux de build EAS sont compressés en **Brotli** : `curl --compressed` pour les lire. Ils portent la vraie cause, là où `eas build:view` ne rend qu’un « Unknown error ».

## État actuel du projet

- [x] Cahier des charges v1.2 validé (voir `docs/`)
- [x] Sprint 0 : Expo SDK 57 côté mobile ; Node.js + Fastify + PostgreSQL côté API ; auth OAuth2 (Authorization Code + PKCE, JWT RS256) ; schéma dans `apps/api/src/db/schema.sql`
- [x] Scaffold initial de l'app mobile — Expo SDK 57 + expo-router, monorepo npm workspaces
- [x] MVP P0, pôle par pôle — ① ② ③ ④ ⑥ faits ; ⑤ n'a rien en P0 (tout est P1/P2)
- [x] Client réseau mobile : OAuth2 PKCE, jetons au trousseau, rafraîchissement automatique ; axes de croissance adossés au serveur (première tranche verticale)
- [x] Cycle (④) adossé au serveur : `vuePartenaire` rejoué côté serveur, onboarding rewiré sur le vrai appairage
- [x] Confidences (②) adossées au serveur : brouillons strictement locaux, envoi irréversible
- [x] Chat (①) chiffré de bout en bout (X25519 + XChaCha20-Poly1305) et Présence (①) adossés au serveur
- [x] Vie pratique (③) adossée au serveur ; rappels émis par un planificateur serveur via `deciderRemise`, la boucle mobile est supprimée
- [x] **Tous les pôles sont adossés au serveur** — plus aucune source de vérité locale
- [x] P1 : Carte & Présence, pôle ⑤ (Souvenirs, Love Map), Finances partagées
- [x] P1 : Parcours guidé (§8.7), Complicité & connexion (§8.14)
- [x] P2 : Journal du couple (§8.17) — module de synthèse, ne stocke rien
- [x] §8.11 complété : enveloppes de projet, factures récurrentes et leurs rappels
- [x] **Audit ligne à ligne du cahier v1.1** — six manques trouvés et comblés :
      §8.1 (prochaine échéance de projet, dernière note douce reçue), §8.5
      (importance, progrès reconnu, limite d'axes actifs), §8.10 (catégorie,
      jalons assignables), §8.18 (nom d'espace, qui ne quittait jamais le
      téléphone qui l'avait choisi)

- [x] Notes vocales (§8.3) — audio scellé, rangé en base, durée plafonnée à
      deux minutes. **Version montée à 0.2.0** : `expo-audio` est un module
      natif, l'APK 0.1.0 ne recevra plus les mises à jour.

- [x] Logo « Le Creux » et ouverture animée — les deux moitiés se rejoignent et
      le cœur naît de leur rencontre. **Version montée à 0.4.0** :
      `react-native-svg` est un module natif, et une mise à jour OTA portant ce
      JavaScript atterrirait sur un binaire qui ne l'embarque pas. Il faut un
      nouveau build, pas un `eas update`.

### Ce qui reste, et pourquoi

Bloqué sur autre chose que du code — à ne pas redémarrer sans avoir levé le
préalable :

- [ ] **Photos, vidéos et images de couverture (§8.15, §8.10)** — aucun stockage
      d'objets n'est provisionné, et la base actuelle n'a pas la capacité.
      Demande un compartiment (R2, S3 ou équivalent) avant toute ligne de code.
- [ ] **Widgets écran verrouillé (§8.4, P1)** — cibles natives WidgetKit (iOS) et
      App Widgets (Android) : `expo prebuild`, du Swift et du Kotlin, et rien de
      vérifiable sans build sur appareil.
- [ ] **Synchro santé (§8.13, P1)** — Apple Health / Google Fit : autorisations
      natives, et une revue de confidentialité d'App Store pour les données de santé.
- [ ] **Agrégation bancaire (§8.11, P2)** — exige un contrat d'agrégateur
      (Bridge, Powens…) et les obligations réglementaires qui vont avec.
- [ ] **Appels : le serveur TURN.** Le reste est fait — signalisation scellée,
      WebRTC pair-à-pair, écran d'appel. Sans TURN, les appels aboutissent
      depuis une connexion domestique et échouent souvent quand les deux sont
      en données mobiles : les opérateurs placent les téléphones derrière un
      NAT qui interdit toute liaison directe.

      Rien à recoder pour l'ajouter : `EXPO_PUBLIC_SERVEURS_ICE` accepte un
      JSON de `RTCIceServer`. Un Coturn auto-hébergé demande un VPS avec UDP
      (Render ne convient pas) ; sinon un service à la bande passante.

Restant purement technique :

- [ ] Chat : passer à un double ratchet (bibliothèque auditée) pour la confidentialité persistante
- [ ] Tests avec le couple pilote Rochaelle
