# Pôle ③ — Vie pratique partagée

Périmètre **implémenté (P0)** :

| Module | État | Où |
| --- | --- | --- |
| Calendrier partagé | ✅ P0 | `components/SectionAgenda.tsx`, `shared/calendrier/agenda.ts` |
| Projets de couple — création, jalons, avancement | ✅ P0 | `components/SectionProjets.tsx`, `shared/projets/avancement.ts` |
| Initiatives & sorties — création + journal | ✅ P0 | `components/SectionSorties.tsx`, `shared/initiatives/journal.ts` |

**Hors périmètre**, et volontairement absents du modèle de données : projet
surprise (P1), finances partagées (P1 manuel / P2 agrégation), catalogue
algorithmique de sorties (P1). Les ajouter plus tard n'exigera pas de défaire ce
qui est là — voir la note sur `visibilite` ci-dessous.

## Le pôle est passé au serveur

**Cinquième et dernière tranche verticale.** Le rejeu a été le plus direct de
tous : ces données sont `couple` par construction, il n'y a ni consentement à
vérifier, ni miroir à faire jouer, ni niveau de partage. Le serveur contrôle
l'appartenance au couple, et c'est tout.

Le store ne garde plus qu'un cache d'affichage hors ligne. Aucune écriture sans
réseau : un événement ajouté hors ligne partirait on ne sait quand, et le
partenaire le découvrirait après coup — ou jamais.

## Les rappels ont quitté le mobile

`hooks/useRappels.ts` **a été supprimé**, et c'est le point de cette tranche.

Cette boucle ne tournait que l'app ouverte, toutes les cinq minutes : un rappel
du matin n'arrivait que si quelqu'un ouvrait l'app, c'est-à-dire à peu près
jamais au moment utile. Le planificateur serveur balaie les couples quoi que
fassent les deux téléphones, et passe par le même `deciderRemise` — donc reste
soumis au mode ne pas déranger et aux fréquences choisies.

Le mobile n'émet plus aucun rappel. Il n'en garde même plus les clés
d'idempotence : elles sont en base.

## Symétrie

Les trois modules sont **symétriques par construction**. Les fonctions de
lecture (`evenementsAVenir`, `avancementProjet`, `journal`) ne prennent aucun
lecteur en paramètre : il n'existe donc pas de version de l'agenda, du projet ou
du journal propre à l'un des deux. C'est le même procédé que pour le score de
couple du pôle ②, et il rend l'asymétrie impossible plutôt qu'interdite.

## Aucun décompte par personne

Deux tests verrouillent cette décision, un dans `avancement.test.ts`, l'autre
dans `journal.test.ts` : **aucune fonction n'agrège par partenaire**.

- Un projet de couple avance ou n'avance pas ; personne n'avance plus que
  l'autre. Une barre de progression par partenaire serait un classement
  individuel déguisé.
- Savoir « qui propose le plus de sorties » transformerait un élan en dette.

`Jalon.faitPar` et `Initiative.proposeePar` sont conservés pour afficher qui a
coché *un* jalon donné ou proposé *une* envie — information anodine et utile —
mais rien ne les compte.

## Le champ `visibilite` du calendrier

Il vaut **toujours `couple` en P0**. Un calendrier partagé avec des trous n'en
est plus un, et inventer un mécanisme de masquage que personne n'a demandé
aurait ouvert une porte difficile à refermer. Le champ existe parce que la
convention l'exige sur toute entité sensible, et parce que le **projet surprise
(P1)** en aura besoin : lui seul justifiera une autre valeur, bornée dans le
temps et consentie à la création.

## Rappels

`shared/rappels/rappels.ts` **propose** des rappels ; il n'en envoie aucun. La
décision de transmettre, grouper ou taire appartient au socle du pôle ⑥
(`deciderRemise`), qui reste le point de passage unique. Un rappel de la vie
pratique est donc soumis au mode ne pas déranger et aux fréquences choisies,
comme tout le reste.

Deux propriétés testées :

- **Un rappel s'adresse toujours aux deux.** Prévenir un seul partenaire
  reviendrait à lui confier la charge d'un agenda commun.
- **Chaque rappel porte une clé d'idempotence.** On ne redit pas deux fois la
  même chose : c'est ce qui sépare un rappel utile d'un harcèlement. Les clés
  émises sont conservées dans le store, sur une fenêtre glissante.

Fenêtres : événements selon le délai choisi à la création (1 h à 3 jours),
jalons de projet la veille et le jour même, sorties programmées le jour même.
Au-delà, on n'insiste pas.

## Un piège corrigé en route

`estPasse` comparait le début d'un événement « journée entière » à l'instant
courant, ce qui le faisait basculer dans le passé dès minuit une. Une journée
entière court jusqu'au bout du jour civil — le test `agenda.test.ts` couvre le
cas.

## Ce que le backend devra reprendre

Les rappels sont calculés côté client tant que l'app est ouverte. En production,
ils devront être planifiés côté serveur (ou via des notifications locales
programmées), sans quoi un rappel du matin n'arrivera que si quelqu'un ouvre
l'app. La fonction `rappelsDus` est pure, elle se rejoue telle quelle.
