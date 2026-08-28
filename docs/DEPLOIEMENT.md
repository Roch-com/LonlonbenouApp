# Rendre LONLONBENU joignable partout

Tant que l'API tourne sur un ordinateur portable et que l'app charge son code
depuis Metro, il ne s'agit pas d'une application : c'est un montage de
développement qui exige que les deux téléphones soient sur le même Wi-Fi que la
machine, celle-ci allumée. Deux verrous distincts, deux réponses distinctes.

| Verrou                                 | Conséquence                       | Réponse                                  |
| -------------------------------------- | --------------------------------- | ---------------------------------------- |
| L'app télécharge son code depuis Metro | Rien ne s'ouvre sans l'ordinateur | Build autonome, code embarqué dans l'APK |
| L'API répond sur une IP privée         | Injoignable hors du Wi-Fi         | API hébergée, adresse publique en HTTPS  |

---

## 1. La base de données — Neon

Le palier gratuit de Neon est durable, là où celui de Render expire au bout de
trente jours.

1. Créer un compte sur **neon.tech**, puis un projet.
2. Copier la chaîne de connexion (`postgresql://…?sslmode=require`).
3. La garder de côté : elle deviendra `DATABASE_URL` chez Render.

Le schéma s'applique tout seul au premier démarrage — il n'y a rien à importer.

## 2. L'API — Render

Le dépôt contient `render.yaml` : Render le lit et crée le service sans
configuration manuelle.

1. **render.com** → New → **Blueprint** → choisir `Roch-com/LonlonbenouApp`.
2. Renseigner les variables marquées « à saisir » :

| Variable                    | Valeur                                          |
| --------------------------- | ----------------------------------------------- |
| `DATABASE_URL`              | la chaîne Neon                                  |
| `LONLONBENU_CLE_PRIVEE_PEM` | la clé RSA de `apps/api/.env`, `\n` compris     |
| `LONLONBENU_OAUTH_EMETTEUR` | l'URL publique du service, une fois connue      |
| `LONLONBENU_FCM_*`          | les trois valeurs du compte de service Firebase |

`LONLONBENU_SECRET_TACHES` est généré par Render : le récupérer ensuite dans
l'onglet Environment.

3. Vérifier que `https://<votre-service>.onrender.com/sante` répond `{"etat":"ok"}`.

**Ne réutilisez pas la clé RSA de développement en production.** Celle de
`apps/api/.env` a été générée localement et vit sur une machine de bureau ; elle
signe les jetons d'accès de tout le monde. En produire une nouvelle :

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out cle-prod.pem
```

## 3. Ce que le palier gratuit coûte vraiment

Render endort le service après **quinze minutes sans trafic**. Réveillé, il met
jusqu'à une minute à répondre. Deux conséquences, traitées toutes les deux :

- **Côté app.** `apps/mobile/src/lib/api/client.ts` réessaie une fois avec
  soixante-dix secondes de patience quand la première tentative expire, et
  affiche un bandeau « le serveur se réveille ». Sans cela, la première action
  de la journée échouerait à chaque fois et l'app passerait pour cassée.
- **Côté rappels.** Un serveur endormi n'émet rien : le planificateur interne ne
  tourne plus. `.github/workflows/rappels.yml` appelle `/taches/rappels` toutes
  les dix minutes, ce qui déclenche le balayage **et** maintient le service
  éveillé.

Ce workflow demande deux secrets GitHub — Settings → Secrets and variables →
Actions :

| Secret          | Valeur                                 |
| --------------- | -------------------------------------- |
| `URL_API`       | `https://<votre-service>.onrender.com` |
| `SECRET_TACHES` | la valeur générée par Render           |

Sur un dépôt public, ces exécutions sont gratuites et illimitées. Sur un dépôt
privé, elles consomment environ 700 minutes par mois sur les 2 000 offertes.

## 3 bis. Le suivi des erreurs — Sentry

Le câblage est en place et **inerte tant qu'aucun DSN n'est fourni**. Rien à
changer dans le code pour l'activer : une variable suffit.

1. Créer un compte sur **sentry.io**, palier gratuit.
2. Créer deux projets : un **Node.js** pour l'API, un **React Native** pour
   l'app. Chacun donne un DSN.
3. Poser le DSN Node dans `SENTRY_DSN` chez Render, et le DSN React Native dans
   `EXPO_PUBLIC_SENTRY_DSN` des profils `preview` et `production` de `eas.json`.

Au démarrage, l'API annonce `Suivi des erreurs actif.` ou son absence.

```bash
npm run verifier:surveillance --workspace=@lonlonbenu/api
```

### Ce qui ne part jamais chez Sentry

Un rapport d'erreur part chez un tiers, s'affiche dans une interface web et s'y
conserve des mois. Envoyer par mégarde le texte d'une confidence ou une date de
règles annulerait tout ce que le projet promet par ailleurs — le destinataire
changerait, pas la fuite.

Sont retirés avant envoi, des deux côtés : les corps de requête, les en-têtes,
les cookies, l'identification de l'utilisateur, les chaînes de requête des URL,
les fils d'exécution réseau et console. Côté mobile s'ajoute le refus des
captures d'écran et de la hiérarchie de vues — l'écran d'un couple montre des
messages, un cycle, des confidences.

Ce qui reste : le type d'erreur, la pile d'appels, le fichier, la ligne, l'écran
où l'on se trouvait. C'est ce qui sert à corriger, et rien de plus.

## 3 ter. L'envoi de courriel — Resend

Nécessaire à la **réinitialisation de mot de passe**, et à elle seule pour
l'instant. Sans configuration, le serveur démarre et l'annonce :

    Aucun envoi de courriel configuré : les codes de réinitialisation
    ne partiront pas.

Le parcours fonctionne malgré tout de bout en bout — la demande est enregistrée,
le code créé — mais personne ne le reçoit. C'est donc à faire avant de compter
dessus.

1. Créer un compte sur **resend.com** — palier gratuit, sans carte bancaire.
2. Sans domaine à soi, utiliser l'adresse d'essai fournie
   (`onboarding@resend.dev`) : elle n'envoie qu'à l'adresse du compte, ce qui
   suffit à vérifier le parcours. Avec un domaine, le vérifier chez Resend et
   expédier depuis lui.
3. Poser chez Render : `RESEND_API_KEY` et `LONLONBENU_COURRIEL_EXPEDITEUR`
   (par exemple `LONLONBENU <bonjour@votre-domaine>`).

### Ce que le parcours garantit

- **La réponse ne dit jamais si un compte existe.** Demander un code pour une
  adresse inconnue rend exactement la même réponse que pour une adresse connue,
  au caractère près. Distinguer les deux ferait de cette route un moyen de
  savoir qui possède un compte — sur une application de couple, l'information
  est déjà de trop.
- **Un seul code valable à la fois.** Une nouvelle demande invalide la
  précédente, sans quoi plusieurs codes circuleraient en parallèle.
- **Trente minutes, un seul usage, cinq essais.** Le code est haché en base :
  qui lirait la table n'y trouverait pas de quoi prendre un compte.
- **L'ancien mot de passe cesse de fonctionner** dès le changement.

## 4. L'application autonome

Une fois l'URL publique connue, la reporter dans `apps/mobile/eas.json`, profils
`preview` et `production` (`EXPO_PUBLIC_API_URL`), puis :

```bash
cd apps/mobile
npx eas build --profile preview --platform android
```

Ce build **n'a plus besoin de Metro** : le code est embarqué. L'APK s'installe
sur les deux téléphones et fonctionne partout — 4G, autre Wi-Fi, ordinateur
éteint.

Le profil `development` reste utile pour travailler : il recharge à chaud depuis
Metro, à condition d'être sur le même réseau.

## 5. Ce qui reste dépendant du réseau

Une connexion demeure nécessaire pour **écrire**. C'est un choix, pas un oubli :
un message envoyé hors ligne partirait on ne sait quand, et le partenaire le
découvrirait après coup — ou jamais. Les stores gardent un cache d'affichage, si
bien qu'on peut relire hors connexion ce qui a déjà été synchronisé.

Une vraie file d'attente hors ligne, avec réconciliation, se justifierait ; elle
demande de traiter les conflits et les ordres d'arrivée, et n'a pas sa place
avant que le parcours à deux ne soit validé.
