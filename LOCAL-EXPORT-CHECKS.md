# Exports locaux de contrôle — 21 octobre 2026

Source contrôlée : `7ddf1c59a73fdde6b91740b575697d410f2e45c2`, PR #3 ouverte et en brouillon.

## Reconstruction complète

Les sept PNG du dépôt ont été récupérés via le connecteur GitHub avec `fetch_file`, `encoding: base64` et le SHA ci-dessus. Après décodage, chaque SHA a été recalculé sur `blob <taille>\0<octets>` et comparé à l’arbre Git. Les 186 blobs sont identiques, sans fichier manquant ; les images sont les originaux, pas des substituts. Aucun nouveau binaire n’a été ajouté au dépôt distant.

Lors d’une reprise, repartir d’un arbre courant non tronqué, vérifier chaque blob et les modifications locales. La présence d’un ancien dossier ou de ses dépendances n’est jamais une preuve suffisante.

## Commandes exécutées sans service distant

Depuis les sources et dépendances vérifiées, avec Expo `~57.0.28`, le binaire local a été utilisé. Les dossiers de sortie sont temporaires et reproductibles ; ils ne sont pas un déploiement.

```sh
EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 CI=1 \
EXPO_PUBLIC_FIREBASE_API_KEY='' EXPO_PUBLIC_FIREBASE_PROJECT_ID='' EXPO_PUBLIC_FIREBASE_APP_ID='' \
EXPO_PUBLIC_ASSISTANT_ENABLED=false EXPO_PUBLIC_PLACES_ENABLED=false \
./node_modules/.bin/expo export --platform web --output-dir ../nous-deux-web-check

EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 CI=1 \
EXPO_PUBLIC_FIREBASE_API_KEY='' EXPO_PUBLIC_FIREBASE_PROJECT_ID='' EXPO_PUBLIC_FIREBASE_APP_ID='' \
EXPO_PUBLIC_ASSISTANT_ENABLED=false EXPO_PUBLIC_PLACES_ENABLED=false \
./node_modules/.bin/expo export --platform ios --output-dir ../nous-deux-ios-export-check
```

| Contrôle réel | Résultat | Ce que cela ne prouve pas |
| --- | --- | --- |
| Export web local | Code retour 0 ; Metro web 1 083 modules, rendu statique 1 237 modules, 16 routes HTML, 3 bundles ; 47 fichiers totalisant 4 079 994 octets. | Aucun écran interactif n’a été observé dans un navigateur. Le rendu statique ne valide pas le parcours connecté. |
| Export iOS local | Code retour 0 ; Metro 1 359 modules, 31 ressources annoncées, bundle Hermes `entry-15270222de859e2f048880c572f3cdb2.hbc` et `metadata.json`. | Ce n’est ni une compilation native, ni une signature, ni une installation iPhone, ni une validation Apple. Aucun EAS Build/Update/Submit exécuté. |
| Navigateur local | Playwright présent, exécutable Chromium absent. Tentative de téléchargement du headless shell interrompue après archives invalides (`End of central directory record signature not found`). | Aucune capture, recette tactile ou validation visuelle produite. Ne pas annoncer un aperçu vérifié. |

Le message Expo sur les changements de jetons de notifications non pris en charge sur web a été observé ; aucun jeton n’a été demandé, aucune notification n’a été envoyée. Les variables Firebase vides et les indicateurs payants faux restent imposés pour ces contrôles. Aucun compte réel ni contenu intime utilisé.

## Suite

Reprendre les recettes de `TESTFLIGHT-REVIEW.md` dans un navigateur disponible, puis séparément sur les appareils autorisés. Les exigences serveur, émulateurs de sécurité, coût nul supplémentaire, confidentialité et distribution restent intégralement applicables. Un export local réussi ne lève aucun de ces prérequis.
## Nouveau contrôle après les correctifs d’interface
Source : `d79247babf904ef20246b802d38d88a1497ac84c`, le 21 octobre vers 03:45. Les 187 blobs du dépôt (document présent inclus) ont été comparés au SHA Git sans écart ni fichier manquant.
- Suite complète : 65 suites / 1 656 tests réussis en 12,879 s ; lint et TypeScript code retour 0.
- Export web, mêmes indicateurs de sécurité ci-dessus, sortie `../nous-deux-web-final` : code retour 0, 1 080 modules web / 1 180 modules de rendu statique, 16 routes et 3 bundles ; 47 fichiers, 4 080 749 octets.
- Export iOS, mêmes indicateurs, sortie `../nous-deux-ios-final` : code retour 0, 1 359 modules, 31 ressources, `entry-8b0d6b1641e56da6fa375468fd5b0b28.hbc` ; 33 fichiers, 5 898 082 octets.
- Les écarts de comptage Metro entre les exports ne constituent pas une mesure de performance. Les limites de rendu, de compilation native et de distribution décrites ci-dessus restent inchangées.
## Contrôle des alias et du bandeau — 21 octobre à 05:46
Source : `07f13016211e47042c8d9c97acc270e9c2e10e47`, 187 blobs comparés au SHA Git, aucun écart. Contrôle justifié par l’ordre des alias dans tsconfig.json et les modifications d’affichage.
- Même environnement hors ligne et mêmes commandes ci-dessus, avec les sorties `../nous-deux-web-0533` et `../nous-deux-ios-0533`. Aucun chargement dotenv, Firebase désactivé, IA/Places faux, télémétrie désactivée.
- Web : code retour 0 ; 1 076 modules web / 1 234 de rendu statique, 16 routes, 3 bundles ; 47 fichiers / 4 074 123 octets. Bundle principal `entry-82733e6451e08c5cdb41e4a7b1463fa6.js`.
- iOS : code retour 0 ; 1 359 modules, 31 ressources, bundle `entry-449e724a15d4b2bef1335121c4d5f3b3.hbc` ; 33 fichiers / 5 895 351 octets. Logo original annoncé parmi les ressources.
- Suite complète : 65 suites / 1 677 tests réussis (11,799 s), lint et TypeScript réussis. Les nombres de modules/octets ne constituent pas une mesure de performance comparable.
- Avertissement web expo-notifications sans effet déjà connu ; aucun jeton ou envoi. Aucun téléchargement de navigateur relancé. Aucun aperçu, build native signée ni essai iPhone ; ces preuves n’autorisent pas la distribution.
