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

## 2026-10-15, 04:07 Europe/Brussels — Reprise de l’abonnement au couple

Source : PR #3 ouverte, tête `0ab0c0f172a385538f46034a44d6a6376ac64872`. La copie cloud existante était propre ; ses 101 fichiers texte ont été comparés par SHA Git à l’arbre relu sur GitHub avant réutilisation. Les 7 images restent absentes de cette copie de contrôle.

Défaut reproduit : une erreur de `onSnapshot` était transformée en `couple = null` sans état d’erreur ni possibilité de relancer l’abonnement. Firebase précise qu’un abonnement ayant signalé une erreur ne reçoit plus d’événements. Trois nouveaux cas échouaient avant correction : transmission de l’erreur, état de synchronisation récupérable, couple absent distinct d’un espace vide.

Correction limitée à l’abonnement du couple :

- Callback d’erreur explicite dans les implémentations cloud et locale.
- État `syncError` dérivé du résultat associé au backend courant, sans second état susceptible de dériver.
- Reprise par renouvellement de l’abonnement uniquement : pas de `loadSession()`, de déconnexion ou de création de compte. L’erreur reste visible jusqu’à réception d’un couple valide.
- Arrêt de l’ancien abonnement et exclusion de ses callbacks tardifs, vérifiés par test.
- Écran explicite à la place des écrans du couple en erreur, action « Réessayer » et adresse d’assistance sélectionnable. Le test de rendu vérifie que ce bouton appelle la reprise de synchronisation et non la reconnexion.

Fichiers : `src/lib/backend.ts`, `src/lib/couple-context.tsx`, `src/app/_layout.tsx`, tests de session et d’interaction, nouveau test `sync-screen.test.tsx`, backlog et journal.

Contrôles réels : `npm run lint` et `./node_modules/.bin/tsc --noEmit` réussis (sortie 0), `npm test -- --runInBand` réussi avec 7 suites et 51 tests, `git diff --check` réussi et diff relu. Les cinq nouveaux cas couvrent aussi l’échec de lecture du stockage local. La revue React a guidé l’état dérivé, les dépendances de l’effet et le nettoyage des abonnements ; aucun paquet supplémentaire ajouté.

Documentation consultée :

- https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors
- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/llms.txt
- https://docs.expo.dev/router/error-handling/

Limites : les tests simulent Firebase et les éléments natifs ; le test de rendu ne remplace pas un essai visuel ou physique. La reprise ne contourne pas les autorisations serveur : un accès réellement retiré reste refusé. Le traitement des erreurs des autres collections reste une tâche séparée. Aucun accès aux données de production, changement de règles ou de fonctions serveur, build, déploiement, fusion, distribution ou opération financière effectué.

Suite : traiter les erreurs des collections sans les confondre avec des listes vides, puis poursuivre l’audit des invitations et des données privées. Les prérequis légaux et de distribution restent inchangés.
