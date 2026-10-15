# Journal de travail autonome

## 2026-10-15 — Cycle initial dans le cloud

Autorisation : poursuivre le développement autonome, aucune dépense ou opération financière au nom du propriétaire.

Source : dépôt privé `Dylan-Cecius/nous-deux`, branche `feat/privacy-support-pages`, tête lue `ab06e7786984010048e5beaeca383b11069dd5aa`. Une copie distincte a été reconstruite depuis 97 blobs texte avec vérification de chaque SHA Git. Installation neuve des 1 154 paquets du lockfile par `npm ci --ignore-scripts --no-audit --no-fund`, sans accès au PC du propriétaire.

Défaut reproduit : `getPublicSupportLinks()` pouvait autoriser des liens avec une adresse d’assistance invalide ou une valeur textuelle `"false"` pour la vérification des durées. Trois cas échouaient avant correction. Le contrôle réutilise maintenant la validation du contact et exige le booléen `true`.

Fichiers : `src/lib/public-info.ts`, `src/lib/__tests__/public-info.test.ts`, consignes et backlog autonomes.

Vérification sur la copie cloud contenant le correctif :

- `npm run lint` : réussi, code de sortie 0.
- `./node_modules/.bin/tsc --noEmit` : réussi, code de sortie 0.
- `npm test -- --runInBand` : 6 suites, 41 tests réussis, dont 15 cas sur les informations publiques.

Limites : le connecteur a refusé les images binaires ; les 7 images n’ont pas été remplacées par des fichiers factices. Aucun export visuel, essai natif, build EAS, déploiement ni nouvelle distribution TestFlight dans ce cycle. Les dépendances installées émettent des avertissements de dépréciation ; aucun audit de vulnérabilités exhaustif n’est revendiqué.

Suite : reprendre le backlog par le parcours de reconnexion et perte de réseau. Les informations légales et les conditions de distribution restent à compléter indépendamment des corrections du code.

## 2026-10-15, 02:01 Europe/Brussels — Reconnexion par e-mail

Source relue : PR #3 ouverte, tête `ee46294211c1fa827accd1b40f81fa901b9088e9`. Reconstruction de 101 fichiers texte depuis GitHub avec vérification des SHA, puis installation neuve du lockfile. Aucune dépendance au PC du propriétaire.

Défaut reproduit en tests : `signInWithEmail()` mémorisait l’espace mentionné par l’index utilisateur sans lire le couple. Un index périmé pouvait donc valider une session alors que le couple était absent, que le membre n’y figurait plus, ou que la lecture du couple aurait échoué. Cinq nouveaux cas échouaient avant correction, les cinq tests de session précédents restaient réussis après isolation des mocks.

Correction : lecture du couple et vérification de son tableau de membres avant `saveCloudSession()`. Les erreurs Firestore de réseau et de permission produisent un message français explicite. L’échec ne déclenche ni déconnexion ni création de compte anonyme ; la nouvelle tentative réussie est couverte. Les règles serveur restent la frontière de sécurité, ce contrôle client ne les remplace pas.

Fichiers modifiés : `src/lib/backend.ts`, `src/lib/__tests__/session.test.ts`, backlog et présent journal.

Contrôles exécutés sur ce correctif :

- `npm run lint` : réussi, sortie 0.
- `./node_modules/.bin/tsc --noEmit` : réussi, sortie 0.
- `npm test -- --runInBand` : 6 suites et 46 tests réussis, dont 10 tests de session.
- `git diff --check` et relecture du diff : réussis.

Documentation Firebase consultée : https://firebase.google.com/docs/reference/js/firestore#getdoc — `getDoc()` peut utiliser le cache si le serveur est inaccessible. Le correctif valide les données retournées ; il ne garantit pas que des droits ne changeront pas après cette lecture. Les erreurs des abonnements temps réel restent à auditer.

Limites : Firebase entièrement simulé dans ces tests ; aucune lecture/écriture de production, aucune modification de règle ou de fonction serveur, aucun test natif, build EAS, déploiement, fusion ou distribution TestFlight. La copie de contrôle n’inclut toujours pas les 7 images binaires. Aucune opération financière ou service payant déclenché.

Suite : examiner les erreurs des abonnements temps réel après connexion, puis les invitations et la séparation des données. Les anciens blocages légaux et de distribution ne sont pas levés par ce correctif.
