# LONLONBENU

Hub numérique du couple. Monorepo npm workspaces.

```
apps/mobile        Application React Native (Expo SDK 57, expo-router)
apps/api           API Node.js + Fastify + PostgreSQL, authentification
                   OAuth2 (Authorization Code + PKCE, JWT RS256)
packages/shared    Design tokens, types métier, moteurs de réciprocité et de
                   miroir, coffre de chiffrement, compteur
```

## Démarrer

```bash
npm install
npm run mobile          # équivaut à expo start dans apps/mobile
```

Puis Expo Go, ou un build de développement (`npx expo run:android`) dès qu'un
module natif hors Expo Go sera nécessaire.

## Vérifications

```bash
npm test          # invariants partagés + API (dépôt en mémoire)
npm run typecheck # TypeScript strict sur tous les workspaces

# La même suite d'API, mêmes assertions, contre PostgreSQL :
LONLONBENU_TEST_DATABASE_URL=postgresql://user@host:5432/lonlonbenu_test \
  npx vitest run apps/api
```

## Structure de l'app mobile

```
app/                    routes expo-router (fichiers d'une ligne)
  (tabs)/index          Accueil
  (tabs)/presence       Carte & Présence
  (tabs)/chat           Chat du couple
  (tabs)/pratique       Agenda · Projets · Sorties
  (tabs)/croissance     Axes de croissance · Confidences · Notre élan
  (tabs)/nous           Compteur + partages
  sos                   Écran SOS (modal)
  reglages              Verrou, notifications (modal)
  cycle                 Cycle & fertilité (modal)
  dissociation          Séparation des comptes (modal)
  transparence-score    Fonctionnement du score (modal)

src/design/             pont entre les tokens partagés et React Native
src/components/ui/      briques visuelles génériques
src/lib/                chiffrement, stockage chiffré, formatage temporel
src/data/               amorce de démonstration du couple pilote
src/features/
  presence/             pôle ① — P0 fait
  croissance/           pôle ② — P0 fait (axes, confidences, score)
  vie-pratique/         pôle ③ — P0 fait (agenda, projets, sorties)
  intimite/             pôle ④ — P0 fait (cycle : saisie, phases, partage)
  memoire/              pôle ⑤ — réservé
  reglages/             pôle ⑥ — P0 fait (onboarding, consentements,
                        chiffrement, verrou, notifications, dissociation)
```

## Données locales

Tout ce que l'app persiste est chiffré au repos (XChaCha20-Poly1305), la clé
étant gardée par le trousseau système via `expo-secure-store`. Le raisonnement
complet — y compris pourquoi ce n'est pas AES — est dans
[le README du pôle ⑥](apps/mobile/src/features/reglages/README.md).

Chaque dossier de pôle porte un `README.md` qui liste ce qui reste à faire et
les contraintes éthiques propres au pôle.

## Le serveur rejoue, il ne réimplémente pas

`apps/api` importe `axeVisiblePar`, `verifierInvitation`, `deciderRemise` et
`creerPartage` depuis `packages/shared` et les exécute tels quels. Les tests
d'invariants écrits pour le mobile protègent donc aussi le serveur, et un
correctif ne peut pas n'être appliqué que d'un côté. Voir
[le README de l'API](apps/api/README.md).

## Avant de coder un module sensible

Position, cycle, axes de croissance, score, confidences : passer par
`packages/shared/src/privacy/reciprocite.ts`, et ajouter les tests d'invariants
correspondants. Les quatre garde-fous de `CLAUDE.md` priment sur toute
considération technique.
