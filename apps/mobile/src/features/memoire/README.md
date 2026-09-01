# Pôle ⑤ — Mémoire & complicité

## Fait

- [x] Souvenirs / Album (§8.15) — sans les médias
- [x] Love Map (§8.16)

Une seule table pour les deux : un souvenir et un lieu visité ne diffèrent que
par la présence de coordonnées, qui vivent dans l’enveloppe. Les séparer aurait
obligé à choisir, en écrivant, si un voyage appartient à l’histoire ou à la
géographie — alors qu’il est évidemment les deux.

## Deux choix à connaître avant de modifier

**La date est en clair**, le reste est scellé. « Il y a un an » suppose de
retrouver les souvenirs d’un jour sans les ouvrir, ce qu’aucune clé côté
serveur ne permet. Une date seule dit qu’il s’est passé quelque chose ce
jour-là, sans dire quoi ni où.

**La Love Map ne s’alimente pas automatiquement**, contrairement à ce que
prévoyait le §8.16. Le pôle ① ne conserve aucun historique de position,
précisément pour ne pas détenir la chronique des déplacements du couple : les
deux ne pouvaient pas coexister. Les lieux se marquent volontairement.

## Reste à faire

- [ ] Photos et vidéos dans l’album (§8.15) — compression, chiffrement et
      stockage des médias. Bloqué sur l’infrastructure : la base actuelle n’a
      pas la capacité, et aucun stockage d’objets n’est provisionné.

## Fait depuis

- [x] Rattachement d’un souvenir à un projet ou une sortie (`origine`),
      proposé à la saisie et affiché dans l’album
- [x] Journal du couple (§8.17) — troisième onglet de cet écran. Il ne stocke
      rien : le serveur compose ce qu’il peut lire, le mobile y ajoute les
      souvenirs qu’il vient d’ouvrir.
