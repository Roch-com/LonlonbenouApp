# Client réseau

```
configuration.ts   adresse de l'API et identité du client OAuth2
client.ts          fetch avec jeton porteur + rafraîchissement sur 401
volUnique.ts       sérialisation des rafraîchissements concurrents (testé)
erreurs.ts         erreurs typées et messages affichables
```

## Authentification

Flux **Authorization Code + PKCE (S256)**, dans
`features/reglages/stores/sessionServeurStore.ts`.

Le calcul du défi PKCE vient de `@lonlonbenu/shared` — **la même fonction que
celle du serveur**, vérifiée par le vecteur de l'annexe B du RFC 7636. Deux
implémentations séparées auraient pu diverger sans que rien n'indique laquelle
avait tort.

### Où vivent les jetons

| Jeton            | Emplacement                                 | Pourquoi                                                                             |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Accès (10 min)   | **mémoire seule**                           | l'écrire l'exposerait dix minutes pour ne rien gagner : il se regagne en une requête |
| Rafraîchissement | **trousseau système** (`expo-secure-store`) | c'est lui qui vaut session ; il rejoint la clé du coffre et le code de verrouillage  |

Rien n'est écrit dans AsyncStorage, et le store de session n'est pas persisté.
L'état est reconstruit au démarrage par `restaurer()`.

### Rafraîchissement à vol unique

Si dix requêtes se prennent un 401 en même temps, **une seule rotation a lieu**
et les neuf autres attendent son résultat. Sans cela, le serveur verrait un
jeton déjà tourné être rejoué, en conclurait à un vol, révoquerait toute la
famille — et l'utilisateur serait déconnecté par son propre client. C'est le
seul morceau de concurrence réelle de la couche réseau, et il est testé
(`volUnique.test.ts`).

### Hors ligne

Un échec réseau **ne détruit pas la session** : le jeton de rafraîchissement
reste au trousseau et la reprise se fera au retour du réseau. Seule une réponse
du serveur invalidant le jeton efface la session.

## Ce que le client ne fait pas

- **Pas de file d'écritures différées.** Une contribution déposée hors ligne
  partirait sans qu'on sache quand, et le partenaire découvrirait une réponse à
  une conversation qu'il croyait close. Le client refuse franchement l'écriture
  plutôt que de la promettre.
- **Pas de nouvelle tentative automatique** sur les écritures : rejouer un POST
  sans idempotence dupliquerait des axes.
