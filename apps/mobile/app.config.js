/**
 * Surcouche de `app.json`, pour ce qui ne peut pas y être écrit en dur.
 *
 * La clé Google Maps est embarquée dans l'APK — c'est inévitable, une carte
 * s'affiche depuis l'appareil — mais elle n'a rien à faire dans un dépôt.
 * Elle arrive donc par variable d'environnement, définie comme secret EAS.
 *
 * Ce type de clé se protège par **restriction**, pas par confidentialité :
 * dans la console Google Cloud, on la limite au nom de paquet
 * `com.lonlonbenu.app` et à l'empreinte SHA-1 du certificat de signature.
 * Ainsi extraite de l'APK, elle ne sert à personne d'autre.
 *
 * Sans clé, la configuration reste inchangée : l'application se construit et
 * fonctionne, seule la carte affiche une grille vide. C'est ce qui permet de
 * développer sans compte Google, et de ne pas bloquer un build sur un réglage
 * administratif.
 */
module.exports = ({ config }) => {
  const cle = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (!cle) return config;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: cle },
      },
    },
  };
};
