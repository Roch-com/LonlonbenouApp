# Pôle ④ — Intimité & bien-être

| Module | État | Où |
| --- | --- | --- |
| Cycle & fertilité — saisie, calcul des phases, affichage partenaire | ✅ P0 | `screens/CycleEcran.tsx`, `shared/cycle/` |
| Complicité & connexion | ❌ P1 | — |

**Hors périmètre, absents du modèle** : synchronisation Apple Santé / Google Fit
et mode désir d'enfant (P1).

---

## Le cycle est passé au serveur

**Deuxième tranche verticale adossée à l'API**, après les axes. Le module ne
calcule plus rien côté mobile : `vuePartenaire` et `etatDuCycle` sont exécutés
sur le serveur, qui renvoie une réponse **de forme différente selon qui
demande**.

Conséquence concrète : sur le téléphone du partenaire, il n'y a **aucune donnée
de cycle en mémoire**. Ni dates, ni symptômes, ni jour de cycle ne descendent
jusqu'à lui — `VuePartenaireCycle` ne reçoit que la projection déjà mise en
forme, et ne peut donc rien révéler par accident.

Le store local a été vidé de sa logique : il range la réponse telle quelle. Le
cache persisté est un **cache d'affichage**, marqué au nom de la personne pour
laquelle il a été mis en forme et jeté à la moindre différence — celui du
partenaire et celui de la personne concernée n'ont pas du tout le même contenu.
Aucune écriture hors ligne : une saisie de règles partie on ne sait quand
fausserait les prévisions sans qu'on sache pourquoi.

Le réglage du niveau a aussi quitté l'onboarding local, qui en tenait une copie
divergente : `EtapePartagesInitiaux` renvoie désormais vers l'écran Cycle, et
`sessionStore` n'a plus de champ `cycle` du tout.

## Qui peut quoi

Le niveau de partage **et** la saisie appartiennent exclusivement à la personne
concernée. Deux verrous, pas un :

- `estLaPorteuse` (`shared/types/cycle.ts`) est le point de contrôle unique de
  toute écriture, appelé par chaque action du store ;
- `definirNiveauCycle` **lève** si quelqu'un d'autre tente de changer le niveau.

L'interface ne propose jamais la saisie à l'autre partenaire, mais le store la
refuserait de toute façon. Une règle qui n'existe qu'à l'écran finit toujours
par être contournée par un raccourci ajouté plus tard.

## Ce que le calcul fait, et ne fait pas

Tout part des dates saisies à la main. Rien n'est déduit d'un capteur, d'un
agenda ou d'une humeur, et le module ne lit **jamais** les données des autres
pôles.

- Moyenne des six derniers intervalles observés, bornée entre 21 et 40 jours ;
  les valeurs aberrantes (une saisie oubliée qui produit un « cycle » de 90
  jours) sont écartées plutôt que moyennées.
- Phase lutéale supposée constante à 14 jours — l'hypothèse la plus stable.
- `estimations.fiable` est **faux** tant qu'il n'y a pas deux cycles observés :
  l'écran annonce alors un « repère indicatif », pas une prévision. Afficher une
  certitude qu'on n'a pas est le principal défaut de ce genre d'outil.
- Les phases sont attribuées **par précédence**, pas par intervalles calculés
  séparément : sur un cycle de 21 jours, des plages indépendantes se
  chevaucheraient ou laisseraient des trous. Un test vérifie que la frise est
  continue de 21 à 40 jours.
- Un cycle qui s'allonge est signalé sans aucune conclusion : un retard a mille
  causes, et ce n'est pas à une app de les évoquer.

`AVERTISSEMENT_MEDICAL` est affiché en permanence à la personne concernée : ce
n'est ni un avis médical, **ni un moyen de contraception**, ni une méthode
fiable pour éviter ou obtenir une grossesse.

## Les trois niveaux côté partenaire

`vuePartenaire` est la **seule** porte de lecture ; aucun écran n'accède
directement à l'état du cycle. Le niveau ne filtre pas un affichage après coup,
il détermine la forme même de l'objet rendu — un niveau `discret` ne contient
aucun champ de phase, il n'y a donc rien à oublier de masquer.

| Niveau | Ce que l'autre voit |
| --- | --- |
| Rien du tout | Aucune carte, aucune trace |
| Discret | Un seul signal : « ces jours-ci méritent un peu plus d'attention ». Aucun nom de phase |
| Les phases | La phase en cours, en langage d'accompagnement, plus des gestes concrets |

**Ne sortent jamais, quel que soit le niveau** : les symptômes, les notes
personnelles, les dates, et même le numéro du jour de cycle (qui permettrait de
reconstituer les dates). Un test le vérifie sur les quatre niveaux.

Le niveau 3 (`complet`) est déclaré mais **pas ouvert** ; tant qu'il ne l'est
pas, il est traité comme le niveau 2. Sous-partager est une erreur réparable,
l'inverse ne l'est pas.

## Le langage adressé au partenaire

C'est le point le plus sensible du module. « C'est tes hormones » est
exactement ce que cette app ne doit jamais permettre de dire, et une
fonctionnalité mal formulée le dirait à la place du partenaire.

Trois règles, chacune tenue par un test :

1. **Aucun vocabulaire clinique.** Ni symptôme, ni syndrome, ni hormone, ni
   fertilité, ni diagnostic. Le partenaire n'a pas de dossier médical à lire.
2. **Aucune interprétation de son comportement.** Ni irritabilité, ni humeur, ni
   « à cause de », ni « c'est normal qu'elle… ».
3. **On parle des jours, jamais de la personne.** Aucune lecture destinée au
   partenaire ne contient le mot « elle » : le sujet grammatical est la période,
   pas elle. « Ces jours-ci demandent souvent un peu plus de douceur », jamais
   « elle va être fatiguée ».

Les `attentions` proposent des **gestes**, pas des explications : prendre une
corvée, alléger la semaine, proposer quelque chose de calme.

Et `RAPPEL_AU_PARTENAIRE`, affiché au-dessus de tout le reste dès qu'il y a
partage :

> Ce que vous lisez ici ne dit pas comment elle va aujourd'hui. Si vous voulez
> le savoir, demandez-lui — et n'attribuez jamais ce qu'elle ressent à son
> cycle.

## Aucune notification

Le module n'émet **rien** vers le socle du pôle ⑥ : pas d'alerte « elle entre
dans telle phase ». Une notification de ce genre transformerait un partage
consenti en surveillance, et fournirait au partenaire exactement la phrase qu'il
ne faut pas dire. Le partenaire consulte s'il le souhaite ; l'app ne le sollicite
jamais là-dessus.

## Reste à faire (P1)

- [ ] Niveau 3 (partage complet, symptômes inclus)
- [ ] Synchronisation Apple Santé / Google Fit
- [ ] Mode désir d'enfant
- [ ] Complicité & connexion
