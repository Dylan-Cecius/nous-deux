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

## 2026-10-15, 06:06 Europe/Brussels — Dépenses : chargement distinct d’un solde vide

Source : PR #3 ouverte et brouillon, tête `5eaba90d2a98ea8983a2f39fae401f9a1a4b7849`. Les 102 fichiers texte locaux propres ont été comparés aux SHA de l’arbre GitHub relu avant travail. Aucune dépendance aux PC ; les 7 images binaires restent absentes de cette copie de contrôle.

Défauts reproduits avant correction : les erreurs de collection n’étaient pas transmises à un callback dédié ; une erreur d’un des trois flux de réponses permettait encore des émissions partielles ; Dépenses affichait « Vous êtes à l’équilibre » et zéro dépensé pendant le chargement ou un échec. Les quatre assertions correspondantes échouaient sur le code initial. Le nouveau test du hook échouait également car cette API n’existait pas encore (avec trois échecs en cascade dus au mock de restauration non consommé, isolé depuis par réinitialisation).

Correction bornée :

- Ajout d’un callback d’erreur aux collections cloud et locales. Le hook `useCollectionState` distingue attente, résultat vide réussi et erreur ; une reprise renouvelle seulement l’abonnement concerné.
- Résultat associé au backend, au nom de collection et à la tentative courante ; callbacks tardifs ignorés après erreur, reprise ou changement de session. L’erreur efface les anciens éléments sans déconnecter le compte.
- Dépenses masque solde, totaux et action de remboursement tant que les données ne sont pas disponibles ; message explicite et bouton « Réessayer ». Un formulaire déjà ouvert conserve sa saisie.
- Pour les réponses, une erreur arrête les trois écoutes et empêche un autre flux d’émettre ensuite un succès partiel. Les chemins de données restent inchangés : réponses privées du membre courant, réponses révélées et statuts sans texte. Un test de fusion normale avec données fictives protège ce comportement, sans prétendre tester les règles de sécurité.
- Compatibilité conservée pour les autres écrans via `useCollection` ; leur interface d’erreur n’est pas encore migrée. L’attente des trois premiers résultats du flux composite reste à examiner dans cette migration.

Contrôles réellement exécutés : `npm run lint`, `./node_modules/.bin/tsc --noEmit`, `npm test -- --runInBand` (8 suites, 60 tests réussis, dont 9 nouveaux), `git diff --check` ; sorties 0. Diff relu, y compris nouveau test de rendu. La revue React a guidé l’état dérivé à partir du résultat courant et le nettoyage des abonnements. Aucun paquet ajouté. Aucun workflow GitHub Actions ou EAS présent dans l’arbre consulté ; aucun build ni déploiement demandé.

Documentation consultée : https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors ; https://docs.expo.dev/versions/v57.0.0/ ; https://docs.expo.dev/llms.txt.

Limites : Firebase simulé et données fictives uniquement ; aucune règle ou fonction serveur modifiée, donc pas de validation émulateur requise pour ce correctif client. Les rendus avec composants natifs simulés ne prouvent ni un contrôle visuel ni un essai sur iPhone. Pas de build, fusion, déploiement, distribution TestFlight, accès aux données réelles ou opération financière. Les fonctions payantes désactivées et liens publics bloqués restent inchangés. Avertissement npm existant sur `http-proxy`, sans échec des contrôles.

Suite : migrer de façon ciblée les autres consommateurs de collections, en commençant par le parcours des réponses ; conserver les vérifications de confidentialité et ne pas traiter un résultat composite incomplet comme définitivement chargé.

## 2026-10-15, 08:04 Europe/Brussels — Chargement et reprise de la question du jour

Source : PR #3 toujours ouverte et en brouillon, tête `67677b3b275c6425da7a2021548ec92a2c043e12`. Consignes et journal relus via le connecteur ; les 103 fichiers texte de la copie cloud propre correspondent aux SHA de l’arbre GitHub actuel. Les 7 images binaires restent absentes, sans remplacement factice.

Défauts reproduits : le flux composite des réponses émettait un résultat avant d’avoir reçu les trois sources ; les six permutations d’arrivée échouaient au test d’attente, y compris lorsqu’un même flux envoyait plusieurs événements. La carte Question du jour proposait un champ et « Pas encore répondu » pendant le chargement ou après une erreur. Un brouillon pouvait aussi rester associé à la question précédente après changement de date et nouveau rendu. Quatre cas de rendu échouaient avant correction, deux autres conservaient le comportement attendu ; un premier mock de test a été ajusté pour transmettre les mêmes éléments aux anciens et nouveaux hooks.

Correction :

- Dans `subscribeAnswers`, trois indicateurs de premier résultat empêchent une émission prématurée ; les écoutes restent simultanées, sans requête supplémentaire ni modification des chemins privés/révélés/statuts. Une liste vide reçue compte comme un vrai résultat. Les mises à jour suivantes restent temps réel.
- `QuestionCard` utilise `useCollectionState` et présente un chargement ou une erreur avec « Réessayer », sans faux statut ni formulaire disponible dans ces états.
- Brouillons conservés dans le parent de la carte pendant l’erreur et la reprise, séparément pour chaque membre en mode local. Une clé liée au mode, couple, utilisateur et jour réinitialise la carte pour un autre contexte. Aucun brouillon ajouté au stockage persistant, aucun envoi automatique lors de la reprise. La fermeture de l’écran ne conserve pas ces brouillons.
- Masquage existant du texte du partenaire préservé ; les tests de rendu contrôlent ce masquage et l’affichage normal après réponse. Ils ne remplacent pas les autorisations serveur.

Fichiers : `src/lib/backend.ts`, `src/components/home/question-card.tsx`, tests de session et nouveau `question-card.test.tsx`, backlog et journal.

Contrôles réels après correction : `npm test -- --runInBand` réussi (9 suites, 76 tests ; 16 cas supplémentaires), `npm run lint` réussi, `./node_modules/.bin/tsc --noEmit` réussi, `git diff --check` réussi ; sorties 0 et diff relu. Vérification des erreurs de chacun des trois flux, de la reprise, des deux brouillons locaux, du changement de date/compte et de l’absence d’envoi lors du chargement/rechargement. La revue React a guidé la remontée des brouillons et la réinitialisation par clé plutôt qu’un effet de remise à zéro. Aucun paquet ajouté.

Documentation relue : https://docs.expo.dev/versions/v57.0.0/ ; https://docs.expo.dev/llms.txt ; https://firebase.google.com/docs/firestore/query-data/listen. Firebase peut fournir un premier résultat depuis son cache : l’attente des trois sources ne prouve pas une fraîcheur serveur ni une photographie atomique des trois collections. Aucun nouveau délai d’expiration artificiel ajouté.

Limites : Firebase et composants natifs simulés, données fictives uniquement. Aucun changement de règles ou de fonctions serveur ; pas de validation d’émulateur revendiquée. Ni export visuel, essai physique, build, fusion, déploiement, distribution, message à un tiers ou opération financière. Aucun workflow GitHub Actions/EAS dans l’arbre actuel. Fonctions payantes et liens publics inchangés. Avertissement npm `http-proxy` existant, sans échec des contrôles.

Suite : poursuivre la migration ciblée des autres consommateurs de `useCollection` (résumés de Nous, agenda, listes, souvenirs, messages). Ne pas considérer l’ensemble de ces écrans comme corrigé ni la PR comme prête à diffuser.

## 2026-10-15, 09:42 Europe/Brussels — Nous et protection des rappels (checkpoint 1)

Reprise à 09:34:44 : PR #3 ouverte, brouillon, tête `c11da4440a86b82b73586d3a52edcb2f3b382ffd`. Consignes relues via GitHub ; 104 fichiers texte de la copie cloud vérifiés par SHA, 7 images absentes. `AUTONOMY.md` aligne désormais la règle du cycle sur la consigne du propriétaire de 09:20 : plusieurs tâches bornées, checkpoints séparés, cible 50+10 minutes sans attente artificielle, limites financières et autres protections inchangées.

Défaut reproduit : les résumés de Nous affichaient un espace vide lors d’un échec de lecture ; les dates inconnues devenaient `[]` et déclenchaient le remplacement des rappels, même pendant le chargement initial. 8 nouveaux cas échouaient avant correction et 1 contrôle nominal passait. Migration des résumés et des deux points d’appel du planificateur vers `useCollectionState` ; aucun remplacement des rappels tant que les dates ne sont pas chargées sans erreur, actions de reprise ciblées, navigation conservée. Une vraie liste vide continue de permettre le nettoyage normal des rappels.

Contrôles : 9 nouveaux tests réussis ; suite complète 10 suites / 85 tests réussis, lint, TypeScript et `git diff --check` réussis (sorties 0). TypeScript a d’abord rejeté un nom de variante de bouton non existant, remplacé par `outline` avant ces contrôles finaux. Diff relu, revue React appliquée aux dépendances d’effet et aux états dérivés, aucune dépendance ajoutée. Documentation Expo SDK 57 et llms relue.

Limites : tests de rendu et notifications simulées, aucune notification réelle programmée, ni données réelles consultées. Pas de changement serveur ou de mécanisme de suppression de données, pas d’émulateur revendiqué. Aucun export visuel, essai physique, build native, diffusion ou validation Apple. Aucun coût ni nouveau workflow. Fonctions payantes et liens publics restent bloqués. Ce checkpoint ne clôt pas la session : poursuite immédiate sur l’agenda.

## 2026-10-15, 09:46 Europe/Brussels — Lecture de l’agenda et résumé du jour (checkpoint 2)

Base : `ce7c4d272b375f960b282f20f15a0fa543a9a6e2`, premier checkpoint enregistré avec `expected_sha`, 105 fichiers texte vérifiés par SHA après écriture et autres blobs inchangés. Une première commande locale de vérification a échoué sur sa syntaxe de citation ; vérification refaite par comparaison des SHA calculés, aucune donnée modifiée par cette commande.

Défauts reproduits : agenda vide et « Rien de prévu. Journée libre ! » sur l’accueil pendant le chargement/échec ; horaires et créneaux de disponibilité obsolètes encore affichés dans un état d’erreur simulé. Après correction du helper de texte des tests (props React circulaires), 6 régressions échouaient et 1 contrôle nominal passait.

Correction : `useCollectionState` dans la vue Agenda et le résumé du jour, chargement explicite, erreur et reprise locale, pas de grille vide ni de disponibilités calculées depuis un état inconnu. Semaine navigable, formulaire déjà ouvert conservé avec sa saisie, aucune écriture automatique à la reprise. L’abonnement propre au formulaire de séries et ses actions restent inchangés : ils feront l’objet d’un audit séparé avec les contrôles requis pour une modification des suppressions.

Contrôles réels : les 7 tests ciblés passent ; suite complète 11 suites / 92 tests, lint, TypeScript et `git diff --check` réussis, diff relu. Pas de dépendance ajoutée. UI et backend simulés, aucune donnée réelle ni changement serveur/suppression. Limites du checkpoint 1 maintenues : pas de contrôle visuel ou appareil, build, diffusion, coût ou validation Apple. Poursuite sur les états de lecture des souvenirs et dates de l’accueil.
