# Pôle ② — Communication profonde & croissance

Périmètre **implémenté (P0)** :

| Module | État | Où |
| --- | --- | --- |
| Axes de croissance — structure de base | ✅ P0 | `components/SectionAxes.tsx`, `components/CarteAxe.tsx` |
| Espace de confidences — gratitude + lettres | ✅ P0 | `components/SectionConfidences.tsx`, `components/AtelierLettre.tsx` |
| Score d'implication — base + suggestions privées | ✅ P0 | `components/SectionScore.tsx`, `packages/shared/src/score/` |

**P1** : assistant de reformulation, questions de complicité, brouillon différé
24 h, parcours guidé, historique avancé du score.

---

## Le miroir des axes

Règle unique, dans `packages/shared/src/croissance/miroir.ts` :

> je vois toujours ma propre contribution ;
> je ne vois celle de l'autre que lorsque nous avons écrit tous les deux.

Ce n'est pas de la rétention. Sans cette règle, le premier qui écrit s'expose
seul, et le second répond à ce qu'il vient de lire au lieu de dire ce qu'il vit.
Surtout : **personne ne peut ouvrir un axe pour lire l'autre sans se livrer**,
donc l'axe à sens unique est structurellement impossible — pas seulement
interdit par convention.

Ce que le lecteur voit malgré tout : **le fait** que l'autre a déposé sa part
(`AxeVisible.lautreAContribue`), jamais son contenu. Cette information est
symétrique — les deux la reçoivent au même instant — et c'est elle qui permet
d'inviter sans dévoiler.

Deux garde-fous se cumulent sur les axes :

1. le consentement mutuel au module `croissance` (`privacy/reciprocite.ts`) —
   tant que les deux n'ont pas activé, l'écran ne montre que l'invitation ;
2. le miroir lui-même, au niveau de chaque axe.

Les tests d'invariants sont dans `packages/shared/src/croissance/miroir.test.ts`,
dont un cas qui fabrique un axe trafiqué pour vérifier que `verifierMiroir`
détecte bien une lecture à sens unique.

## Pourquoi les confidences n'ont pas d'interrupteur

`confidences` est listé parmi les modules sensibles, mais il n'est **pas** dans
`MODULES_INITIAUX` et ne demande aucun consentement mutuel. C'est un choix,
qu'il faut pouvoir défendre :

Un consentement réciproque sert à encadrer une **observation** — quelque chose
que l'un pourrait apprendre de l'autre sans que celui-ci ait agi. Une confidence
est l'inverse : c'est un geste. Rien ne peut être lu qui n'ait été écrit puis
envoyé sciemment par son auteur. La réciprocité est donc déjà structurelle, et y
ajouter un interrupteur ne protégerait de rien tout en rendant un geste
d'affection administratif.

Ce que ça implique en revanche, et qui est tenu dans le code :

- un brouillon est `prive` et le reste tant que son auteur ne l'envoie pas —
  aucun compte à rebours, aucune publication automatique ;
- l'envoi est irréversible, parce que le texte appartient aussi à l'autre à
  partir de là ; seul un brouillon peut être supprimé ;
- la lecture passe uniquement par `confidencesVisiblesPar`, jamais par la liste
  brute.

Si le brouillon différé 24 h arrive en P1, il devra rester **déclenché par
l'auteur** : un texte qui part tout seul, c'est un texte qu'on n'a pas envoyé.

## Les axes sont passés au serveur

**Première tranche verticale adossée à l'API.** Les axes ne vivent plus dans un
store local : ils sont lus et écrits sur le serveur, qui applique le miroir
avant de répondre.

Ce que ça change concrètement : `axeVisiblePar` n'est plus appelé côté mobile.
Le client reçoit des `AxeVisible` déjà filtrés, et la contribution de l'autre
**ne figure pas dans la réponse HTTP** tant que le miroir est incomplet. Le
filtrage local supposait qu'elle avait transité — donc qu'elle était lisible
pour qui regardait le trafic ou la mémoire.

`ContributionVisible.estLaMienne` est posé par le serveur : le client n'a plus
besoin de connaître l'identifiant de l'autre pour distinguer les deux côtés.

### Cache hors ligne

Le store persiste toujours, mais comme **cache d'affichage**, jamais comme
source de vérité :

- il est marqué au nom du partenaire pour lequel il a été filtré, et jeté à la
  moindre différence plutôt que montré à quelqu'un d'autre ;
- **aucune écriture n'y est possible hors ligne.** Une contribution déposée sans
  réseau partirait sans qu'on sache quand, et le partenaire découvrirait une
  réponse à une conversation qu'il croyait close. L'écran le dit et refuse,
  plutôt que de promettre un envoi différé ;
- l'écran annonce la date de la dernière synchronisation quand il montre du
  cache.

### Consentement

Le module `croissance` se règle désormais via `ConsentementServeur`, adossé à
`PUT /couples/:id/partages/croissance`. L'écran « Notre espace » bascule
automatiquement sur cette version dès qu'un couple existe côté serveur — sans
quoi deux sources de vérité auraient divergé en silence.

Les autres modules (`position`, `score`) restent locaux tant qu'ils n'ont pas
d'endpoint.

## Les confidences sont passées au serveur — en partie

**Modèle hybride, et c'est délibéré.** Contrairement aux axes et au cycle, le
serveur n'est pas la seule source de vérité : il l'est pour ce qui a été
**envoyé**, mais les **brouillons restent entièrement locaux**.

Une lettre en cours d'écriture n'est pas une donnée du couple, c'est une pensée
en train de se former. La faire transiter « pour la sauvegarder » la déposerait
sur un serveur, dans des sauvegardes, dans des journaux — alors qu'elle pourrait
ne jamais être envoyée. Elle reste donc sur l'appareil, chiffrée au repos par le
coffre, jusqu'au geste d'envoi.

Conséquences concrètes :

- **`confidences.api.ts` n'a aucune fonction de brouillon**, et c'est le point
  du module : un brouillon n'a pas de représentation réseau.
- **L'ordre de l'envoi ne perd rien** : serveur d'abord, brouillon effacé
  ensuite. Si le réseau tombe au mauvais moment, le brouillon est toujours là ;
  l'inverse aurait pu faire disparaître un texte sans l'avoir transmis.
- **C'est le seul module où l'absence de réseau n'empêche pas d'écrire.** Elle
  empêche seulement d'envoyer, ce qui est autre chose — l'atelier reste ouvert
  hors ligne, seul le bouton d'envoi se désactive.
- À la dissociation, les brouillons partent aussi : il ne doit rien rester, pas
  même ce qui n'a jamais été envoyé.

## Le score d'implication

Moteur dans `packages/shared/src/score/`, invariants dans `score.test.ts`.

### Ce qui est mesuré

Uniquement des **gestes déjà produits ailleurs dans l'app** : message, note
douce, humeur, statut, check-in, gratitude, lettre envoyée, ouverture d'axe,
contribution à un axe. Le score ne journalise rien de neuf et ne lit **aucun
contenu** — seulement le type du geste, son auteur et sa date.

Deux exclusions : les brouillons de lettres (les compter ferait fuiter leur
existence par le score) et tout ce qui n'est pas daté.

### Comment, et pourquoi ainsi

**Aucun geste ne pèse plus qu'un autre.** Il n'y a pas de barème : une lettre ne
« vaut » pas trois messages, parce que décider de ce qui compte le plus dans un
couple n'est pas le rôle d'une app. Le score ne regarde donc pas des quantités
mais des rythmes.

Trois composantes, sur une fenêtre glissante de 14 jours :

| Composante | Poids | Ce qu'elle regarde |
| --- | --- | --- |
| Régularité | 45 % | Jours où au moins un geste a eu lieu |
| Élan partagé | 35 % | Équilibre entre les deux rythmes, sans dire lequel est lequel |
| Variété | 20 % | Nombre de façons différentes de se rejoindre |

Conséquence directe : **le score ne se gonfle pas**. Cinquante messages dans la
même journée comptent comme un seul jour vivant.

### Les quatre garde-fous, tenus par la forme de l'API

1. **Jamais une note d'une personne.** Il n'existe volontairement **aucune
   fonction qui renvoie un score individuel** — ni pour soi, ni pour l'autre. Un
   test vérifie que le module n'exporte rien qui y ressemble, pour que
   l'interdit survive aux prochaines modifications.
2. **Un seul score, celui du couple.** `scoreDuCouple` ne prend pas de lecteur
   en paramètre : il est structurellement impossible d'en afficher une version
   différente à l'un et à l'autre. Pas de classement, pas de colonne
   « vous / lui ».
3. **Suggestions privées et autoréférentielles.** Elles n'apparaissent que si je
   me suis retiré **par rapport à mon propre passé**, jamais par comparaison
   avec l'autre. Elles ne produisent aucune notification et ne laissent aucune
   trace lisible par le partenaire. Si mon partenaire s'éloigne, on ne me le
   signale pas : ce n'est pas à moi de porter son rythme.
4. **Aucune série à ne pas rompre.** Pas de « streak », pas de compte à rebours.
   Un mécanisme qui punit l'oubli fabrique de l'anxiété, pas du lien.

Deux détails qui vont dans le même sens : les suggestions sont plafonnées à deux
et proposent d'abord le geste le plus léger — suggérer « ouvre un axe de
croissance » à quelqu'un qui s'éloigne serait à contretemps ; et un couple
simplement peu actif depuis toujours n'est **jamais** relancé, faute de quoi ce
serait du harcèlement et non de l'aide.

L'écran affiche enfin, en toutes lettres, que le score ne mesure que ce qui
passe par l'app : une soirée entière sans téléphone n'y apparaît pas.

### Choix à arbitrer

« Suggestions en cas de baisse » a été lu comme **ma** baisse, pas celle du
couple. Si le score de couple chute parce que l'autre s'est retiré, me suggérer
d'agir reviendrait à me faire porter son retrait — et, indirectement, à me
signaler qu'il a décroché. Le score est par ailleurs soumis au consentement
mutuel du module `score`, comme les axes.

## Ce que le backend devra reprendre

Le filtrage du miroir est appliqué côté client parce qu'il n'y a pas encore de
serveur, et que les deux partenaires partagent le même appareil de test. **Ce
n'est pas suffisant en production** : le serveur ne devra jamais transmettre la
contribution de l'autre tant que le miroir n'est pas complet. `axeVisiblePar`
est écrit pour être rejoué tel quel côté backend.

Même remarque pour le score : `suggestionsPrivees` doit être calculé côté
serveur **pour un seul destinataire à la fois**, et son résultat ne doit jamais
transiter par un canal que l'autre partenaire peut lire.
