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

- Palette : or/champagne `#9C7A3C`, or foncé `#6E5424`, rose poudré `#B85C6B`, ivoire `#FBF6EC`, encre `#2B2420`
- Typographie : serif élégante pour les titres (ex. Cormorant Garamond), sans-serif lisible pour le contenu (ex. Manrope)
- Ton : premium, glamour, fluide — jamais utilitaire ou froid

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
- [ ] Chat : passer à un double ratchet (bibliothèque auditée) pour la confidentialité persistante
- [ ] Tests avec le couple pilote Rochaelle
