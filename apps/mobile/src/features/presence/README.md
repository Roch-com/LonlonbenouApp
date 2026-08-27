# Pôle ① — Présence & connexion quotidienne

Périmètre **implémenté (P0)** :

| Module                                            | État  | Où                                                             |
| ------------------------------------------------- | ----- | -------------------------------------------------------------- |
| Tableau de bord / Accueil                         | ✅ P0 | `screens/AccueilEcran.tsx`                                     |
| Carte & Présence — statuts manuels, check-in, SOS | ✅ P0 | `screens/PresenceEcran.tsx`, `screens/SosEcran.tsx`            |
| Chat du couple — messagerie, notes douces, humeur | ✅ P0 | `screens/ChatEcran.tsx`                                        |
| Compteur                                          | ✅ P0 | `components/CompteurCarte.tsx` + `@lonlonbenu/shared/compteur` |

**Hors périmètre pour l'instant (P1)** : carte temps réel, ETA, geofencing, point
de rencontre à mi-chemin, messages programmés, modèles guidés, widgets écran
verrouillé.

## Chat et Présence sont passés au serveur

### Le chat est chiffré de bout en bout

Chaque appareil tire une paire **X25519** dont la moitié privée reste dans le
trousseau système (`services/clesMessages.ts`), publie sa clé publique, et
dérive la clé de messages par ECDH + HKDF. Les messages sont scellés en
XChaCha20-Poly1305 avant de partir.

Conséquences concrètes :

- **Le cache local ne contient que des enveloppes scellées.** Le clair n'existe
  qu'en mémoire, le temps du rendu (`hooks/useLecturesDechiffrees.ts`). Lire le
  stockage local ne livrerait rien de plus que ce que le serveur possède déjà.
- **Le type du message est dans l'enveloppe**, pas à côté : le serveur n'a pas à
  savoir si c'est une note douce ou un message ordinaire.
- **Un nombre de vérification** est affiché dans la conversation, à comparer de
  vive voix. C'est la seule parade contre un serveur qui substituerait une clé
  publique — et le serveur ne pourrait pas vous prévenir lui-même.
- **Tant que l'autre n'a pas publié sa clé, rien ne peut être envoyé.** L'écran
  le dit plutôt que de laisser un bouton actif qui échouerait.
- À la dissociation, la paire de clés est effacée : aucune enveloppe résiduelle
  ne pourra plus jamais être ouverte.

Limites assumées, détaillées dans le README de l'API : pas de confidentialité
persistante, pas de sécurité post-compromission, métadonnées non chiffrées, et
**perdre l'appareil c'est perdre l'historique**.

### La présence est arbitrée par le serveur

Le store ne filtre plus rien : sans réciprocité, le statut de l'autre **n'est
pas descendu** jusqu'à l'appareil. `CarteDuPartenaire` ne peut donc pas le
révéler par erreur d'affichage.

Les textes libres (note de statut, mot d'humeur, lieu de check-in, message de
SOS) sont scellés avec la même clé que les messages. Les codes, eux, circulent
en clair : ce sont des valeurs d'un ensemble fermé.

L'humeur a rejoint la présence plutôt que le chat — même personne, même règle de
réciprocité, même forme. Elle partage désormais la ligne de statut.

## Points d'attention

- **Aucune géolocalisation n'est collectée en P0.** Le check-in repose sur un lieu
  saisi ou choisi à la main. Le jour où la position réelle arrivera (P1), elle
  devra passer par `partages.position` — le partage n'est actif que si les deux
  partenaires ont consenti, et toute mise en pause notifie les deux.
- **Symétrie.** `CarteDuPartenaire` n'affiche que des champs que l'autre voit
  aussi à mon sujet. Toute donnée ajoutée ici doit l'être des deux côtés.
- **Persistance provisoire.** Les stores écrivent en clair via AsyncStorage,
  local à l'appareil. À remplacer par un stockage chiffré + backend chiffré de
  bout en bout avant toute synchronisation réseau.
- L'amorce de démonstration (`data/amorce.ts`) et le bascule de partenaire dans
  `NousEcran` sont des outils de test du couple pilote : à retirer avant la
  mise en production.
