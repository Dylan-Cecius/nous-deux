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

## 2026-10-15, 09:52 Europe/Brussels — Souvenirs et comptes à rebours (checkpoint 3)

Base : `b199b44575b323d44b57084b3748ec700c78cbd9`, 106 fichiers texte vérifiés par SHA et autres blobs préservés. Défauts reproduits : album annonçant « 0 photo », invitation à créer ses premières dates/photos alors que leur lecture a échoué ; contenu obsolète non masqué dans un état d’erreur simulé. 9 nouveaux cas de régression échouaient avant correction, après ajustement du ciblage d’un bouton dans le test. Les contrôles nominaux et de conservation de saisie restent couverts.

Correction : état explicite et reprise dans l’album Souvenirs, son bandeau d’accueil et les comptes à rebours. Compteurs et invitations d’album vide uniquement pour une lecture terminée ; les boutons d’ajout attendent cette lecture. Les formulaires déjà ouverts gardent leur légende ou nouvelle date. Aucun changement aux mécanismes d’upload, d’écriture ou de suppression ; les anciennes photos visibles dans un formulaire déjà ouvert restent conservées avec la saisie.

Contrôles : 19 tests ciblés (dont les 7 précédents d’agenda), puis suite complète 12 suites / 104 tests réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Pendant la première tentative de tests, le transport du terminal cloud a été interrompu sans résultat exploitable ; il est redevenu disponible. Le test a été simplifié pour cibler directement le bouton au lieu de parcourir les parents ; les nouvelles exécutions ont terminé normalement. Pas de diagnostic causal certain sur l’interruption du runtime, pas de résultat perdu déclaré réussi.

Limites : photos représentées par des URI fictives et composants simulés, aucune image réelle lue ni test visuel revendiqué ; aucune écriture réseau. Les limites de distribution, de coût et de confidentialité des checkpoints précédents restent inchangées. Poursuite sur les mots doux.

## 2026-10-15, 09:58 Europe/Brussels — Historique et envoi des mots doux (checkpoint 4)

Base : `97f0b7fa3e8371098d6cbbb47806735af6d48f38`, 107 fichiers texte vérifiés par SHA et autres blobs préservés. Six cas échouaient avant correction : faux historique vide, absence de statut des cœurs, ancien texte affiché après erreur, double envoi clavier/bouton dans le même tour React. Le double envoi a été reproduit par deux appels au service simulé, sans message réel.

Correction : `NoteCard` et `PingCard` lisent l’état de leur collection, rendent les pannes visibles et proposent une reprise séparée du bouton d’envoi. Brouillon et historique ouvert conservés pendant la reprise ; contenu historique masqué lorsqu’il est indisponible. L’écriture reste une action volontaire distincte de la lecture. `useAsyncAction` fournit désormais un verrou commun à l’envoi clavier et bouton, avant tout nouveau rendu ; le message d’erreur spécifique et le texte conservé après échec restent inchangés. Pas d’affirmation d’idempotence serveur après reconnexion ou redémarrage.

Contrôles : 10 tests de carte (dont reprise volontaire, saisie vide et cœur obsolète) réussis ; suite complète 13 suites / 114 tests, lint, TypeScript et `git diff --check` réussis, diff relu. Une tentative d’utiliser une prop `disabled` non supportée par `IconButton` a été rejetée par TypeScript puis retirée ; le verrou partagé ne dépend pas de cette prop. Revue React : état d’envoi dérivé du hook existant, pas de double état de verrouillage ni nouvelle dépendance. Mise en forme finale uniquement après les contrôles comportementaux.

Limites maintenues : aucun envoi réel, accès intime, changement serveur/suppression, build, déploiement, diffusion, coût ou validation Apple. Tests simulés, pas d’essai natif. Le propriétaire a reçu un point d’avancement pendant cette tâche ; le développement a continué.

## 2026-10-15, 10:02 Europe/Brussels — Listes et restaurants (checkpoint 5)

Base : `6bea414efeea2d48b015fd8b17d017f2db15098e`, 108 fichiers texte vérifiés par SHA, autres blobs préservés. 12 cas reproduisaient avant correction des faux états vides/compteurs ou l’absence de reprise ; 3 contrôles nominaux passaient. Les quatre onglets de listes et les restaurants utilisent maintenant l’état de lecture explicite. La panne des cadeaux n’empêche pas les listes partagées de fonctionner, et réciproquement ; « Réessayer » cible la collection de l’onglet actif. Statistiques, tirages et anciennes entrées sont masqués quand la lecture est inconnue ; les formulaires ouverts gardent leur brouillon.

Contrôles : 19 tests ciblés réussis (chargement/erreur des quatre listes, indépendance des flux, masquage des anciennes entrées, reprise des restaurants et conservation de saisie). Suite complète 14 suites / 133 tests, lint, TypeScript et `git diff --check` réussis ; diff relu. Le filtre client des cadeaux du membre connecté est testé, sans prétendre remplacer les règles serveur. Aucun changement aux opérations de suppression existantes ni à leurs confirmations. Aucun appel Places, carte externe ou écriture réelle ; les fonctionnalités payantes restent désactivées.

Limites précédentes maintenues : aucun essai visuel/natif, build, distribution ou validation Apple. Poursuite sur un audit ciblé de concurrence des rappels locaux, dont les APIs Expo SDK 57 sont relues avant modification.

## 2026-10-15, 10:06 Europe/Brussels — Programmations de rappels concurrentes (checkpoint 6)

Base : `583805bf3a2191f30a0b8c923abbd47eddb652dd`, 109 fichiers texte vérifiés par SHA, autres blobs préservés. Deux courses reproduites avec des promesses contrôlées : une ancienne permission ou un ancien inventaire revenait après une programmation plus récente et en annulait les deux notifications. Les contrôles de génération existants ne protégeaient que la création des rappels, pas leur annulation.

Correction minimale dans `src/lib/notifications.ts` : vérifier la génération après chaque lecture native préalable, avant de parcourir et annuler les notifications. Le comportement J-1/Jour J à 9h, l’annulation des seuls comptes à rebours et le nettoyage d’une création tardive après fermeture de session sont préservés.

Contrôles : deux tests échouaient avant correction, quatre contrôles nominaux passaient ; six tests ciblés puis 15 suites / 139 tests réussis, lint, TypeScript, `git diff --check` et diff relu. Les tests simulent un registre de notifications et des lectures natives retardées ; ils ne programment rien sur un téléphone. Documentation primaire relue : https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ (inventaire, planification et annulation par identifiant). Aucun changement à `clearSession`, aux données utilisateur ou aux règles/fonctions serveur.

Limites : aucun essai natif ni garantie nouvelle sur la présentation effective par iOS/Android ; pas de build, distribution, coût, donnée intime réelle ou validation Apple. Prochaine tâche dans cette session : état des cœurs reçus et courses de lecture du marqueur local.

## 2026-10-15, 10:12 Europe/Brussels — Cycle de vie des tâches discrètes (checkpoint 7)

Base : `99bc47b0b294a5f2d218a8ddf445a2b4b77e1e82`, 110 fichiers texte vérifiés par SHA, autres blobs préservés. PR et consignes relues à la réception de la même demande à 10:06 : aucune tête concurrente, aucun travail déjà terminé recommencé.

11 cas échouaient avant correction : l’ancien marqueur local pouvait être appliqué au nouvel espace, une lecture retardée écrasait le marqueur courant, les cœurs inconnus/obsolètes étaient marqués vus, des marqueurs invalides rejouaient l’historique, les erreurs AsyncStorage restaient des rejets non gérés, et un jeton push tardif était enregistré après fermeture/changement de contexte.

Correction : composant de réception des cœurs réinitialisé par clé mode/couple/membre, nettoyage des lectures asynchrones, états `loading/error` respectés, marqueur numérique validé. L’échec de lecture laisse les animations désactivées jusqu’à la prochaine ouverture, sans modifier les notes ; l’échec d’écriture garde le marqueur en mémoire pour cette session (un redémarrage peut donc rejouer un cœur si la persistance a échoué). Le retour tardif de `getPushToken` est ignoré après nettoyage de son effet ; un appel serveur déjà engagé n’est pas annulable par ce garde.

Contrôles : 14 tests de tâches discrètes, puis suite complète 16 suites / 153 tests réussis ; lint, TypeScript, `git diff --check` et diff relu. Tests des changements d’espace et de membre, fermeture, erreurs de lecture/écriture, première ouverture silencieuse, nouveau cœur unique, enregistrement nominal du jeton. Revue React : isolation par clé et cleanup explicite plutôt que remise à zéro par effet de plusieurs états partagés.

Limites : stockage, jetons et backend entièrement simulés ; aucun marqueur ni compte réel lu/modifié, aucun push envoyé. Pas de changement serveur/suppression, build, distribution ou dépense. L’environnement de sécurité va maintenant être diagnostiqué pour préparer l’audit restant, exclusivement sur `demo-nous-deux-security`.

## 2026-10-15, 10:20 Europe/Brussels — Confirmation de suppression des séries et sécurité locale (checkpoint 8)

Base : `5dc3fd3a8f58f5d1bd6a668624896cf3a0fe5937`, 111 fichiers texte vérifiés par SHA au checkpoint précédent. PR toujours ouverte et en brouillon, tête relue inchangée.

Sept régressions reproduites avant correction : action disponible malgré un chargement/échec de lecture, confirmation conservant un ancien instantané après panne, changement de backend ou fermeture du formulaire, et nouvel horaire de la série absent de l’instantané de confirmation. `EventSheet` utilise maintenant `useCollectionState` ; bouton désactivé et garde d’action, reprise ciblée, puis vérification du contexte et de la lecture au moment de confirmer. Une fermeture invalide le callback. La suppression confirmée utilise le dernier instantané disponible et préserve les occurrences antérieures ainsi que les autres séries. La saisie est conservée en cas de lecture indisponible. Les suppressions unitaires, la sauvegarde et le serveur restent inchangés.

Contrôles : 17 tests ciblés d’agenda réussis (dont 7 nouveaux), puis 16 suites / 160 tests applicatifs réussis ; lint, TypeScript et `git diff --check` réussis, diff relu. Aucun consommateur de `useCollection(...)` sans état ne subsiste dans le code de production. Les gardes de confirmation sont testés avec un backend simulé ; ils ne rendent pas atomique la boucle de suppression. Une panne en cours de boucle peut encore laisser une suppression partielle ; audit d’écriture à poursuivre séparément.

Environnement de sécurité remis en état gratuitement dans le runtime : installation verrouillée `npm ci --ignore-scripts --no-audit --no-fund` dans `functions` (798 paquets, manifestes inchangés). Java 17.0.20, firebase-tools 14.12.0, émulateurs Firestore 1.19.8 et Storage 1.1.3. Deux exécutions réelles `CI=1 npm run test:security`, avant puis après ce correctif : build TypeScript des fonctions réussi et 19 tests réussis à chaque fois ; dernière sortie 0, durée des tests 14,61 s, émulateurs arrêtés proprement. Auth/Firestore/Storage exclusivement sous `demo-nous-deux-security` ; les refus PERMISSION_DENIED appartiennent aux scénarios négatifs attendus. Source primaire consultée : https://firebase.google.com/docs/emulator-suite/connect_firestore (projets demo sans ressources réelles ni facturation).

Limites : Node 24.19.0 du runtime diffère du Node 22 déclaré par les fonctions (avertissements EBADENGINE à l’installation), donc pas de validation revendiquée de l’environnement de production Node 22. Aucun déploiement, runner distant, EAS, compte réel, message ou dépense. Les 7 images manquent toujours au checkout texte : aucun export visuel, build signée, essai iPhone, distribution ni validation Apple. Liens publics et fonctions payantes inchangés. Prochaine priorité : audit ciblé des écritures/confirmations et du parcours d’invitation, sans répéter les migrations désormais terminées.

## 2026-10-15, 10:24 Europe/Brussels — Isolation de la carte d’invitation (checkpoint 9 et clôture)

Base : `b62b24b1aec755130301aad74b6b4764b9705124`, checkpoint 8 enregistré avec `expected_sha`, 111 fichiers texte vérifiés et autres blobs préservés. Audit des écritures : le bouton Enregistrer de l’agenda utilise déjà le verrou partagé du composant `Button` ; aucun correctif artificiel ajouté à cet endroit.

Cinq cas d’invitation échouaient avant correction : code conservé après changement d’espace ou de membre, code réapparaissant après arrivée puis départ du partenaire, réponse ou erreur d’une ancienne requête appliquée au nouvel espace. Le formulaire d’invitation est maintenant monté uniquement en mode cloud sans partenaire, avec une clé par espace/membre ; son démontage invalide les retours asynchrones. Une reconstruction du même objet backend dans le même contexte n’annule pas la requête valide. Le service serveur, les règles, la durée du code et le partage natif restent inchangés. Une requête serveur déjà engagée n’est pas annulée : seul son retour dans l’interface obsolète est ignoré.

Contrôles : cinq tests rouges avant correction, un contrôle de reprise déjà vert ; sept tests ciblés finaux dont la reconstruction du backend, puis 17 suites / 167 tests applicatifs réussis, lint, TypeScript et `git diff --check` réussis. Diff relu, isolation React par clé plutôt qu’effacement tardif d’un état visible. Aucun appel serveur réel ni partage déclenché ; données et service d’invitation simulés. Les 19 tests de sécurité ont été exécutés au checkpoint 8, pas à nouveau après cette modification exclusivement client ; aucun fichier serveur/règle/suppression modifié ici.

Durée observée avant clôture : du 15 octobre à 09:34:44 à 10:24:32 Europe/Brussels, soit 49 min 48 s, puis sauvegarde finale. Neuf tâches/checkpoints successifs, contrôles et journal compris, et non une heure garantie ni un travail permanent entre cycles. Session bornée terminée à l’approche de la cible de 50 minutes, sans attente artificielle ; prochaine tâche prête : audit des erreurs d’acceptation d’invitation et des écritures restantes. Aucun nouveau blocage nécessitant le propriétaire ni incident de production constaté. Les limites de build, d’essai physique, de diffusion, d’Apple, de confidentialité et de coût restent celles du checkpoint 8.

## 2026-10-15, 10:38 Europe/Brussels — Reprise d’une création ou invitation déjà acceptée

Nouvelle session démarrée à 10:34:07 : PR #3 ouverte et en brouillon, tête `427cceb4639aff865f3f93052c92cb5094a2fb26`. Consignes et journal relus via GitHub ; copie cloud propre, 112 fichiers texte vérifiés par SHA, 7 images absentes. La règle multi-tâches est déjà en place, aucune réécriture nécessaire.

Défaut reproduit : après succès serveur et perte de la réponse ou échec de mémorisation locale, une nouvelle tentative rejouait l’invitation consommée ou la création déjà effectuée, puis restait refusée. Huit nouveaux cas échouaient avant correction, deux contrôles nominaux passaient. Le client retrouve désormais le rattachement de l’utilisateur authentifié, vérifie son appartenance puis mémorise la session avant de proposer une nouvelle création/acceptation. Aucun compte anonyme de remplacement, aucun nouvel essai serveur si la lecture échoue. Le contrôle commun sert aussi à la reconnexion e-mail, dont les tests existants restent verts.

Preuves : 34 tests de session, suite complète 17 suites / 177 tests applicatifs, lint, TypeScript, diff relu et `git diff --check` réussis. `CI=1 npm run test:security` : compilation des fonctions réussie, 20 tests réussis (15,81 s), sortie 0, émulateurs arrêtés proprement. Nouveau scénario émulateur : un code consommé reste non réutilisable, le membre lit son index et son espace, un tiers reste refusé. Aucune règle ni fonction de production modifiée.

Limites : récupération à la tentative volontaire suivante, pas de réessai automatique, et dépendance à l’identité Firebase encore présente sur l’appareil. `getDoc` peut utiliser un cache : pas de nouvelle garantie de fraîcheur serveur/offline ; les règles et l’abonnement restent l’autorité d’accès. Sources primaires : https://firebase.google.com/docs/firestore/query-data/get-data et https://firebase.google.com/docs/auth/web/anonymous-auth ; Expo SDK 57/llms relus. Node 24 du runtime, pas de validation Node 22 de production. Aucun appel cloud réel, invitation envoyée, build, déploiement, essai natif, distribution ou coût. Poursuite sur les écritures locales concurrentes.

## 2026-10-15, 10:44 Europe/Brussels — Écritures concurrentes du mode local

Base : `426cca90651f5407d9efc17e7a23c4ec7ef84e9c`, checkpoint précédent confirmé avec contrôle de référence et 112 SHA texte vérifiés. Après correction de l’import du mock AsyncStorage du test, cinq pertes de données fictives ont été reproduites : ajout écrasé, modification annulée, entrée supprimée réapparue, date du couple perdue lors d’un changement de profil, série d’horaires remplacée par un ajout simultané.

Correction : file de lecture-modification-écriture par clé locale, partagée par les instances du backend. Les modifications du couple et des profils utilisent la même clé ; les collections indépendantes progressent séparément. Une écriture refusée ne met pas le cache à jour et n’empêche pas les suivantes. Le rejet d’origine reste observable par l’appelant. Pas de verrou ni de dépendance supplémentaire sur le backend cloud.

Contrôles : sept tests de stockage local réussis, puis 18 suites / 184 tests applicatifs, lint sans nouvel avertissement, TypeScript et diff relu/`git diff --check` réussis. Les imports dynamiques du test avaient échoué dans Jest sans VM modules ; remplacés par les mécanismes `jest.requireMock/requireActual`, sans changement de configuration. La suite de sécurité, relancée car `remove` local est concerné, passe avec 20 tests en 13,00 s, sortie 0, exclusivement sur les trois émulateurs `demo-nous-deux-security`, arrêtés proprement.

Limites : stockage simulé, un seul runtime JavaScript ; aucune garantie entre onglets/processus ni transaction multi-clés. L’audit des lectures retardées et de la fermeture/suppression pendant une écriture suit séparément. Aucun contenu réel supprimé, service facturable, build, distribution ou validation Apple. Les limites du checkpoint précédent restent inchangées.

## 2026-10-15, 10:48 Europe/Brussels — Lectures locales retardées

Base : `539a40378e7ed898b9015860a9bda089d3f66390`, 113 SHA texte et autres blobs vérifiés au checkpoint précédent. Quatre défauts reproduits : résultat initial obsolète après écriture confirmée, callbacks de succès/erreur encore appelés après désabonnement, erreur initiale tardive masquant une écriture déjà reçue. La lecture vérifie à nouveau le cache à son retour ; l’abonnement suit sa durée de vie et ignore son résultat initial dès qu’un résultat plus récent a été reçu.

Contrôles : cinq nouveaux tests (dont reprise après véritable erreur initiale), 12 tests de stockage local et 18 suites / 189 tests au total réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Le test de reprise attend maintenant son callback réel au lieu de supposer un nombre de microtâches ; son premier échec n’était pas un défaut produit. Aucun changement serveur/règle ni des opérations de suppression dans ce checkpoint, pas de nouvelle exécution des émulateurs revendiquée. Les 20 tests de sécurité du checkpoint précédent restent la dernière preuve.

Limites inchangées : stockage fictif, pas d’essai physique ou multi-processus, ni build/diffusion/dépense. Suite immédiate : coordination d’une suppression locale avec les opérations déjà en cours.

## 2026-10-15, 10:56 Europe/Brussels — Suppression locale et opérations en vol

Base : `a134392989c816e74b39f778434e3e60a74af94b`, 113 fichiers texte vérifiés. Cinq régressions reproduites : nettoyage terminé avant une écriture/copie en cours, nouvelle écriture et double suppression acceptées pendant le nettoyage, ancien backend encore capable d’écrire/effacer un nouvel espace, ancienne lecture réinjectée après suppression. Le contrôle de reprise après échec passait déjà.

Correction : suivi des opérations locales engagées (mutations, préparation de photo et création de session), fermeture du passage aux nouvelles opérations pendant la suppression, attente des opérations déjà lancées avant l’inventaire à effacer. Après réussite, les backends/abonnements précédents sont invalidés. Les lectures retardées ne remplissent pas le cache après un nettoyage. Un échec reste visible, vide le cache pour relire le stockage réel et libère le verrou pour une nouvelle tentative. Aucun changement à la suppression cloud, aux règles ou aux fonctions.

Contrôles : 20 tests locaux dont 8 nouveaux, suite complète 18 suites / 197 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Contrôles complémentaires : création locale déjà engagée, photo refusée, préférences hors préfixe `local:` préservées, anciens abonnés refusés, nouveau mode local utilisable après suppression. Suite sécurité relancée après modification du code : 20 tests réussis en 15,73 s, sortie 0, trois émulateurs demo arrêtés proprement. Le mock React Native trop minimal produisait un avertissement Expo ; remplacement par la seule propriété Platform.OS dans les tests, sans avertissement final.

Limites : tests locaux sur stockage/photographie simulés et branche web ; aucune image réellement copiée/supprimée, pas d’essai natif. API FileSystem SDK 57 relue : https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ ; APIs de copie/inventaire existantes inchangées. Le verrou est en mémoire, pas une transaction persistante : arrêt brutal, panne partielle du nettoyage et plusieurs processus restent à tester ; une opération qui ne termine jamais retarde la suppression, sans annoncer de faux succès. Aucune donnée réelle touchée, dépense, build, déploiement, diffusion ou validation Apple. Poursuite sur les actions concurrentes des formulaires de connexion.

## 2026-10-15, 11:01 Europe/Brussels — Connexion et durée de vie des actions UI

Base : `e7771d2557773b170d526f59bfa5a3b2b4125d98`, 113 SHA texte vérifiés et autres blobs préservés. Sept cas de formulaire échouaient avant correction : connexion/réinitialisation/retour non coordonnés, soumission directe doublée, résultat ou dialogue tardif après fermeture. Le bouton standard avait déjà son verrou individuel ; le nouveau verrou est partagé entre les actions du formulaire, pas une affirmation qu’un double tap sur ce bouton réel était sans protection.

`SignInForm` utilise le hook commun `useAsyncAction`, désactive les autres actions en attente et ignore les callbacks à son démontage. Deux régressions supplémentaires du hook ont été reproduites puis corrigées : ancien gestionnaire encore exécutable après démontage, erreur tardive rouvrant un dialogue. Les messages d’échec du formulaire et la conservation des champs restent inchangés. Revue React appliquée : verrou transitoire par ref, état pending dérivé du hook, cleanup explicite ; aucune bibliothèque UI ajoutée.

Contrôles : neuf tests du formulaire, deux nouveaux tests du hook ; suite complète 19 suites / 208 tests réussis, lint, TypeScript, diff relu et `git diff --check` réussis. Connexion et resetPassword sont simulés ; aucun e-mail envoyé, aucune authentification réelle. Pas de nouvelle exécution émulateur pour ces changements d’interface ; dernière preuve serveur : 20 tests à 10:54. Les requêtes déjà engagées ne sont pas annulées côté Firebase : seuls leurs effets sur l’ancienne interface sont ignorés. Aucun build, essai natif, déploiement, diffusion ou coût. Poursuite sur les ajouts de photos.

## 2026-10-15, 11:10 Europe/Brussels — Ajouts de souvenirs et contexte actif

Base : `cd736db4718afe3e8e44f9f0aa69692ac494dd87`, PR toujours ouverte en brouillon, 114 fichiers texte de base vérifiés par SHA. Reprise du travail en cours après la demande à 11:06, sans nouvelle session concurrente.

Sept régressions reproduites : sélecteur/photo retardés poursuivant le travail après démontage ou changement de backend, résultat d’écriture tardif touchant la nouvelle interface, ancien gestionnaire rouvrant la galerie. Le hook partagé `useAddMemory` associe désormais chaque opération à un contexte actif et son verrou ; il vérifie ce contexte avant chaque nouvelle étape, ignore les retours obsolètes, et ne libère pas le verrou d’un nouvel envoi.

Contrôles : 12 tests ciblés (dont double demande, annulation, reprise après erreur, chevauchement de deux contextes), suite complète 20 suites / 220 tests réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Le premier lint signalait une affectation globale pendant le rendu du composant de test : déplacée dans son effet, sans désactiver la règle. Aucune API native modifiée ; sélecteur, upload et écriture entièrement simulés.

Limites : un upload ou une écriture déjà engagés ne sont pas annulés. Un upload terminé après fermeture peut laisser un fichier sans document souvenir ; aucun nettoyage automatique ajouté à l’aveugle. Pas de nouvelle preuve émulateur pour ce changement client seul (dernière suite sécurité : 20 tests à 10:54), aucune donnée réelle, build, diffusion, dépense ou validation Apple. Suite : audit ciblé des restaurations de session concurrentes.

## 2026-10-15, 11:15 Europe/Brussels — Restauration de session côté interface

Base : `b0835860e471ff44accec1a4c4f2fdb984d0ddc6`, 115 SHA texte et autres blobs vérifiés. Cinq défauts reproduits après correction d’un mock d’abonnement réinitialisé entre tests : reprises déclenchant plusieurs lectures simultanées, ancienne session/réponse d’erreur remplaçant une sélection explicite, restauration réaffichée après déconnexion réussie, gestionnaires conservés encore actifs après démontage. Le contrôle nominal d’échec de déconnexion passait déjà.

`CoupleProvider` partage une restauration en cours, associe ses résultats à une révision et au cycle de vie du provider, et invalide les anciens résultats lors d’un choix explicite ou d’une déconnexion réussie. Les échecs de déconnexion restent propagés ; ils ne bloquent pas une restauration toujours valable. Revue React : état transitoire en ref et cleanup explicite, pas de bibliothèque ou d’API native ajoutée.

Preuves : 9 tests ciblés, dont échec de déconnexion pendant une lecture, résultat après démontage et rejeu StrictMode ; suite complète 21 suites / 229 tests réussis, lint, TypeScript, diff relu et `git diff --check` réussis. Les erreurs initiales de mock `stop is not a function` n’étaient pas des défauts produit ; la série rouge a été rejouée sur le code de base avec le mock corrigé (5 échecs / 1 contrôle vert).

Limites importantes : protection des résultats UI uniquement. `loadSession` et `clearSession` ne sont pas modifiés ; leurs opérations Firebase/AsyncStorage déjà engagées ne sont ni annulées ni rendues transactionnelles. L’audit de leur coordination avec une nouvelle connexion reste à faire ; aucun test de stockage/auth réel revendiqué. Dernière preuve sécurité inchangée (20 tests), pas de modification serveur ou suppression, ni build, diffusion, coût ou validation Apple.

## 2026-10-15, 11:20 Europe/Brussels — Accessibilité des contrôles et clôture

Base : `2d52caddd82956d4ca013a13cfa40f4c687e59de`, 116 SHA texte vérifiés et autres blobs préservés. Amélioration ciblée P2 : les actions « Tout voir » exposent maintenant un rôle bouton et le nom de leur rubrique ; les choix radio exposent leur état coché et un libellé explicite incluant le titre du champ s’il existe ; les pastilles de couleur exposent aussi l’état occupé/indisponible pendant une sauvegarde. Les onglets gardent leur état selected. Aucun changement visuel, dépendance ou nouveau service.

Preuves : après correction du montage de test (Pressable encapsulé non retrouvé ; copie globale des exports React Native déclenchant des modules natifs absents, remplacée par la seule substitution de Pressable sans évaluer les autres getters), quatre assertions échouaient sur le code de base et le contrôle d’onglets passait. Cinq tests ciblés puis 22 suites / 234 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Docs SDK 57 et llms relues, puis documentation React Native 0.86 : https://reactnative.dev/docs/0.86/accessibility. Il s’agit de propriétés vérifiées en rendu de test, pas d’un essai VoiceOver/TalkBack ni d’une validation visuelle.

Contrôle final de sécurité : `CI=1 npm run test:security`, compilation des fonctions réussie, 20 tests réussis en 18,50 s, sortie 0 et émulateurs arrêtés proprement, exclusivement `demo-nous-deux-security`. Les PERMISSION_DENIED sont les refus attendus des tests négatifs. Configuration de diffusion et fonctionnalités contrôlées inchangées ; publicationStatus reste draft et retentionVerified false. Runtime Node 24, pas de validation du Node 22 déclaré en production.

Durée observée avant journal/sauvegarde finale : 10:34:07–11:19:57 Europe/Brussels, soit 45 min 50 s, puis clôture. Huit tâches successives avec checkpoints indépendants ; clôture quelques minutes avant la cible approximative pour garder une frontière vérifiée, sans entamer la coordination transactionnelle auth/stockage dans le temps restant. Aucune attente artificielle ni affirmation d’une heure complète. Prochain audit P1 : effets de loadSession/clearSession face à une nouvelle connexion ; autres limites documentées : uploads orphelins, suppression partielle et essais natifs. Pas de nouveau blocage nécessitant le propriétaire ni incident de production observé. Aucun compte réel, e-mail, dépense, déploiement, EAS, nouvelle build, distribution TestFlight ou validation Apple. Les 7 images restent absentes du checkout texte.

## 2026-10-15, 11:37 Europe/Brussels — Coordination des opérations de session

Session commencée à 11:30:45 ; PR #3 ouverte en brouillon, base `76e1a7cb0db5dd2fba8759e6ffed628fa3cc0115`. Consignes relues via GitHub, 117 fichiers texte vérifiés par SHA, copie propre et dépendances présentes ; aucune dépendance aux PC. Règle multi-tâches déjà cohérente.

Quatre collisions reproduites après correction du reset des mocks : ancienne restauration refusée nettoyant la nouvelle session, déconnexion retardée effaçant une nouvelle session cloud/local, déconnexion exécutée avant la mémorisation d’une connexion en cours. Une file unique dans le runtime coordonne désormais restauration, connexion, création/jonction, sécurisation, suppression et déconnexion. Les appels internes utilisent la variante déjà verrouillée pour éviter les interblocages ; une opération refusée libère le passage. Les gardes de suppression locale immédiate sont conservés après qu’un test existant a révélé une attente circulaire dans la première version. La sécurisation mémorise aussi l’identité demandée et refuse de lier un autre compte après attente.

Preuves : 5 tests de courses, 2 contrôles de création/jonction simultanées et 1 garde d’identité ; suite complète 23 suites / 242 tests réussis, lint, TypeScript, diff relu et `git diff --check` réussis. Sécurité après introduction de la coordination de suppression : compilation fonctions, 20 tests réussis en 15,86 s, sortie 0, uniquement émulateurs `demo-nous-deux-security`, arrêtés proprement. Le dernier ajout concerne seulement le garde client de sécurisation et son test, sans nouvelle exécution émulateur. Source primaire relue : https://firebase.google.com/docs/auth/web/manage-users.

Limites : sérialisation dans un seul runtime, pas une transaction persistante ni un verrou multi-onglets ; une opération réseau qui ne termine jamais retarde les suivantes. Les changements d’identité externes au module restent à auditer. Aucun compte réel ni donnée intime, e-mail, dépense, build, déploiement ou distribution. Node 24 reste distinct du Node 22 de production, 7 images absentes, pas d’essai natif ou validation Apple. Suite : validation des sessions locales mal formées avant toute opération d’authentification.

## 2026-10-15, 11:40 Europe/Brussels — Sessions mémorisées mal formées

Base : `795adca6a1dd92220310fe77b16200c4934b3483`, 118 fichiers texte et autres blobs vérifiés. Dix cas échouaient avant correction : JSON cassé, valeurs non objet, mode inconnu, identifiants absents/vides/non texte ou contenant un séparateur de chemin. Certains déclenchaient une déconnexion automatique, d’autres entraient dans un backend invalide ; les erreurs de parsing n’étaient pas explicites.

Validation du format avant tout accès Firebase. Une session illisible est conservée et remonte une erreur, sans nettoyage ou réinitialisation automatique ; le parcours existant de reprise/assistance reste disponible. Les formats local/cloud valides sont conservés, sans nouvelle version ni migration des données.

Preuves : dix cas rouges puis verts avec contrôle d’absence d’appel Firebase, de signOut et de modification du stockage ; 23 suites / 252 tests applicatifs réussis, lint, TypeScript et diff relu/`git diff --check` réussis. Suite sécurité réexécutée pour la modification du chemin menant au nettoyage : 20 tests réussis en 15,70 s, compilation fonctions et sortie 0, émulateurs demo arrêtés. Aucun compte réel, donnée intime, dépendance ou distribution. L’erreur du provider reste générale à l’écran ; aucune récupération magique d’un JSON corrompu ni essai natif revendiqué.

## 2026-10-15, 11:45 Europe/Brussels — Fin de suppression et identité de l’interface

Base : `ef3af5b931c08aa566e92c12bef5b1d476f6edfd`, 118 SHA texte vérifiés. Le service de suppression nettoyait déjà la session, mais AccountCard relançait ensuite signOut ; un retour tardif pouvait ainsi déconnecter une nouvelle session. Sept tests du contrat cible échouaient (dont suppression doublée par appel direct, retour après démontage/changement de backend et mot de passe conservé pour un autre membre).

Le provider expose une fin de suppression purement UI, conditionnée au backend exact encore courant, sans deuxième appel auth/stockage ; les restaurations plus anciennes sont invalidées. Cette fin reste sûre après fermeture de l’écran, grâce au contrôle du provider. La carte compte est isolée par mode/espace/membre ; verrou immédiat commun et retours UI ignorés après démontage. Le bouton standard avait déjà un verrou individuel ; le test de double soumission cible ici le gestionnaire directement.

Preuves : 7 tests de carte et 3 tests du provider ; suite complète 24 suites / 262 tests réussis, lint, TypeScript, diff relu et `git diff --check` réussis. Suite sécurité : 20 tests réussis en 17,29 s, compilation fonctions, sortie 0 et émulateurs demo arrêtés. Revue React appliquée : isolation par clé plutôt que réinitialisation tardive de champs sensibles, nettoyage explicite et ref pour l’identité courante. Aucun compte réel supprimé, requête serveur réelle, nouvelle build ou diffusion. Les tests restent simulés côté UI ; la suite émulateur vérifie séparément le mécanisme serveur.

## 2026-10-15, 11:48 Europe/Brussels — Formulaire de sécurisation du compte

Base : `390f0eef77616e65cdfe89b0c9fd1ede1664510a`, 119 fichiers texte vérifiés. Six tests supplémentaires échouaient : fermeture et seconde soumission pendant l’envoi, succès/erreur tardifs après fermeture, validation contournée par appel direct du gestionnaire (adresse vide, mot de passe court ou confirmation différente). Le contrôle de reprise après erreur passait déjà.

Verrou partagé entre envoi et fermeture via le hook existant, validation dans le gestionnaire et garde de durée de vie. Le bouton avait déjà sa protection individuelle et son état désactivé ; le changement protège aussi les autres chemins d’appel. La saisie reste disponible après échec, et le changement de compte bénéficie de l’isolation de carte du checkpoint précédent.

Preuves : 14 tests de carte au total, suite complète 24 suites / 269 tests réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Authentification simulée, aucun e-mail/compte réel. Les opérations déjà lancées ne sont pas annulées ; aucune nouvelle exécution émulateur pour ce changement d’interface uniquement (dernière preuve : 20 tests à 11:44). Suite prioritaire : suppression partielle des séries de l’agenda.

## 2026-10-15, 11:57 Europe/Brussels — Suppression groupée des séries d’agenda

Base : `d5a59a9a000e408cdf4818bac1de2ebde6d24524`, 119 fichiers texte vérifiés. Le formulaire supprimait chaque horaire successivement : une erreur ultérieure laissait les premières suppressions acquises. Contrat cible vérifié par tests avant implémentation : 14 échecs / 36 contrôles verts (API groupée absente et formulaire utilisant encore les suppressions individuelles). Le tableau de paramètres de six cas invalides a ensuite été corrigé pour transmettre des tableaux complets, et non leur première chaîne.

Ajout de `removeEvents` : déduplication et validation des identifiants, maximum 52 horaires comme à la création, lot vide sans écriture ; une seule mutation locale ou un seul batch Firestore, jamais de fractionnement. Le formulaire conserve sa saisie si le lot est refusé et garde les protections de snapshot/confirmation existantes. Une série historique dépassant 52 horaires est explicitement refusée sans suppression. Documentation primaire relue : https://firebase.google.com/docs/firestore/manage-data/transactions.

Preuves : 50 tests ciblés réussis, puis 25 suites / 282 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. `CI=1 npm run test:security` : compilation fonctions, 21 tests réussis en 16,81 s, sortie 0 et émulateurs demo arrêtés. Le nouveau test refuse intégralement un batch mélangeant un horaire autorisé et un horaire d’un autre couple (les deux restent présents), puis supprime un lot autorisé de 52 en conservant les autres données fictives.

Limites : l’atomicité cloud porte sur les identifiants sélectionnés, pas sur un snapshot transactionnel de la série entière ; les modifications d’un partenaire après confirmation ne sont pas verrouillées. Une écriture locale unique ne garantit pas une résistance à tout crash du stockage. Aucun compte ou contenu réel, coût, build, déploiement, distribution ni essai natif. Suite : audit des retours tardifs du formulaire et des suppressions de listes terminées.

## 2026-10-15, 12:02 Europe/Brussels — Actions concurrentes du formulaire d’agenda

Base : `e25b1ace9b462cdec3e0883297fac1dc2527faca`, 120 SHA texte vérifiés. Six tests cibles échouaient : suppression/fermeture pendant une sauvegarde, double confirmation, confirmation individuelle après fermeture, ancien brouillon conservé au changement de compte (succès/échec différé) et gestionnaire de sauvegarde rejetant directement. Pour ce dernier, le bouton réel affichait déjà une erreur ; ce n’était pas une absence totale de signalement produit.

Verrou partagé entre sauvegarde, suppressions et fermeture ; validations du contexte avant les opérations et après les attentes. L’agenda est isolé par mode/espace/membre et le formulaire par horaire. Un retour d’un ancien formulaire ne notifie plus le partenaire ni ne ferme le nouveau brouillon. Les confirmations déjà ouvertes ne contournent pas le verrou et les gestionnaires conservés après fermeture sont inactifs. Revue React : clé d’identité, refs transitoires et cleanup ; aucun nouveau composant natif ou bibliothèque.

Preuves : 9 nouveaux tests, 27 contrôles d’écran au total, 25 suites / 291 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Sécurité après modification des chemins de suppression : compilation fonctions, 21 tests réussis en 17,41 s, sortie 0, émulateurs demo arrêtés. Aucun appel de notification réel ni contenu réel. Limites : l’écriture déjà lancée n’est pas annulée ; les suppressions via appui long hors formulaire et les autres écrans restent à auditer. Pas de nouvelle build, diffusion, dépense ou validation Apple.

## 2026-10-15, 12:05 Europe/Brussels — Confirmation par appui long dans l’agenda

Base : `a503d7442fa881a8066a420fdc29a518be3602f6`, 120 fichiers texte vérifiés. Nouvelle consigne reçue pendant le travail : PR et quatre fichiers de consignes relus via GitHub, tête inchangée, poursuite de la tâche engagée sans la doubler.

Sept tests cibles échouaient : suppression encore lancée après démontage, changement d’espace, chargement/erreur, disparition de l’horaire, double confirmation et rejet direct du callback. Ce dernier était déjà capturé par le vrai dialogue de confirmation ; le test vérifie désormais la gestion dans le chemin verrouillé. Confirmation revalidée sur l’état courant, opérations sérialisées dans l’écran et callbacks ignorés après démontage. Aucune modification des règles ni de la fonction de suppression serveur.

Preuves : 34 tests d’écran, 25 suites / 298 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 21 tests de sécurité réussis en 16,53 s, sortie 0, émulateurs demo arrêtés. Données et comptes fictifs uniquement. Limites : une suppression déjà envoyée ne peut pas être annulée ; le verrou d’appui long est distinct du formulaire et ne remplace pas une coordination multi-appareils. Aucun coût, EAS, build, déploiement ou diffusion.

## 2026-10-15, 12:08 Europe/Brussels — Rattachements serveur mal formés

Base : `f823d595b4f74c2d8e414c842ed1b34b4265a0aa`, 120 fichiers texte vérifiés. Quinze cas rouges de robustesse : identifiants de couple vides/non textuels/chemins, membres sous forme de chaîne ou de liste hétérogène. Le `includes` d’une chaîne pouvait être pris pour un test d’appartenance, et certains formats incomplets déclenchaient un nettoyage de session. Ce sont des réponses fictives injectées dans les tests, pas un incident observé sur des données réelles ; les règles serveur restent indépendantes de ces gardes clients.

Validation commune de l’identifiant et de la liste de membres dans restauration/reconnexion. Une réponse illisible lève une erreur explicite et préserve la session ; absence réelle du couple ou non-appartenance valide gardent le comportement existant. L’absence d’index conserve le repli de migration déjà testé. Pas de réparation automatique des documents serveur.

Preuves : 15 cas rouges puis verts, 25 suites / 313 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Sécurité réexécutée car le parcours peut mener au nettoyage : compilation fonctions, 21 tests réussis en 16,25 s, sortie 0, émulateurs demo arrêtés. Aucun compte réel, donnée intime, nouvel appel facturable, build, déploiement, diffusion ou validation Apple. Suite : garde d’identité pendant les lectures asynchrones, distincte de la sérialisation interne existante.

## 2026-10-15, 12:11 Europe/Brussels — Identité externe pendant une restauration

Base : `9decdafce691fecbd5d4de54938120c820d410b1`, 120 fichiers texte vérifiés. Onze cas échouaient, un contrôle nominal passait : changement de compte/déconnexion pendant lecture d’index ou de couple, succès/refus tardif, ancienne session visant un autre utilisateur. Une ancienne restauration pouvait retourner son backend ou nettoyer la nouvelle session malgré la file interne, car un changement Auth externe ne passe pas par cette file.

Vérification de l’identité avant les lectures et après chaque attente dans restauration/récupération, y compris avant traitement d’un refus d’accès. Une identité différente remonte une erreur sans déconnecter le compte courant ni remplacer la session avec l’ancienne réponse. Le cas sans aucun utilisateur authentifié garde son nettoyage nominal. L’ancien test de discordance attend désormais préservation/erreur, et non une déconnexion automatique.

Preuves : 12 tests ciblés, 26 suites / 325 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 21 tests de sécurité réussis en 16,40 s, sortie 0 et émulateurs demo arrêtés. Limites explicites : contrôle d’identité aux frontières asynchrones, pas de transaction Auth/AsyncStorage ; une écriture ou un nettoyage déjà engagés peuvent encore entrer en conflit avec une opération extérieure. Les mutations serveur (notamment suppression après réauthentification) nécessitent leur propre garde. Aucun compte réel, notification, dépense, build, déploiement, diffusion ou validation Apple.

## 2026-10-15, 12:16 Europe/Brussels — Identité confirmée pour suppression et clôture

Base : `3eae962317bfa99ab919666f48c35b260b614552`, 121 fichiers texte vérifiés. Quatre contrôles clients échouaient avant correction, un nominal passait : changement de compte durant réauthentification/rafraîchissement de jeton, absence d’identité attendue dans la requête et réponse tardive nettoyant une autre session. Le nouveau test serveur échouait aussi sur émulateurs (22 réussis / 1 échec) : le champ d’identité confirmée était ignoré. Aucun incident sur un compte réel constaté ou recherché.

Gardes client avant appel serveur et nettoyage, y compris après réauthentification ; envoi de `expectedUserId`. Le serveur compare ce champ, lorsqu’il est présent, au UID du jeton avant toute lecture/tâche de suppression. Il ne l’utilise jamais pour choisir une autre cible. Le champ est facultatif pour la compatibilité des anciens clients ; ils ne bénéficient pas de cette vérification d’intention. TESTFLIGHT-REVIEW.md documente le serveur corrigé à déployer/vérifier avant le nouveau client, sous preuve de coût nul et autorisation de diffusion. Rien n’a été déployé.

Preuves finales : 8 tests clients de suppression (y compris erreur de mot de passe, compte anonyme, résultat pending/complete et invalidation Auth attendue), 27 suites / 333 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 23 tests de sécurité réussis en 16,64 s, sortie 0 et émulateurs demo arrêtés. Les deux nouveaux tests serveur vérifient le refus sans tâche d’un UID différent/invalide et les parcours nominal/ancien client avec conservation du partenaire. Derniers ajouts après cette suite : tests clients et documentation seulement, aucun code serveur changé.

Durée observée avant journal/sauvegarde finale : 11:30:45–12:15:58 Europe/Brussels, soit 45 min 13 s, puis clôture. Dix tâches successives avec checkpoints indépendants ; fin à une frontière vérifiée après le changement client/serveur de suppression, sans commencer une nouvelle mutation transversale pour remplir artificiellement la cible approximative. La demande reçue en cours de travail n’a pas fait recommencer les tâches terminées. Suite P1 : création/jonction face aux changements externes, panier et autres formulaires ; limites persistantes Auth/stockage non transactionnels, uploads orphelins, essais natifs.

État de livraison : code préparé uniquement, PR toujours en brouillon ; aucune nouvelle build, distribution TestFlight, lecture récente du statut Apple ni validation sur iPhone. Les 7 images manquent toujours à la copie texte ; Node 24 utilisé, Node 22 déclaré en production non validé ici. Liens publics toujours draft, retentionVerified false et fonctionnalités payantes inchangées/désactivées dans la configuration fournie. Aucun compte réel, contenu intime, e-mail, notification, paiement, achat, déploiement ou dépense. Aucun nouveau blocage exigeant une intervention du propriétaire ; les prérequis de diffusion restent ouverts.

## 2026-10-15, 12:37 Europe/Brussels — Identité lors de création/jonction

Reprise à 12:31:27 : PR ouverte/brouillon, consignes et journal relus via GitHub, 122 SHA texte vérifiés sur `47cbd11cd7b7d9ad98360b2554eee1baca2c248b`. Huit cas clients rouges (deux gardes existantes passaient), puis deux tests serveur rouges sur émulateurs : identité ignorée avant création et nouveau champ refusé par l’ancien schéma strict de jonction. Reproductions fictives uniquement, pas d’incident réel constaté.

Création/jonction partagent maintenant des gardes avant appel, après réponse et après stockage ; un retour périmé ne remplace pas une nouvelle session. `expectedUserId` comparé au jeton serveur avant quota/mutation, schéma de jonction adapté tout en restant strict et compatible avec les anciens clients. Tests : refus d’UID différent/invalide sans consommation de quota/invitation ni création de rattachement, succès et ancien protocole ; changement d’identité/déconnexion pendant récupération, appel et stockage.

Preuves : 12 tests clients ciblés, 28 suites / 345 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 25 tests sécurité réussis en 16,11 s, sortie 0, émulateurs `demo-nous-deux-security` arrêtés. Dernier ajout après sécurité : deux tests clients seulement. Limites : Auth et stockage toujours non transactionnels, pas d’annulation d’une mutation déjà authentifiée/envoyée. Déploiement serveur nécessaire avant nouveau client, spécialement pour le schéma de jonction ; consigne inscrite dans TESTFLIGHT-REVIEW.md. Aucun déploiement/build/distribution, données réelles, invitation réelle, coût ni validation Apple. Suite : valider la réponse serveur avant de mémoriser une session.

## 2026-10-15, 12:39 Europe/Brussels — Réponse d’inscription validée avant stockage

Base `0960a46da3047980b53dc2b3d6440a9f4232746f`, 123 fichiers texte vérifiés après checkpoint. Vingt-deux cas rouges : réponses fictives nulles/incomplètes ou identifiants invalides lors de création/jonction, puis récupération après réponse incomplète. Les valeurs nulles déclenchaient déjà une erreur technique ; d’autres formats écrivaient une session inutilisable. Aucun cas constaté sur le serveur réel.

Validation du résultat inconnu et de l’identifiant avant sauvegarde, erreur lisible et conservation de la session précédente. Une nouvelle tentative retrouve le rattachement serveur existant sans rejouer la création/consommer l’invitation. Preuves : 34 tests ciblés, 28 suites / 367 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Aucun code serveur/règle/suppression modifié ; dernier contrôle sécurité de cette session : 25 tests réussis à 12:37. Code seulement, pas de build, diffusion, déploiement, dépense ni essai natif. Suite : confirmations de suppression dans les listes.

## 2026-10-15, 12:44 Europe/Brussels — Panier sans suppression partielle

Base `ed4fe1d8942f8e17d12c8fcc7a1878b98b48d65b`, 123 SHA texte vérifiés. Lecture du code : boucle de suppressions individuelles sans atomicité, donc un échec pouvait laisser un panier partiellement effacé. Test d’écran rouge avant remplacement par une opération groupée. Nouvelle méthode dédiée `clearShoppingBasket` : sélection dédupliquée, bornée à 100, aucune écriture pour sélection vide/invalide ; relecture avant suppression des seules courses sélectionnées encore cochées. Transaction Firestore pour le cloud, mutation locale sérialisée en une écriture. Pas de suppression des cadeaux ni des autres listes.

Preuves : 13 nouveaux tests applicatifs (écran, huit cloud simulés, quatre stockage local), 29 suites / 380 tests réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 27 tests de sécurité sur émulateurs demo réussis en 18,62 s, sortie 0 et arrêt confirmé : transaction réelle de 100 articles, accès tiers refusé sans perte, modification concurrente entraînant une nouvelle lecture et conservant la course décochée. Les tests émulateurs vérifient les primitives/règles avec le même schéma transactionnel, pas un parcours natif de l’interface.

Documentation officielle Firestore transactions consultée : https://firebase.google.com/docs/firestore/manage-data/transactions ; API utilisée avec Firebase 13 installé. Limites : cloud indisponible hors ligne, lectures supplémentaires et répétitions possibles en cas de conflit ; aucun appel réel, coût de production non validé, distribution toujours bloquée. Au-delà de 100 : refus explicite sans fractionner le panier. Une écriture locale unique ne promet pas de résistance à tous les crashs physiques. Confirmations anciennes et double-appui de l’écran à traiter ensuite. Aucun compte réel, coût, build, déploiement ni diffusion.

## 2026-10-15, 12:49 Europe/Brussels — Actions et confirmations des listes

Base `a55a0ba382d6354900700e4d000d52b6cfa1da22`, 124 fichiers texte vérifiés. Vingt cas d’écran rouges, puis deux cas supplémentaires d’aller-retour d’onglet : suppression encore active après démontage/changement de compte/onglet, lecture inconnue ou article disparu ; double appel ; case utilisant une ancienne valeur ; retours tardifs. Le test d’erreur du panier vérifie le nouveau chemin verrouillé : l’ancien code affichait déjà un message d’erreur, ce n’était pas une erreur totalement masquée.

Écran isolé par mode/espace/membre, contexte renouvelé à chaque changement d’onglet/backend, état frais relu au moment de confirmer. Le panier confirmé exclut les articles décochés et les nouveaux articles absents de la sélection initiale. Verrou commun entre cases, suppression individuelle par appui long et panier ; état occupé exposé aux cases. Retour tardif d’un ancien onglet ignoré. Revue React appliquée : clé d’identité, refs transitoires, cleanup, callbacks contextualisés ; pas de bibliothèque ajoutée. SDK Expo 57 et index llms consultés, Pressable RN 0.86 vérifié : https://reactnative.dev/docs/0.86/pressable.

Preuves : 22 tests ciblés, 30 suites / 402 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 27 tests sécurité réussis en 19,10 s sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés après dernière modification. Limites : les opérations déjà envoyées ne sont pas annulées ; le formulaire possède encore son ancien cycle d’actions et sera traité séparément. Pas d’essai tactile/visuel/natif, build, distribution, déploiement ou dépense. Point d’avancement demandé par le propriétaire reçu pendant la sauvegarde, sans recommencer les tâches terminées.

## 2026-10-15, 13:42 Europe/Brussels — Formulaire des listes

Reprise à 13:34:59, PR ouverte/brouillon, consignes relues ; 125 fichiers texte vérifiés contre `a393469f74c3b03297701bce290a725f0ddfd208`, 7 images toujours absentes de la copie de contrôle. Seize tests rouges sur callbacks de formulaire simulés : confirmation périmée, lecture inconnue/article retiré, concurrence sauvegarde/suppression/fermeture, catégorie et brouillon réutilisés. Le vrai Button/confirmDelete gérait déjà les erreurs et son propre double appui ; les tests directs prouvent ici le nouveau verrou partagé, pas l’absence ancienne de toute protection.

Formulaire isolé par article et catégorie initiale, verrou commun aux actions/fermeture, présence et propriété du cadeau revalidées dans la collection actuelle. Fermeture invalidée immédiatement, gardes de backend et de démontage, réponses tardives ignorées. Brouillon conservé lors d’erreur, recharge proposée et mutations bloquées tant que la lecture est inconnue. Revue React : clés, refs transitoires et cleanup ; aucune dépendance ajoutée.

Preuves : 22 tests ciblés, 31 suites / 424 tests applicatifs réussis ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 27 tests sécurité réussis en 17,34 s sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés. Aucun code serveur ni règle changé. Limites : mutation déjà envoyée non annulable ; verrou du formulaire distinct de celui de l’écran, pas de coordination multi-appareils. Pas d’essai natif/visuel, build, déploiement, distribution, nouvelle lecture Apple, compte réel ni dépense. Suite : formulaire des restaurants.

## 2026-10-15, 13:45 Europe/Brussels — Formulaire des restaurants

Base `1000a7ec340c721dc79ce42fe37641a6f4f175e9`, 126 SHA texte vérifiés et anciens blobs non modifiés préservés. Dix-neuf cas rouges de formulaire simulé : confirmations périmées, sauvegarde avec lecture inconnue ou restaurant retiré, actions concurrentes, ancien brouillon réutilisé et résultats tardifs. Comme pour les listes, Button/dialogue possédaient déjà leurs propres protections ; le correctif les étend au formulaire entier.

Écran isolé par mode/couple/membre, formulaire par restaurant, verrou partagé pour sauvegarde/suppression/fermeture. Relecture de présence et disponibilité avant mutation, refus d’un nom vide dans l’action, brouillon conservé/recharge possible et retours d’ancien backend ignorés. Revue React appliquée ; Expo SDK 57/index llms et Pressable RN 0.86 relus, aucune API native ajoutée.

Preuves : 19 tests ciblés, 32 suites / 443 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 27 tests sécurité réussis en 18,55 s sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés. Le test vérifie explicitement zéro appel Places, fonctionnalité toujours désactivée. Aucune mutation de règles/serveur, donnée réelle, notification, dépense, build, déploiement, distribution ou validation native/Apple. Limites : pas d’annulation d’une écriture déjà envoyée ni de coordination multi-appareils. Suite : audit des photos orphelines sans effacer une photo potentiellement référencée.

## 2026-10-15, 13:49 Europe/Brussels — Photo et date du couple

Base `69c1451f73200e6991b1712e6246da3419e4bf9c`, 127 SHA texte vérifiés. L’audit photo révèle un parcours CounterSheet encore non contextualisé. Quinze tests rouges : retour tardif du sélecteur/upload, ancien résultat fermant un nouvel écran, concurrence entre date/photo/fermeture, cadrage appliqué à une photo remplacée et ancien aperçu pendant synchronisation. Les erreurs/doubles appuis propres à Button étaient déjà protégés ; les nouvelles garanties portent sur le cycle partagé.

Formulaire isolé par identité, gardes après attentes, verrou avant ouverture du sélecteur et pour toutes les actions, disponibilité du couple vérifiée. Cadrage lié à l’URL exacte reçue, sauvegarde bloquée si la photo courante diffère ; une ancienne ouverture de cadrage ne reprend pas après fermeture/réouverture. Aucune API de galerie ou d’envoi changée, uniquement l’orchestration cliente.

Preuves : 18 tests ciblés, 33 suites / 461 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Pas de changement serveur/règle/suppression ; dernier contrôle sécurité : 27 tests réussis à 13:45. Limites : fichier déjà envoyé mais non associé peut rester orphelin ; une erreur d’association ne prouve pas l’absence de commit serveur, donc aucun nettoyage automatique destructif ajouté. La comparaison de photo cliente n’est pas une transaction avec un autre appareil. Pas de photo réelle, compte réel, build, déploiement, distribution, dépense ni validation Apple/native.

## 2026-10-15, 13:55 Europe/Brussels — Identité et repli de l’upload

Base `9e7955f01155cf92b074cdfeed027a0317fb2709`, 128 SHA texte vérifiés. Après correction du harnais Jest (XMLHttpRequest absent dans cet environnement), reproduction sur le code précédent : 12 échecs et un contrôle passant ; le cache global du repli contaminait aussi les cas suivants. Deux tests supplémentaires rouges confirmaient un second format produit après upload réussi mais lecture d’URL échouée. Données/payloads fictifs, aucun fichier réel envoyé.

Repli historique conservé uniquement sur bucket/project explicitement non configuré, limité au backend courant et avant succès de l’upload. Refus d’accès, erreur inconnue et panne temporaire restent des erreurs visibles ; la reconnexion peut réévaluer Storage. Gardes d’identité avant lecture, upload, récupération d’URL et retour de compression. Documentation officielle des codes consultée : https://firebase.google.com/docs/storage/web/handle-errors. Aucun forfait, quota ou service activé ; aucune conclusion de gratuité déduite d’une erreur.

Preuves : 15 tests ciblés, 34 suites / 476 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Aucun changement serveur/règle/suppression ; dernier contrôle sécurité : 27 tests à 13:45. Limites : upload déjà engagé non annulé, Storage et Firestore non transactionnels, orphelins toujours possibles. Un protocole durable d’association idempotente/réconciliation reste nécessaire avant purge ; aucun nettoyage réel ou automatique ajouté. Pas de build, déploiement, distribution, dépense ni validation native/Apple.

## 2026-10-15, 13:58 Europe/Brussels — Préconditions des mutations cloud

Base `e6d85aef4edb398115d1e770b4f2639a96b76654`, 129 SHA texte vérifiés. Vingt-deux scénarios rouges : les dix chemins de mutation d’un ancien backend acceptaient un autre UID ou une déconnexion ; le panier continuait après changement pendant lecture ou reprise transactionnelle. Un échec additionnel venait du test nominal de fonction qui attendait undefined au lieu de son objet : assertion corrigée, non comptée comme défaut produit.

Garde commune avant modification du couple/profil, ajout simple/réponse privée/agenda, suppression simple/groupée/panier et appels de fonction. Le callback de transaction revalide avant ses lectures et avant ses suppressions. Aucun nouveau champ de protocole ni règle serveur ajouté. Cette garde est une précondition cliente, pas une transaction Auth/Firestore ni une révocation d’une requête déjà engagée.

Preuves : 32 tests ciblés, 35 suites / 508 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Compilation fonctions et 27 tests sécurité réussis en 19,17 s sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés. Les tests applicatifs simulent le changement Auth ; les tests sécurité vérifient les règles/opérations existantes, sans essai natif de changement de compte. Aucun compte réel, appel facturable, notification, paiement, build, déploiement ni distribution.

## 2026-10-15, 14:01 Europe/Brussels — Destination des cartes

Base `00928424541b1394cd65294059d350f34c0d0afa`, 130 SHA texte vérifiés. Après correction d’une initialisation du renderer de test, un cas d’écran rouge prouvait que mapsUrl était transmis tel quel à Linking, y compris un protocole arbitraire fictif. Pas de lien malveillant réel constaté ni ouvert.

Validation cliente des liens HTTPS sans identifiants/port non standard/caractères de contrôle, sur google.com/www.google.com et maps.google.com avec chemins Maps. Sinon recherche existante reconstruite à partir du nom et du quartier encodés ; aucun lien public de confidentialité débloqué. Les liens courts ou domaines Maps non reconnus se replient sur cette recherche, avec perte possible de précision mais sans ouvrir une destination arbitraire.

Preuves : 24 tests unitaires d’URL et un nouveau test d’écran, 36 suites / 533 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Docs officielles consultées : https://reactnative.dev/docs/0.86/linking et https://developers.google.com/maps/documentation/urls/get-started ; Expo 57/index llms déjà relus dans cette session. Aucun navigateur/app Maps lancé, aucune API Places appelée, aucune donnée réelle modifiée. Pas de changement serveur/règle/suppression ; dernier contrôle sécurité : 27 tests à 13:58. Distribution et essai natif restent distincts et non réalisés.

## 2026-10-15, 14:06 Europe/Brussels — Tirages et cartes périmés

Base `9e10018f081e5762441e798069ba5fcc16d16be9`, 132 SHA texte vérifiés. Treize cas rouges : Relancer réaffichait les anciennes listes malgré panne, démontage, changement de backend ou aller-retour d’onglet ; carte issue d’une fiche remplacée/retirée encore utilisable. Les tests utilisent exclusivement des titres/adresses fictifs et un Linking simulé.

Relance contextualisée et relecture des films encore à voir/restaurants encore à essayer ; états vides confirmés distingués d’une lecture indisponible. Carte revalidée par identifiant puis construite depuis la destination courante. Revue React : contexte renouvelé, refs et cleanup ; pas de nouvel abonnement réseau ni service.

Preuves : 15 nouveaux tests (dont deux contrôles d’état vide), 36 suites / 548 tests applicatifs ; lint, TypeScript, diff relu et `git diff --check` réussis. Aucun changement serveur/règle/suppression ; dernier contrôle sécurité : 27 tests à 13:58. Limite : un dialogue déjà affiché n’est pas fermé rétroactivement, seuls ses callbacks sont invalidés ; une carte déjà ouverte dans une autre app n’est pas rappelée. Aucune ouverture réelle, dépense, build, diffusion ou validation native/Apple. Suite : empêcher une saisie tardive d’être perdue pendant la sauvegarde des formulaires.

## 2026-10-15, 14:14 Europe/Brussels — Saisie pendant une sauvegarde

Base `bb867b2b63966961bc05fe790f1c565eddacb0bf`, 132 SHA texte vérifiés. Les formulaires listes/restaurants permettaient de modifier les champs après capture des données par Enregistrer, puis fermaient le brouillon au succès sans enregistrer cette saisie tardive. Neuf nouveaux tests rouges, dont le test des cœurs après correction du mock Pressable du renderer (ce défaut de harnais n’est pas compté comme défaut produit).

Champs non éditables, choix Film/Série/Liste et note désactivés pendant la mutation. Les setters passent aussi par le verrou synchrone commun : une ancienne référence de callback ne contourne pas l’attente ; contexte périmé ignoré. Après échec, brouillon intact et saisie réactivée. Chips expose son état désactivé et ne déclenche plus de retour haptique dans cet état. Le callback Places est protégé sans activer cette fonctionnalité.

Preuves : 36 suites / 557 tests applicatifs, lint, TypeScript, diff relu et `git diff --check` réussis. Documentation TextInput React Native 0.86 consultée pour editable, documentation Expo 57/llms et Pressable déjà lue. Revue React : conservation du state local et verrou par ref, pas de nouvel effet réseau. Aucun changement serveur/règle/mécanisme de suppression ; dernier contrôle sécurité : 27 tests à 13:58. Limites : pas de vérification clavier/appareil/lecteur d’écran, autres formulaires non couverts par ce correctif ; aucune build ni distribution.

## 2026-10-15, 14:18 Europe/Brussels — Accessibilité des notes de restaurants

Base `c278f578b7fc88e718d8c0d41ed7ea393a862044`, 132 SHA texte vérifiés. Composant de notation extrait sans changer son comportement initial pour reproduire cinq tests rouges : cinq boutons désactivés même en lecture seule, aucune note globale exposée, sélection/désactivation non annoncées en édition. Nouveau composant hors des routes Expo.

Lecture seule : résumé « note sur cinq » ou absence de note, icônes décoratives masquées aux technologies d’assistance et aucun Pressable. Édition : rôle bouton, sélection et désactivation, indication pour attribuer une note ou retirer celle sélectionnée ; comportement de retrait conservé. Documentation officielle React Native 0.86 accessibility relue ; revue React du composant sans nouvel effet/abonnement.

Preuves : 37 suites / 562 tests applicatifs réussis ; après retrait d’un import devenu inutilisé signalé par lint, lint et TypeScript propres, 38 tests ciblés réussis, diff relu et `git diff --check` réussi. Pas de validation VoiceOver/TalkBack ni de l’ordre réel du focus dans les cartes imbriquées ; ce contrôle nécessite un appareil. Aucun service/API payant, build, déploiement, distribution ou changement de règles.

## 2026-10-15, 14:22 Europe/Brussels — Verrou du cadrage

Base `8ff740d2b028c872d021e8089ff2d6eb71463ce4`, 134 SHA texte vérifiés. Tests rouges : cadrage modifié pendant sa sauvegarde, ancien callback modifiant un cadrage rouvert, gestes actifs malgré désactivation. Le contrôle nominal supplémentaire attendait explicitement disabled=false alors que la propriété était absente ; ce point n’est pas compté comme défaut utilisateur. TypeScript a ensuite détecté l’absence de prop disabled sur IconButton : ajout compatible avec les usages existants, test rouge dédié et contrôle du verrou interne déjà fonctionnel.

PhotoFrameEditor accepte disabled, ne capture plus les gestes et bloque aussi les commandes de zoom/réinitialisation ; texte d’attente explicite. CounterSheet partage son verrou avec les changements de cadrage et vérifie l’identité de l’éditeur/photo. IconButton combine désactivation externe et attente interne, avec état accessible. Documentation Gesture Responder System React Native 0.86 relue, revue React des refs/contexte et diff effectuée.

Preuves finales : lint propre, TypeScript, 38 suites / 568 tests applicatifs et `git diff --check` réussis. `CI=1 npm run test:security` : compilation fonctions et 27 tests réussis en 18,16 s, sortie 0, émulateurs auth/firestore/storage arrêtés à 14:21 ; uniquement demo-nous-deux-security, données fictives. Aucun changement serveur depuis cette vérification. Pas de test tactile, clavier, image réelle ni lecteur d’écran. Le risque analogue du DateField de rencontre reste une piste prioritaire issue de la lecture du setter direct, non encore reproduite ni corrigée. Aucune dépense, build, diffusion ni validation Apple.

## 2026-10-15, 14:24 Europe/Brussels — Clôture et reprise durable

Travail continu observé depuis 13:34:59, soit environ 49 minutes jusqu’au contrôle final de 14:23:58, hors dernière sauvegarde du présent journal. Dix tâches cohérentes réalisées et sauvegardées indépendamment, sans attendre artificiellement pour atteindre une heure. Clôture à une frontière de tâche proche de l’objectif de 50 minutes ; le prochain chantier DateField nécessite ses propres vérifications multiplateformes, pas de correctif précipité. Aucun arrêt lié à un achat de quota ni nouvelle automatisation.

Checkpoints GitHub de cette session (SHA du dépôt, distincts des commits locaux de la reconstruction) :

- `1000a7ec340c721dc79ce42fe37641a6f4f175e9` : formulaires listes, 424 tests applicatifs.
- `69c1451f73200e6991b1712e6246da3419e4bf9c` : formulaires restaurants, 443 tests.
- `9e7955f01155cf92b074cdfeed027a0317fb2709` : cycle de vie photo/date, 461 tests.
- `e6d85aef4edb398115d1e770b4f2639a96b76654` : identité et repli des uploads, 476 tests.
- `00928424541b1394cd65294059d350f34c0d0afa` : préconditions d’identité des mutations cloud, 508 tests.
- `9e10018f081e5762441e798069ba5fcc16d16be9` : destinations cartographiques, 533 tests.
- `bb867b2b63966961bc05fe790f1c565eddacb0bf` : tirages et cartes périmés, 548 tests.
- `c278f578b7fc88e718d8c0d41ed7ea393a862044` : brouillons verrouillés pendant sauvegarde, 557 tests.
- `8ff740d2b028c872d021e8089ff2d6eb71463ce4` : notation accessible, 562 tests.
- `cb07d24b41d51f9753d12b9ecd8c2ef91adece2c` : cadrage et boutons icônes, 568 tests.

État final vérifié : 135 fichiers texte aux SHA identiques à GitHub, autres blobs inchangés à chaque checkpoint, arbre local propre ; aucun workflow GitHub dans l’arbre. Chaque référence avancée avec expected_sha et force=false. Lint/TypeScript et 38 suites applicatives passent ; compilation fonctions et 27 tests de sécurité finaux passent sur émulateurs arrêtés. Runtime de contrôle Node 24.19.0 / Java 17.0.20 ; ce n’est pas une validation du runtime de production Node 22.

PR #3 toujours ouverte et en brouillon lors des sauvegardes, aucune fusion. Les 7 images binaires manquent toujours à la copie de contrôle : ni export visuel, ni build signée, ni essai appareil, ni distribution, ni nouveau statut Apple constaté. publicationStatus=draft et retentionVerified=false inchangés ; fonctionnalités payantes non activées. Les prérequis serveur avant distribution, l’association/réconciliation des uploads et les preuves légales restent distincts de ces tests clients. Aucun incident sur des données réelles observé ni intervention nouvelle du propriétaire nécessaire.

## 2026-10-15, 14:35 Europe/Brussels — Verrou de la date de rencontre

Reprise à 14:32:39, PR #3 ouverte/brouillon, base `b3cf004486b365a1c793778499a2b1d4d7e6d9e7`. Instructions relues via GitHub ; 135 fichiers texte locaux propres vérifiés par SHA contre l’arbre distant avant réutilisation, 7 images absentes et non simulées.

Onze cas rouges reproduits : saisie pendant sauvegarde, callback après fermeture/cadrage/changement de backend ou indisponibilité, sélecteurs non désactivables et réponse Android après démontage/désactivation/réactivation. DateField accepte désormais disabled sur les trois plateformes ; iOS utilise la prop native documentée, Android bloque l’ouverture, web bloque la saisie. Les callbacks natifs sont invalidés par contexte et nettoyage ; CounterSheet ajoute son verrou synchrone et revalide la disponibilité/contexte avant de changer le brouillon. Une erreur d’enregistrement restitue une date éditable.

Preuves : lint et TypeScript réussis, 39 suites / 579 tests applicatifs réussis, diff relu et `git diff --check` réussi. Revue React utilisée pour refs/contexte/cleanup. Expo SDK 57, index llms et documentation DateTimePicker relus ; README installé de @react-native-community/datetimepicker 9.1.0 vérifié pour disabled iOS et onValueChange. Aucun serveur/règle/suppression modifié ; les 27 tests sécurité précédents ne sont pas revendiqués comme nouvellement exécutés. Limite : dialogue Android déjà affiché non fermé automatiquement, mais sa réponse périmée ignorée ; aucun essai physique, build, diffusion, dépense ou statut Apple nouveau.

## 2026-10-15, 14:38 Europe/Brussels — Une réponse par ouverture Android

Base `00e7d563e20deee0de889f1d51e42f09842b885d`, 136 SHA texte vérifiés et autres blobs préservés. Quatre nouveaux cas rouges : ancienne ouverture, réponse double, réponse après annulation et valeur extérieure changée puis éventuellement restaurée. Six tests ajoutés au total, dont les contrôles d’annulation ancienne et de remplacement du gestionnaire courant.

Jeton de requête par ouverture, consommé avant notification du parent, invalidation sur onDismiss et contexte de valeur. Aucun appel global dismiss ajouté : ne pas fermer le sélecteur d’un autre champ. Revue React : jeton en ref, valeur de formulaire conservée dans le state du parent, gestionnaire courant relu. Docs du paquet 9.1.0 lues pour onDismiss.

Preuves : lint, TypeScript, 39 suites / 585 tests applicatifs et `git diff --check` réussis ; diff relu. Aucune modification serveur/suppression, aucun contrôle natif ni nouveau test sécurité ; aucun coût, build ou distribution. Suite : synchronisation de la saisie web, qui conserve encore son texte initial lors d’un remplacement de la valeur du parent.

## 2026-10-15, 14:41 Europe/Brussels — Brouillon date/heure web synchronisé

Base `4ec4f02a33bae835cade536177b20210edcde68c`. Quatre cas rouges et un contrôle nominal : texte affiché différent de la valeur externe et ancien callback capable de changer l’affichage après désactivation/changement de valeur. Le brouillon garde désormais la valeur à laquelle il correspond ; remplacement externe réinitialisé sans effet de synchronisation ni remontage du champ. Saisie partielle et format tapé conservés pendant les mises à jour normales du parent, format canonique au blur. Les anciens callbacks sont gardés par le contexte du sélecteur.

Preuves : lint/TypeScript, 39 suites / 590 tests applicatifs, diff relu et `git diff --check` réussis. Revue React et documentation officielle https://react.dev/learn/you-might-not-need-an-effect consultées pour l’ajustement conditionnel du state du même composant ; garde explicite contre une boucle. Tests de frappe contrôlée 1 → 12 → 123 → 1230 et de remplacement aller-retour. Aucun clavier/focus navigateur réel validé, aucun service, build, déploiement, opération financière ou modification serveur/suppression.

## 2026-10-15, 14:46 Europe/Brussels — Édition des souvenirs

Base `16047d541f52d998fe339d4b72e194d602c98561`. Seize tests rouges du formulaire : confirmations périmées, action malgré lecture inconnue/souvenir retiré, concurrence entre commandes, résultat tardif, brouillon réutilisé entre photos, date future acceptée. Deux contrôles nominaux de suppression/reprise ajoutés ensuite. Les tests remplacent Button et le dialogue par des doublures : leurs protections individuelles existaient déjà ; la nouveauté est le verrou partagé et le contexte du formulaire.

Album isolé par espace/membre, formulaire par identifiant du souvenir. Présence/lecture revalidées avant sauvegarde et suppression ; fermeture invalidante, champs figés pendant opération, erreur courante visible et erreur ancienne ignorée. Aperçu retiré quand la collection est indisponible, légende conservée avec reprise explicite. Date future refusée dans l’action et dans l’état du bouton, y compris sur web. Revue React : clés, cleanup et refs courantes vérifiés.

Preuves : lint/TypeScript et `git diff --check` réussis, diff relu ; 40 suites / 608 tests applicatifs réussis. Compilation fonctions et 27 tests sécurité réussis en 22,13 s, sortie 0 et émulateurs arrêtés, exclusivement demo-nous-deux-security. Aucune donnée, photo, compte ou suppression réelle ; pas de changement de règles/serveur, build, déploiement, dépense ou distribution. Limites : pas d’annulation atomique d’une mutation déjà envoyée ni de test natif. Suite prête : création/suppression des comptes à rebours sur l’accueil, dont les callbacks ne sont pas encore contextualisés.

## 2026-10-15, 14:53 Europe/Brussels — Dates de l’accueil

Base `a73fb5c569dc55b239f462ef4bf12917126e848f`, 137 fichiers texte vérifiés par SHA et autres blobs inchangés. Vingt cas rouges du nouvel ensemble countdown-actions : confirmations anciennes, création après fermeture/changement de contexte/lecture indisponible, concurrence, résultat ancien, titre vide et reprise. Les doublures de Button/confirmDelete retirent leurs protections individuelles préexistantes ; les erreurs/doubles appels de ces tests ne prouvent donc pas à eux seuls leur absence dans l’ancienne interface réelle.

Accueil isolé par espace/membre ; ouverture et suppression revalident la lecture courante, suppression revalide aussi la présence de la date. Création montée uniquement pendant l’ouverture, avec fermeture invalidante, contexte de backend et verrou partagé entre saisie, validation et fermeture. Brouillon conservé après erreur réseau, reprise explicite de collection, Switch désactivé pendant enregistrement et nommé pour l’accessibilité. Documentation React Native 0.86 Switch lue ; refs/cleanup et diff relus selon la revue React.

Preuves : lint/TypeScript, 41 suites / 628 tests applicatifs et git diff --check réussis. Compilation fonctions et 27 tests de sécurité réussis en 18,41 s, sortie 0 et émulateurs arrêtés à 14:52, exclusivement demo-nous-deux-security. Aucun compte/contenu réel ni rappel/notification envoyé, aucun serveur/règle modifié. Pas de build, distribution, dépense, annulation atomique d’une écriture déjà partie ni essai appareil. Prochaine priorité : formulaire agenda, lecture du code confirmant l’absence de revalidation de collection dans la sauvegarde et la suppression simple ; reproduction à faire avant correctif.

## 2026-10-15, 14:58 Europe/Brussels — Formulaire agenda

Base `00fb8e6554142b17ce06a869b3c474a784992bcc`, 138 SHA texte vérifiés, autres blobs préservés. Dix-huit nouveaux tests rouges : écriture après lecture inconnue/événement retiré, saisie pendant attente, action d’un backend ressuscitée après aller-retour, suppression d’une série dont l’ancre a changé et erreurs anciennes affichées dans le nouveau contexte. Les 34 contrôles déjà présents passaient avant modification.

Sauvegarde et suppression simple revalident la collection et la présence de l’horaire ; suppression de série vérifie aussi l’identifiant de série et la date de son événement d’ancrage. Fermeture invalidante, token de contexte plutôt que seule référence backend, erreurs anciennes ignorées, champs et navigation de date partagent le verrou de l’opération. Brouillon conservé lorsque la lecture échoue, reprise explicite hors séries aussi. Revue React et diff effectués ; notification partenaire remplacée par une doublure dans tous les tests concernés, aucun envoi réel.

Preuves : TypeScript a d’abord signalé un accès possiblement indéfini à l’ancre ; garde explicite ajoutée. Lint/TypeScript finaux, 41 suites / 646 tests applicatifs et git diff --check réussis. Compilation fonctions et 27 tests sécurité réussis en 17,30 s, sortie 0 et émulateurs arrêtés, uniquement demo-nous-deux-security. Pas de changement serveur/règle, build, coût ou distribution ; concurrence multi-appareils et essais natifs restent non validés. Suite prête issue de lecture : actions/formulaire des dépenses encore sans contexte/verrou commun, à reproduire avec données fictives uniquement (aucune opération financière réelle).

## 2026-10-15, 15:01 Europe/Brussels — Formulaire de dépense

Base `4029cc350c58f9146ee8ade292e17d4a491e0e54`. Dix-neuf cas rouges ajoutés : ancien formulaire, changement d’identité/lecture, valeurs invalides, payeur absent, édition/fermeture concurrentes, résultat tardif et reprise. Les tests appellent directement les handlers et remplacent Button : la validation visuelle et le verrou individuel du bouton existaient déjà ; le correctif ajoute les contrôles au niveau de l’action et du formulaire.

Écran isolé par espace/membre ; formulaire contextualisé, champs et fermeture partageant le verrou, montant/titre/payeur vérifiés avant l’appel et payeur relu dans les membres actuels. Brouillon conservé après échec, résultat ancien sans fermeture ni vibration, reprise explicite d’une lecture en panne. Données fictives et backend/haptique doublés : aucun paiement, transfert, remboursement, ajout comptable réel ou service facturable exécuté.

Preuves : lint/TypeScript, 42 suites / 665 tests applicatifs et git diff --check réussis, diff et refs/cleanup relus. Aucun mécanisme de suppression/serveur/règle modifié dans cette tâche ; les 27 tests sécurité de 14:58 restent la dernière preuve, pas une nouvelle exécution. Pas de build, distribution ni essai physique. Suite : actions des lignes de dépenses et marque informative de remboursement, à protéger séparément sans changer les règles de calcul ni prétendre résoudre la concurrence multi-appareils.

## 2026-10-15, 15:07 Europe/Brussels — Actions des dépenses

Base `238183ff3519a32bcb8cf0f39581e9ecd2181ff2`. Dix-neuf cas rouges initiaux et un contrôle nominal ; la revue a ajouté un cas rouge de réémission/réordonnancement du même relevé et un contrôle de retour légitime à un relevé précédent. Vingt-deux tests ajoutés au total. Button et confirmDelete restent doublés : leurs gardes individuelles préexistantes ne sont pas confondues avec le verrou partagé testé ici.

Contexte backend/membres, lecture et présence relus avant suppression ; verrou commun aux actions de liste. Marque de remboursement limitée à la vue courante du relevé, non rejouée en attente d’actualisation ; token basé sur identifiants/montants/payeurs/types, stable si seuls ordre/titres changent. Une modification effective permet une nouvelle action explicite. Les erreurs anciennes et vibrations tardives sont ignorées. Ce n’est ni un paiement ni une transaction comptable atomique multi-appareils ; aucune donnée réelle n’a été lue ou modifiée.

Preuves : lint/TypeScript, 43 suites / 687 tests applicatifs et git diff --check réussis ; revue React des refs/state et diff relu. Compilation fonctions et 27 tests sécurité réussis en 18,70 s, sortie 0 et émulateurs arrêtés à 15:04, uniquement demo-nous-deux-security. Dernier ajustement limité au token client du relevé, sans modifier serveur/règles/suppression. PR #3 et consignes GitHub relues à 15:05, tête inchangée ; travail en cours poursuivi sans doubler les tâches. Limites : une réponse d’écriture ambiguë ou deux appareils peuvent encore nécessiter une idempotence serveur. Aucun build, déploiement, dépense ni distribution.

## 2026-10-15, 15:10 Europe/Brussels — Cohérence des centimes

Base `6e6f3769892d636d37323a0345530bf4ea99f76a`. Lecture du calcul puis neuf cas rouges et un contrôle : Math.round des demi-centimes négatifs ne donne pas l’opposé du positif. Exemple fictif 10,31 € payé par un membre : 5,16 € affiché d’un côté contre -5,15 € de l’autre ; une marque de 5,16 € laissait l’autre vue à 0,01 €. Certains tests échouaient d’abord sur -0, mais la divergence non nulle de l’autre vue est aussi couverte.

Calcul séparé du net des dépenses et des marques : partage net à moitié arrondi au centime en valeur absolue puis signe restauré ; remboursements entiers ajoutés ensuite. L’arrondi positif existant est préservé, le négatif devient son opposé. Les demi-centimes sont cumulés avant arrondi et l’ordre des lignes ne change pas le résultat. Aucun enregistrement, remboursement réel ni migration effectué ; uniquement calcul local sur fixtures. L’heure de l’entrée précédente est corrigée de 15:08 à 15:07 pour correspondre à la sauvegarde observée.

Preuves : lint/TypeScript, 43 suites / 697 tests applicatifs et git diff --check réussis, diff relu. Aucun serveur/règle/suppression modifié ; pas de nouveau test sécurité nécessaire pour cette fonction pure. Les clients déjà distribués gardent leur ancien calcul jusqu’à une distribution ultérieure autorisée ; aucune build, diffusion, dépense ou validation Apple. Suite : contrôle du contexte des réglages et confirmations de déconnexion, pistes issues de la lecture de Nous.

## 2026-10-15, 15:15 Europe/Brussels — Réglages contextualisés

Base `b03e77684f50da488755bb773688ba7174b82cb2`. Douze nouveaux cas rouges puis trois contrôles supplémentaires, dont un rouge découvrant un verrou de sortie qui aurait bloqué le nouveau contexte après l’échec de l’ancien. Sortie marquée par token de contexte plutôt que booléen global ; quinze tests ajoutés au total. Le handler de confirmation de sortie est testé directement et les API natives/serveur sont doublées.

Nous est isolé par espace/membre. Notifications : contexte et lecture revalidés après permission, programmation, jeton et enregistrement ; dates fraîches après permission, pas de succès tardif, erreur visible uniquement dans le contexte courant. Déconnexion : confirmation revalidée, protection du compte anonyme relue, verrou de double sortie, arrêt des étapes de notifications encore non lancées. Revue React refs/cleanup et diff ; documentation Expo SDK 57 Notifications relue. La couche de session existante possède déjà une révision pour ne pas remplacer l’interface après une autre session ; son nettoyage déjà lancé reste distinct.

Preuves : lint/TypeScript, 43 suites / 712 tests applicatifs et git diff --check réussis. Compilation fonctions et 27 tests sécurité réussis en 17,92 s, sortie 0, émulateurs arrêtés à 15:15 ; uniquement demo-nous-deux-security. Aucun jeton réel demandé, notification programmée/envoyée, compte déconnecté ou donnée réelle touchée. Ces gardes n’annulent pas atomiquement un appel natif/serveur déjà parti ; pas d’essai appareil, build, diffusion ou dépense. Dernière piste prête : verrou partagé et contexte des modifications de prénom/couleur de profil.

## 2026-10-15, 15:20 Europe/Brussels — Profil et pastilles

Base `97c0eead334b28385c5022322c3e49a04f065dfb`. Treize tests rouges initiaux sur profil/pastilles puis un rouge de synchronisation du prénom et un contrôle de préservation du brouillon ; quinze ajouts au total. Les tests de profil doublent les boutons mais ceux de ColorPicker utilisent le composant réel avec Pressable natif doublé. Les protections individuelles déjà existantes ne remplacent pas le nouveau verrou partagé.

Profil revalidé sur contexte, membre actuel et droit d’édition ; prénom/couleur/saisie coordonnés, erreur courante visible, ancienne erreur ignorée. Refus des valeurs vides, inchangées ou couleurs hors palette. ColorPicker accepte disabled sans perdre sa sélection ni son verrou interne. Un prénom reçu de l’extérieur synchronise le champ intact mais conserve une saisie modifiée ; ajustement borné du state, sans effet de synchronisation. Revue React refs/state/cleanup, diff et documentation RN 0.86 Pressable/TextInput relus.

Preuves : lint/TypeScript, 44 suites / 727 tests applicatifs, git diff --check réussis. Node 24.19.0 et Java 17.0.20 confirmés ; ce n’est pas un essai du runtime de production Node 22. Aucun serveur/règle/suppression modifié depuis les 27 tests sécurité de 15:15, aucune identité ou donnée réelle utilisée. Pas de contrôle tactile, clavier natif, lecteur d’écran, build, diffusion ou dépense. Prochaine priorité documentée : idempotence multi-clients des marques et invalidation des programmations natives déjà engagées, à reproduire avant changement.

## 2026-10-15, 15:21 Europe/Brussels — Checkpoint final et reprise

Travail continu observé depuis 14:32:39 jusqu’au contrôle de 15:20:45 : 48 min 06 s, hors cette dernière sauvegarde documentaire. Onze tâches cohérentes avec checkpoints indépendants ; aucune attente artificielle pour atteindre une heure. Clôture à une frontière de tâche proche de l’objectif de 50 minutes, contrôles finaux effectués ; les protocoles multi-clients restants méritent une nouvelle reproduction et leurs tests d’émulateurs plutôt qu’un correctif partiel. La relance reçue pendant le travail a été intégrée par une relecture de GitHub, sans réexécuter les tâches déjà sauvegardées.

Checkpoints GitHub (distincts des commits locaux de la copie texte) :

- `00e7d563e20deee0de889f1d51e42f09842b885d` : verrou DateField/rencontre, 579 tests.
- `4ec4f02a33bae835cade536177b20210edcde68c` : ouverture Android consommée une fois, 585 tests.
- `16047d541f52d998fe339d4b72e194d602c98561` : saisie date/heure web, 590 tests.
- `a73fb5c569dc55b239f462ef4bf12917126e848f` : formulaire souvenir, 608 tests.
- `00fb8e6554142b17ce06a869b3c474a784992bcc` : comptes à rebours, 628 tests.
- `4029cc350c58f9146ee8ade292e17d4a491e0e54` : formulaire agenda, 646 tests.
- `238183ff3519a32bcb8cf0f39581e9ecd2181ff2` : formulaire dépense, 665 tests.
- `6e6f3769892d636d37323a0345530bf4ea99f76a` : actions des dépenses, 687 tests.
- `b03e77684f50da488755bb773688ba7174b82cb2` : cohérence des centimes, 697 tests.
- `97c0eead334b28385c5022322c3e49a04f065dfb` : réglages et déconnexion, 712 tests.
- `ff0f8abd06d7e0aa23cd30327ced8dc66bb73d50` : prénom et couleur, 727 tests.

Contrôle final : 141 fichiers texte aux SHA identiques à GitHub, arbre local propre avant cette entrée, sept PNG toujours absents localement mais leurs blobs distants intacts depuis la base `b3cf004486b365a1c793778499a2b1d4d7e6d9e7`. Aucun workflow GitHub dans l’arbre. Seuls code client, fonction pure de calcul, tests et documentation ont changé ; serveur/règles/configuration publique inchangés. Chaque sauvegarde utilise expected_sha et force=false, aucune fusion. publicationStatus=draft et retentionVerified=false revérifiés ; fonctionnalités payantes non activées.

Résultats réels : lint et TypeScript propres, 44 suites / 727 tests applicatifs ; dernière compilation fonctions et 27 tests sécurité à 15:15, émulateurs arrêtés. Pas d’export visuel, build signée, essai natif, distribution ni nouveau statut Apple constaté. Aucune dépense, invitation, message, compte ou contenu réel touché. Aucun nouveau blocage nécessitant l’intervention du propriétaire ni incident sur des données réelles observé. Reprendre les priorités explicitement ouvertes du backlog ; ne pas confondre les protections client avec l’idempotence serveur ou la préparation effective de TestFlight.

## 2026-10-15, 15:34 Europe/Brussels — Primitive de rappels invalidables

Reprise observée à 15:31:41, PR #3 ouverte/brouillon, base c79365d1126f084566cf465c4c6877d0540be884. Consignes et dernières entrées relues via GitHub ; 141 fichiers texte locaux propres vérifiés par SHA contre l’arbre distant. Sept PNG toujours absents localement, non simulés.

Six cas rouges reproduits avec API natives doublées : demande déjà périmée, invalidation pendant permission/inventaire/annulation, seconde réponse native tardive et rejet après première création. Garde optionnelle isActive ajoutée à la primitive, sans invalider une autre génération si la demande était déjà périmée. Arrêt avant la prochaine opération et nettoyage uniquement des identifiants confirmés de sa propre demande, y compris ceux créés avant le dernier appel en attente. Un contrôle nominal ajouté ; sept tests nouveaux.

Preuves : 44 suites / 734 tests applicatifs réussis, lint/TypeScript et git diff --check propres, diff relu. Expo 57 et llms.txt relus, documentation Notifications versionnée consultée pour la création et l’annulation par identifiant. Aucun serveur/règle/mécanisme de suppression de données modifié ; pas de nouveau test sécurité dans ce checkpoint. Limites : primitive préparée, raccordement des deux consommateurs encore à réaliser ; appel natif déjà engagé non atomiquement annulable, identifiant perdu/échec d’annulation non résolu. Aucun rappel réel, compte, contenu, service facturable, build, distribution ou statut Apple consulté.

## 2026-10-15, 15:38 Europe/Brussels — Rappels liés au cycle de vie des consommateurs

Base 755ad19fb5a68ac2c5ef8d7278a2d214de832b9c. Onze tests de contrat rouges avant raccordement : garde absente dans les tâches de fond et les réglages. La tâche de fond possède désormais son nettoyage d’effet et dépend aussi du contexte backend/membre. Les réglages capturent la version des dates au départ de la programmation ; une indisponibilité puis un retour aux mêmes valeurs ne ressuscitent pas une ancienne demande. Sortie et démontage invalident également la garde. Les dates fraîches après permission restent utilisées.

Huit tests intégrés supplémentaires utilisent les vrais consommateurs et le vrai programmateur, avec seules les API natives doublées : arrêt pendant inventaire/création après démontage ou erreur de lecture. Aucun nouveau rappel laissé dans ces cas et aucun succès tardif affiché. Revue React appliquée aux dépendances et nettoyages ; un avertissement de dépendances useMemo et une faute de fermeture dans le nouveau test ont été corrigés avant validation finale.

Preuves : lint/TypeScript propres, 45 suites / 753 tests applicatifs, git diff --check et diff relu. Aucun serveur/règle/suppression de données changé ; pas de nouvel essai sécurité. Limites natives identiques au checkpoint précédent : pas d’annulation atomique d’un appel déjà envoyé, pas de preuve sur téléphone. Aucun rappel réel, build, distribution ou dépense. Prochaine reproduction : nettoyage global en attente pendant le début d’une nouvelle programmation.

## 2026-10-15, 15:41 Europe/Brussels — Ordre des nettoyages natifs

Base b6f21ceb24ff701af99e7bea705064883f83d5ac, 142 SHA texte vérifiés. Trois cas rouges reproduits : nouveaux rappels créés avant la fin d’annulation globale ou de retrait du centre de notifications, deux nettoyages concurrents. Ajout d’une file pour les nettoyages et attente de sa fin avant inventaire/création ; génération invalidée immédiatement, erreurs conservées pour l’appelant sans bloquer les futures reprises. Quatrième test nominal d’erreur/reprise ajouté. Un premier placement de l’attente avant la permission a fait expirer un ancien test ; attente déplacée après cette lecture non mutante, puis suite entière repassée.

Preuves finales : lint/TypeScript, 45 suites / 757 tests applicatifs et git diff --check propres, diff relu. Compilation fonctions et 27 tests sécurité réussis en 20,74 s, sortie 0 et émulateurs arrêtés à 15:40, exclusivement demo-nous-deux-security. Aucun serveur/règle modifié. Les effets natifs sont doublés : pas de preuve appareil, pas de notification réelle, build, diffusion ou coût. La file empêche un ancien nettoyage d’effacer une nouvelle programmation, mais ne garantit pas le succès d’un appel natif ; nettoyage après réponse sans identifiant et suppression des notifications déjà livrées restent à traiter séparément.

## 2026-10-15, 15:44 Europe/Brussels — Nettoyage partiellement en échec

Base e037aa7d16847dec08869269b9c1d26e970b1646. Trois nouveaux cas rouges : l’échec d’annulation empêchait toute tentative de retrait des notifications déjà affichées, libérait la file trop tôt et repoussait le second échec au prochain appel. Les deux opérations indépendantes sont désormais attendues avec allSettled ; première erreur transmise à l’appelant seulement après leurs résultats, puis possibilité de reprise. Aucune annulation ni notification réelle exécutée.

Preuves : lint/TypeScript, 45 suites / 760 tests applicatifs et git diff --check propres ; diff relu. Derniers 27 tests sécurité sur émulateurs à 15:40, non présentés comme réexécutés dans ce checkpoint ; serveur/règles inchangés. Limites : une API native peut toujours échouer ; clearSession conserve sa politique préexistante de ne pas bloquer la sortie pour une erreur de rappel. Pas d’essai appareil, build, déploiement, coût ni diffusion. Prochaine vérification : un arrêt anticipé du programmateur ne doit pas produire un message de réussite dans les réglages.

## 2026-10-15, 15:46 Europe/Brussels — Résultat de programmation explicite

Base 9ac7a4eabe01a1d777cb3386984085c42d03d17a. Un test intégré rouge démontre le faux message « Rappels activés » lorsque la permission est accordée à la première lecture puis retirée lors de la seconde. Cinq cas rouges supplémentaires précisent le contrat du programmateur (actif, vide, périmé, refusé et supplanté). La primitive renvoie désormais un booléen de confirmation ; les réglages arrêtent les étapes suivantes et signalent une activation interrompue si le contexte est encore courant mais la programmation n’est pas confirmée. Les erreurs natives restent des rejets, les contextes périmés restent silencieux. La doublure de réussite des tests d’écran est alignée sur ce contrat.

Preuves : lint/TypeScript, 45 suites / 766 tests applicatifs et git diff --check réussis ; diff relu avec la revue React des gardes. Dernière preuve sécurité : 27 tests à 15:40 ; aucun serveur/règle changé. Aucun appel natif réel, jeton, notification, build, diffusion ou dépense. La lecture des calculs de dates révèle une piste distincte : prochaine occurrence annuelle du 29 février pouvant produire une clé impossible ou sauter le 1er mars courant ; à reproduire avant correction.

## 2026-10-15, 15:48 Europe/Brussels — Occurrences annuelles valides

Base 1c293096d1a87a5a44d84e02358f68d41890e87d. Six échecs reproduits sur dix nouveaux cas : clés annuelles impossibles et programmation du 1er mars à 8 h sautant directement à l’année suivante. Calcul de l’occurrence normalisé avant comparaison avec aujourd’hui. Le report au 1er mars est celui déjà appliqué par Date lors de l’affichage/programmation précédents, pas une nouvelle convention ni une modification de la date enregistrée. Cas bissextiles, siècles 2100/2400 et lendemain couverts ; intégration avec notifications natives doublées.

Preuves : lint/TypeScript, 45 suites / 776 tests applicatifs, git diff --check et diff relu réussis. Fonction pure seulement, aucun serveur/règle changé, aucun nouveau test sécurité nécessaire. Pas de notification réelle ni de changement des dates stockées, aucun build, déploiement, essai natif ou dépense. Reprise du sujet prioritaire restant : marque informative de remboursement concurrente et réponse ambiguë, qui nécessitent une précondition atomique et pas seulement un verrou de bouton.

## 2026-10-15, 15:57 Europe/Brussels — Protocole serveur des marques informatives

Base 2104cf99b8778b854d9cee7a599c87b9ce25c858. Reproduction réelle sur émulateur : deux clients autorisés ajoutent chacun la même marque, trois documents au total pour une dépense initiale. Le test est conservé comme preuve de la limite des anciennes écritures directes, sans prétendre qu’elle est fermée. Huit premiers tests du nouveau protocole échouaient parce que le module n’existait pas ; ce ne sont pas huit défauts distincts de l’ancien code.

Fonction recordSettlement préparée : identité confirmée obligatoire, appartenance/lock relus dans la transaction, comparaison du relevé complet borné, calcul serveur des centimes, création atomique marque/reçu privé et compteur de sérialisation. Reprise d’une intention sans doublon, y compris après retrait ultérieur de sa marque ; réutilisation avec autre contenu refusée. Reçus sans titres ou montants, refusés aux accès clients et inclus dans le nettoyage privé existant. Fonction exportée par les deux entrées, jamais déployée. Revue d’architecture : infrastructure Firebase existante conservée, aucun service ajouté ; documentation officielle des transactions Firestore consultée.

Preuves : lint/TypeScript applicatif propres, 45 suites / 776 tests applicatifs ; compilation fonctions et 41 tests sécurité réussis en 28,49 s, sortie 0 et émulateurs arrêtés, uniquement demo-nous-deux-security. Revue du module, des exports, du diff et git diff --check. Quatorze tests sécurité ajoutés, avec assertions supplémentaires de suppression des reçus du membre sortant et conservation de ceux du partenaire. Aucun compte, contenu ou opération financière réel, aucun coût/build/distribution. Limites : client encore non raccordé, règles historiques encore permissives pour les marques directes, nouveau stockage à inventorier avant publication ; détails dans SETTLEMENT-PROTOCOL.md. Suite prête : branchement des backends et de l’écran avec intention stable et résultat serveur validé.
## 2026-10-15, 16:07 Europe/Brussels — Raccordement cloud des marques

Base cc2fbb4277e12c3c7e11771c8e869bcb16e7b969. Neuf tests d’écran rouges avant raccordement, un contrôle local nominal et trois contrôles d’identité ajoutés. Le client cloud appelle recordSettlement avec le relevé attendu et une intention stable pendant les reprises de cette vue ; titre/ordre n’en créent pas une nouvelle. Réponse validée avant succès, pas de repli direct si fonction absente, erreur ou réponse malformée. Mode local inchangé. Prérequis serveur avant nouveau client documenté dans TESTFLIGHT-REVIEW.md.

Preuves : lint/TypeScript et 45 suites / 789 tests applicatifs réussis, git diff --check et diff relu. Dernière preuve sécurité : 41 tests à 15:57 ; serveur/règles non modifiés dans cette tâche. Pas de build, déploiement, version distribuée ni validation Apple constatée. Aucune opération financière ni donnée réelle. Limites : intention en mémoire non persistée après redémarrage ; chemin direct des anciens clients encore ouvert dans les règles, prochaine tâche. Relecture GitHub : PR ouverte, tête inchangée ; pas de travail concurrent écrasé.

## 2026-10-15, 16:12 Europe/Brussels — Fermeture préparée des marques directes

Base faec2e5c78e9ef9fa14706fc67d3ee4c20aa7b58. Trois contournements rouges sur émulateur avant correction : création directe, conversion d’une dépense et altération d’une marque serveur. Les règles exigent désormais une dépense ordinaire avant et après modification ; création de marque réservée au serveur Admin. Lecture et retrait restent autorisés aux membres hors verrou de suppression. Quatre tests ajoutés, l’ancien test de reproduction transformé en régression de refus. Un quatrième échec initial provenait de la fixture de déverrouillage (null ne retire pas le champ), corrigée avec FieldValue.delete ; il ne s’agissait pas d’un défaut produit.

Preuves : compilation fonctions, 45 tests sécurité réussis en 30,45 s exclusivement sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés. Lint/TypeScript, 45 suites / 789 tests applicatifs et git diff --check réussis, diff relu. Documentation de transition ajoutée : règles non déployées, anciens clients incompatibles avec l’ajout direct après activation ; aucun basculement isolé autorisé. Les dépenses restent collaboratives et déclaratives, aucune certification de paiement. Aucun compte/contenu réel, coût, build, déploiement ni diffusion. Prochaine tâche bornée : documenter précisément le nouveau stockage privé préparé sans inventer une durée de conservation.

## 2026-10-15, 16:15 Europe/Brussels — Inventaire et fin de vie des reçus

Base 44f142af52b918157f60ac1d25e643ae095d4117. Amélioration justifiée : le protocole préparé crée un stockage privé supplémentaire qui n’était pas détaillé dans l’inventaire. FIREBASE-RETENTION.md décrit ses champs, rattachement au membre, droits, suppression individuelle/dernier départ, conservation du partenaire et absence de purge périodique. Empreinte non présentée comme anonyme ; aucune durée ni validation légale inventée. PRIVACY-RELEASE.md conserve une condition explicite avant activation, configuration publique inchangée.

Test existant de dernier départ renforcé avec reçus du dernier membre et d’un ancien membre orphelin : les deux sont réellement supprimés dans l’émulateur. Aucun mécanisme de suppression modifié. Compilation fonctions et 45 tests sécurité réussis en 24,36 s, sortie 0 et émulateurs arrêtés ; lint/TypeScript et git diff --check réussis. Dernière suite applicative complète : 789 tests à 16:10, aucun code applicatif modifié depuis. Diff relu, données exclusivement fictives. Aucune lecture/écriture de production, aucune dépense/build/distribution. Les anciennes observations de rétention cloud du 14 octobre ne sont pas présentées comme relues aujourd’hui.

## 2026-10-15, 16:18 Europe/Brussels — Contrôle final et reprise durable

Durée observée de développement et vérifications : de 15:31:41 à 16:17:06, soit 45 min 25 s avant cette sauvegarde finale. Dix tâches cohérentes avec checkpoints indépendants, sans attente artificielle ; clôture à une frontière vérifiée proche de la cible de 50 minutes. Les travaux restants sur association d’uploads et persistance des intentions exigent un nouveau protocole/reproduction, pas une extension précipitée de ce checkpoint. La relance reçue pendant le travail a été intégrée par relecture des consignes et de la tête GitHub, sans recommencer les tâches sauvegardées.

Checkpoints GitHub de cette session (SHA locaux distincts) :

- 755ad19fb5a68ac2c5ef8d7278a2d214de832b9c : primitive de rappels invalidables, 734 tests applicatifs.
- b6f21ceb24ff701af99e7bea705064883f83d5ac : consommateurs liés au cycle de vie, 753 tests.
- e037aa7d16847dec08869269b9c1d26e970b1646 : nettoyages natifs ordonnés, 757 tests.
- 9ac7a4eabe01a1d777cb3386984085c42d03d17a : tentative et attente des deux nettoyages, 760 tests.
- 1c293096d1a87a5a44d84e02358f68d41890e87d : résultat de programmation explicite, 766 tests.
- 2104cf99b8778b854d9cee7a599c87b9ce25c858 : occurrence du 29 février, 776 tests.
- cc2fbb4277e12c3c7e11771c8e869bcb16e7b969 : protocole serveur des marques, 41 tests sécurité.
- faec2e5c78e9ef9fa14706fc67d3ee4c20aa7b58 : raccordement cloud, 789 tests applicatifs.
- 44f142af52b918157f60ac1d25e643ae095d4117 : règles des marques et transition, 45 tests sécurité.
- cb0894796dce94cb06271a50b3f6c446842e4a43 : inventaire privé et nettoyage du dernier départ, 45 tests sécurité renforcés.

Intégrité : 144 fichiers texte locaux aux SHA identiques à la tête GitHub cb08947, aucun écart ; sept PNG absents de la copie locale, blobs distants inchangés depuis c79365d1126f084566cf465c4c6877d0540be884. Aucun workflow GitHub présent. Arbre local propre avant cette entrée, diff final relu (notifications, dates, client, règles, exports et serveur). PR #3 toujours ouverte en brouillon. Chaque référence a été mise à jour avec expected_sha et force=false ; aucune fusion.

Preuves finales : lint et TypeScript propres ; dernière suite complète applicative 45 suites / 789 tests à 16:10 ; compilation fonctions et 45 tests sécurité à 16:14 (24,36 s, émulateurs arrêtés), puis lint/TypeScript à 16:15. Node 24.19.0 et Java 17.0.20 vérifiés : ce n’est pas une validation du runtime de production Node 22. Aucun export visuel, build signée, téléphone, distribution ni statut Apple relu. publicationStatus=draft et retentionVerified=false vérifiés ; configuration des fonctions payantes inchangée, aucune activation ni appel externe facturable.

Aucune donnée réelle, paiement, invitation ou message à un tiers. Aucun incident réel ni nouveau blocage immédiat nécessitant l’intervention du propriétaire. Les conditions de mise en service sont explicites : conservation des reçus à décider, serveur/client/règles à coordonner, accès et absence de coût supplémentaire à prouver, essais natifs encore manquants. Reprendre une priorité gratuite du backlog (association d’uploads ou audit ciblé) ; ne pas présenter le code préparé comme distribué, ni la règle locale comme déjà active en production.

## 2026-10-15, 16:38 Europe/Brussels — Relecture après écriture locale ambiguë

Reprise à 16:33:58, PR #3 ouverte/brouillon, base fca6ae711a48782de8895fad4d4f90ea67896d07. Consignes et journal relus via GitHub ; 144 fichiers texte vérifiés par SHA, copie locale propre, sept images absentes non simulées. La règle multi-tâches est déjà cohérente dans AUTONOMY.md ; aucune réécriture nécessaire.

Quatre cas rouges avec stockage doublé qui enregistre puis rejette : perte d’un ajout, résurrection d’une suppression, ancien profil restauré et écriture malgré relecture impossible. Invalidation du cache de la clé après rejet ; version de lecture par clé pour empêcher une lecture antérieure de repeupler ce cache. Deux contrôles supplémentaires couvrent lecture retardée et indépendance des collections. Aucun contenu réel lu ni stockage utilisateur manipulé.

Preuves : lint/TypeScript, 45 suites / 795 tests applicatifs, diff relu et git diff --check propres. Les tests simulent une réponse ambiguë ; ils ne prétendent pas reproduire une panne matérielle sur téléphone. Serveur/règles inchangés. Limites : pas encore de signal d’erreur aux abonnés ayant déjà reçu leur valeur, pas d’idempotence des ajouts répétés, pas de verrou inter-processus. Aucun build/déploiement/distribution/coût. Suite bornée : disponibilité des écrans après rejet d’écriture.

## 2026-10-15, 16:41 Europe/Brussels — Vue locale indisponible après rejet

Base 5ea881fe0a31bd95670ed1f85a0adb95b9f368ef. Quatre tests rouges : les abonnés déjà chargés n’étaient pas informés du résultat incertain. Les abonnements locaux ont désormais un canal d’erreur terminal, avec reprise par nouvel abonnement ; les vues existantes utilisent déjà ce contrat pour bloquer leurs actions et proposer Réessayer. Un cinquième contrôle vérifie qu’une reprise créée pendant la notification ne reçoit pas l’erreur ancienne. Notification limitée aux abonnés présents, arrêt après désabonnement, erreur d’un gestionnaire isolée sans masquer celle du stockage.

Preuves : lint/TypeScript, 45 suites / 800 tests applicatifs, diff relu et git diff --check. Contrôle sécurité réalisé pendant la tâche précédente : compilation fonctions et 45 tests réussis en 26,06 s à 16:37, émulateurs demo-nous-deux-security arrêtés ; aucun serveur/règle changé ici. Tests locaux sur doublures uniquement. Pas de build, diffusion, données réelles ni dépense. Limites : reprise d’ajout toujours non idempotente ; une erreur dans un callback de données doit encore être isolée pour éviter de transformer une écriture réussie en échec apparent.

## 2026-10-15, 16:44 Europe/Brussels — Isolation des abonnés et intégration de reprise

Base ee2fc5624aed2eeaa88cd68cfe578b0b788330df. Le test du callback initial défaillant arrête réellement le processus Jest avec un rejet non géré avant correction. Un callback de données est désormais isolé et son abonnement mis en erreur ; il ne change pas le résultat du stockage déjà confirmé et ne bloque pas les autres abonnés. Trois tests ajoutés sur ces cas, puis trois intégrations utilisant les vrais CoupleProvider/useCollectionState/backend local : écriture ambiguë, refus sans écriture, profil enregistré mais confirmation perdue. Seuls stockage et services natifs/cloud sont doublés ; pas de rendu sur appareil.

Preuves : lint/TypeScript, 46 suites / 806 tests applicatifs, diff relu et git diff --check propres. Dernière preuve sécurité inchangée : 45 tests à 16:37 ; serveur/règles non modifiés. Aucune donnée réelle, dépense, build ou distribution. Une panne d’un consommateur reste signalée à son canal d’erreur ; elle n’est pas transformée en invitation à rejouer l’écriture. L’audit suivant porte sur la disponibilité de l’album pendant un sélecteur/upload en attente.

## 2026-10-15, 16:48 Europe/Brussels — Ajout photo lié à la disponibilité de l’album

Base 58ad5908cedc9bfaf2d49a4429e48594f1648896. Quatre cas rouges : ancien bouton, sélecteur ou upload poursuivant après indisponibilité, succès tardif après écriture. useAddMemory reçoit la disponibilité connue par chaque consommateur ; contexte invalidé lors du changement et jamais ressuscité après reprise. Progression et verrou associés à ce contexte, sans nouvel abonnement réseau. Quatre tests supplémentaires utilisent les vrais boutons des deux écrans avec galerie doublée.

Revue React appliquée aux dépendances primitives, refs et nettoyages ; documentation Expo 57/llms.txt et pages ImagePicker/ImageManipulator relues avant le travail photo. Preuves : lint/TypeScript et 46 suites / 814 tests applicatifs, diff relu et git diff --check. Aucun serveur/règle changé ; preuve sécurité précédente 45 tests à 16:37. Aucun sélecteur, upload ou donnée réelle. Limites : une écriture déjà envoyée n’est pas annulée ; fichier déjà envoyé non effacé car son association peut être ambiguë. Aucune build, distribution ou dépense.

## 2026-10-15, 16:50 Europe/Brussels — Message honnête après création de souvenir ambiguë

Base d68793ddb409ba9b9f4c23fd94227a3b96997e90. Un test rouge reproduit « Photo non enregistrée » après rejet d’une création déjà envoyée, sans preuve de son absence. Le message distingue désormais préparation/envoi de fichier et confirmation de la création : « Enregistrement non confirmé », invitation à vérifier l’album actualisé avant de répéter. Ni reprise automatique ni suppression compensatoire ajoutée.

Preuves : lint/TypeScript, 46 suites / 815 tests applicatifs, diff relu et git diff --check. Serveur/règles inchangés, derniers tests sécurité à 16:37. Le message ne résout pas l’idempotence ni les fichiers orphelins et ne prétend pas le faire. Aucun upload, compte, contenu réel, build, déploiement ou coût.

## 2026-10-15, 16:52 Europe/Brussels — Portraits bornés sur le grand côté

Base 6594e1388912d4887ff86d8ec89f5c5141791dec. Trois régressions reproduites avec API d’image doublées : portrait 1000×10000 non réduit, portrait 3000×4000 réduit sur le mauvais axe et même défaut via caméra. Le sélecteur réduit désormais le grand côté connu à 1600, avec un seul axe fourni pour préserver le ratio natif ; aucune augmentation des petits formats. Douze tests nouveaux incluent paysage/carré, métadonnées nulles, annulation, refus caméra, base64 facultatif, erreur de rendu et seuil compact existant. Un matcher Jest non disponible a été corrigé avant la reproduction probante : 3 échecs comportementaux et 9 succès.

Documentation officielle Expo 57 ImagePicker/ImageManipulator consultée : dimensions parfois nulles (0), resize sur un seul axe conserve le ratio ; types installés relus. Preuves : lint/TypeScript, 47 suites / 827 tests applicatifs, git diff --check et diff relu. Ces contrôles ne produisent aucune image réelle ni preuve visuelle/native. Limite connue : métadonnées inconnues non bornées par ce correctif ; repli compact encore fondé sur la largeur. Aucun changement serveur, donnée réelle, service payant, build ou diffusion.

## 2026-10-15, 16:56 Europe/Brussels — Dimensions décodées et compression compacte

Base 91edb13d31c68aabb081ac39caeac35520ee0274. Huit tests rouges puis verts : métadonnées absentes, portrait compact, petit format agrandi, trois essais sur le grand côté et quatre dimensions décodées invalides. La préparation revalide les dimensions après décodage ; le repli réutilise la référence source décodée et borne le grand côté à 900/700/500 sans agrandir. Seuil strict de 600000 caractères et compressions inchangés, aucune reprise automatique d’écriture.

Types installés et documentation Expo 57 consultés : manipulate accepte une référence d’image, renderAsync expose largeur/hauteur. Preuves : lint/TypeScript, 47 suites / 835 tests applicatifs (7,81 s), diff relu et git diff --check. Tests d’API doublées uniquement : aucune image réelle, mesure de mémoire, qualité visuelle ou exécution native. Serveur/règles inchangés, dernière preuve sécurité 45 tests à 16:37. Aucun build, déploiement, coût ni donnée réelle.

## 2026-10-15, 16:59 Europe/Brussels — Libération des blobs natifs

Base aca5a635f33a1ada4ae26d4b75e3ff717c7f81cb. Six tests rouges : absence de close après succès, erreurs d’envoi/URL, changement de compte, repli et nettoyage défaillant. Un finally libère le blob après utilisation ; close facultatif pour le web, exception de nettoyage isolée pour préserver le résultat de l’opération. Deux contrôles supplémentaires couvrent web et priorité de l’erreur d’identité.

Documentation React Native 0.86 Networking/Blob consultée et source installée Blob.js relue (libération explicite). Preuves : lint/TypeScript, 47 suites / 843 tests (7,18 s), git diff --check et diff relu. Pas de mesure mémoire ou upload réel : le test prouve l’appel au nettoyage, pas une baisse quantifiée de mémoire. Aucun fichier distant supprimé ; aucune règle, fonction serveur, donnée réelle, build ou dépense. Lecture XHR interrompue/expirée à examiner ensuite.

## 2026-10-15, 17:02 Europe/Brussels — Lecture photo bornée et réponse vérifiée

Base cd3f8bd4e56a418061405b881d8749919d3edf20. Huit cas rouges : annulation/expiration laissant la promesse pendante, délai infini, statuts HTTP 404/500, taille nulle/non finie et absence de blob transmis à l’upload. Gestion des trois événements d’échec, délai de lecture de 60 secondes et validation de réponse avant envoi ; blob inutilisable libéré. Statut 0 conservé pour les URI locales, contrôle nominal et événement error inclus.

Documentation RN 0.86 Networking/XMLHttpRequest et source installée vérifiées : timeout par défaut à zéro, événements timeout et abort distincts de error. Preuves : lint/TypeScript, 47 suites / 853 tests (7,20 s), diff relu et git diff --check. Les événements sont simulés, aucun délai réel ou transfert natif mesuré. Ce délai concerne seulement la lecture avant upload : aucune annulation ou compensation d’écriture distante prétendue. Serveur/règles inchangés, aucun service facturable, donnée réelle ou diffusion.

## 2026-10-15, 17:07 Europe/Brussels — Brouillon souvenir et champs reçus

Base 83a1af9f78784a19a59388cb2dbdc1b62bc41a63. Cinq régressions rouges : date/légende du partenaire ignorées, écriture d’une fiche intacte écrasant les valeurs reçues, ancien bouton envoyant l’ancien brouillon et dernier contenu reçu perdu à l’affichage après erreur. Synchronisation par champ intact, conservation de chaque saisie, patch limité aux champs modifiés et action relisant le brouillon courant. Ajustement de quatre scénarios existants pour saisir avant de vérifier une mutation, puisque la fiche intacte n’écrit plus. Trois contrôles supplémentaires : espaces pendant la frappe, deux champs saisis, confirmation tardive après rejet ambigu.

Preuves : lint/TypeScript, 47 suites / 861 tests (7,30 s), diff relu et git diff --check. Revue React : ajustement d’état borné aux changements externes, dépendances et invalidation de contexte conservées. La consigne reçue pendant la tâche a été intégrée sans redémarrer le travail : PR ouverte/brouillon et quatre fichiers de reprise relus via GitHub, tête inchangée. Limite : ce patch évite d’écrire les champs intacts mais ne résout pas les éditions simultanées du même champ ni les modifications après la dernière lecture. Aucun essai multi-téléphones réel, build, déploiement, dépense ou donnée réelle.

## 2026-10-15, 17:11 Europe/Brussels — Actions accessibles des souvenirs

Base 8abac2d720941dd9d3641d34840abf9e4b49bd31. Six tests rouges après correction du sélecteur de test Pressable : quatre miniatures sans rôle explicite, ajout sans état accessible, carte nommée ignorant le libellé. Miniatures avec date complète/légende et indication d’action ; ajout expose busy/disabled ; carte anniversaire utilise les nouveaux libellés facultatifs de Card. Les cartes composites non nommées ne reçoivent pas de rôle global afin de ne pas modifier leur navigation imbriquée à l’aveugle.

Documentation officielle RN 0.86 Accessibility relue. Grille react-best-practices appliquée aux trois composants TSX et règle d’état dérivé relue : aucune souscription réseau, effet ou dépendance ajouté pour ces libellés. Preuves : lint/TypeScript, 47 suites / 867 tests (7,84 s), diff et git diff --check propres. Ces tests vérifient les propriétés, pas les annonces natives ou la navigation VoiceOver/TalkBack. Aucun rendu visuel, build, diffusion, dépense ou contenu réel.

## 2026-10-15, 17:15 Europe/Brussels — Champs reçus des listes

Base be7aacbc2b138fab4e0b3d05ecbfb1712bfddd3e. Six tests rouges : détail/titre/type reçus ignorés, fiche intacte réécrite et ancien bouton en création/édition. Brouillon par champ, synchronisation bornée et patch minimal ; aucun statut coché, propriétaire, date de création ou catégorie renvoyé lors de l’édition. Cadeaux filtrés par propriétaire avant toute synchronisation. Les scénarios de verrou existants saisissent désormais avant de vérifier une mutation ; le test film/série vérifie une vraie modification. Quatre contrôles ajoutés : courses, cadeaux, changement de propriétaire et conservation lors d’erreur/espaces.

Une erreur TypeScript sur le rétrécissement de l’union Gift/ListItem a été observée puis corrigée par lecture explicite de media, avant validation. Preuves finales : lint/TypeScript, 47 suites / 877 tests (7,37 s), diff relu et git diff --check. Revue React conforme au modèle du souvenir, pas d’effet supplémentaire de synchronisation. Les contrôles sont simulés, sans contenu privé réel ; pas de verrou serveur de conflit sur un même champ. Serveur/règles inchangés. Aucun build, déploiement ou coût.

## 2026-10-15, 17:19 Europe/Brussels — Patches partiels vérifiés sur émulateurs

Base da7396149875eefb20a565ae07765a4c7d2176c9. Amélioration de preuve justifiée : les nouveaux formulaires envoient des patches minimaux, tandis que les anciens contrôles de règles ne vérifiaient que le statut coché pour ces listes. Trois tests ajoutés utilisent de vrais updateDoc/getDoc sur l’émulateur : conservation des champs complémentaires de souvenir, trois catégories de listes et confidentialité des cadeaux. Refus vérifié pour tiers et usurpation d’auteur ; aucune règle ni logique serveur changée. Ce sont des contrôles de compatibilité, pas trois bugs serveur prétendument corrigés.

Compilation fonctions et 48 tests sécurité réussis en 25,62 s, sortie 0, émulateurs demo-nous-deux-security arrêtés. Lint/TypeScript et git diff --check propres ; dernière suite applicative 47 suites / 877 tests à 17:15, aucun code applicatif changé depuis. Diff relu. Checklist native des photos, pertes de contexte, éditions partagées et accessibilité ajoutée à TESTFLIGHT-REVIEW.md : essais explicitement non réalisés, coût/accès à vérifier avant build. Aucun compte, image ou fichier réel utilisé, aucun envoi externe, déploiement ou dépense.

## 2026-10-15, 17:21 Europe/Brussels — Clôture vérifiée et reprise

Durée observée de travail et contrôles : de 16:33:58 à 17:20:05, soit 46 min 07 s avant cette consignation finale. Treize tâches successives avec checkpoints indépendants ; clôture sur un ensemble vérifié proche de la cible approximative de 50 minutes. Aucune attente destinée à allonger la durée, aucune heure entière revendiquée. La relance reçue pendant le travail a été intégrée en relisant les consignes et la tête distante, sans recommencer les tâches.

Checkpoints GitHub de cette session (distincts des SHA locaux) :

- 5ea881fe0a31bd95670ed1f85a0adb95b9f368ef : cache local après rejet ambigu, 795 tests applicatifs.
- ee2fc5624aed2eeaa88cd68cfe578b0b788330df : abonnés locaux mis en erreur, 800 tests.
- 58ad5908cedc9bfaf2d49a4429e48594f1648896 : isolation des observateurs et intégrations React, 806 tests.
- d68793ddb409ba9b9f4c23fd94227a3b96997e90 : disponibilité de l’album pendant l’ajout, 814 tests.
- 6594e1388912d4887ff86d8ec89f5c5141791dec : confirmation ambiguë du souvenir, 815 tests.
- 91edb13d31c68aabb081ac39caeac35520ee0274 : portraits sur leur grand côté, 827 tests.
- aca5a635f33a1ada4ae26d4b75e3ff717c7f81cb : dimensions décodées et repli compact, 835 tests.
- cd3f8bd4e56a418061405b881d8749919d3edf20 : libération des blobs natifs, 843 tests.
- 83a1af9f78784a19a59388cb2dbdc1b62bc41a63 : lecture XHR terminée et contrôlée, 853 tests.
- 8abac2d720941dd9d3641d34840abf9e4b49bd31 : champs intacts du souvenir, 861 tests.
- be7aacbc2b138fab4e0b3d05ecbfb1712bfddd3e : accessibilité des actions photo, 867 tests.
- da7396149875eefb20a565ae07765a4c7d2176c9 : champs intacts des listes, 877 tests.
- 8352e00c9d4d22fdbdf84c3f14479a7f611150b4 : patches partiels vérifiés, 48 tests sécurité.

Intégrité finale : les SHA des 146 fichiers texte locaux correspondent tous à la tête 8352e00, sans écart ; les sept PNG absents de la copie locale sont inchangés dans GitHub depuis fca6ae711a48782de8895fad4d4f90ea67896d07. Aucun workflow GitHub présent. Arbre local propre avant cette entrée, diff cumulé relu. PR #3 ouverte/brouillon ; toutes les références mises à jour avec expected_sha et force=false. Aucune fusion, aucune écriture d’une autre session écrasée.

Preuves finales : 47 suites / 877 tests applicatifs, lint et TypeScript à 17:15 ; lint/TypeScript puis compilation fonctions et 48 tests sécurité à 17:19, émulateurs arrêtés. Node 24.19.0 et Java 17.0.20 vérifiés ; runtime de production Node 22 non validé ici. Pas d’export visuel, de compilation native signée, d’iPhone/Android réel, de distribution ou de statut Apple relu. publicationStatus=draft et retentionVerified=false confirmés ; configuration des fonctions payantes inchangée, aucune activation ni appel facturable.

Suite prête : audit des champs intacts des formulaires restaurant/agenda, puis protocole d’association idempotente des uploads. Ne pas extrapoler la protection des champs intacts à la résolution serveur de conflits sur un même champ. Les limites d’idempotence, d’orphelins, d’essais natifs et de conservation restent explicites dans le backlog. Aucun incident réel ni nouveau blocage nécessitant l’intervention du propriétaire ; aucune donnée réelle, opération financière, invitation ou message à un tiers.

## 2026-10-15, 17:41 Europe/Brussels — Champs intacts des restaurants

Reprise à 17:34:02, PR #3 ouverte/brouillon, base b5aef519b8b90dcb670ad74e79a1359b1529308e. Consignes/journal relus via GitHub, 146 fichiers texte vérifiés par SHA, arbre local propre ; sept PNG absents non simulés. Six tests rouges reproduisent les valeurs reçues ignorées, les champs intacts renvoyés et le bouton ancien utilisant un brouillon périmé. Fiche synchronisée par champ, patch minimal et absence de mutation si inchangée. Hook useSharedDraft extrait pour l’agenda suivant ; cinq contrôles couvrent espaces, saisies concurrentes, confirmation reçue, erreur de lecture et effacement explicite.

Les tests de verrou ont été ajustés pour effectuer une vraie saisie avant sauvegarde. Une erreur de lint dans le harnais de test (affectation globale au rendu) a été corrigée par publication en effet. Preuves finales : lint, TypeScript, 48 suites / 888 tests applicatifs ; diff relu et git diff --check. Grille react-best-practices appliquée : synchronisation bornée au rendu, mises à jour fonctionnelles, aucune souscription ajoutée. Aucune API native modifiée. Serveur/règles inchangés ; dernière preuve sécurité précédente 48 tests à 17:19. Tests fictifs, aucun appel Places, build, déploiement, distribution, contenu réel ni coût. Limite : pas de résolution serveur de conflit sur un même champ. Suite : formulaire agenda et compatibilité des patches sur émulateurs.

## 2026-10-15, 17:44 Europe/Brussels — Champs reçus et anciennes actions de l’agenda

Base 16e48f8419da4581e4ba7570517e8b90ad8cbfed. Six régressions rouges puis vertes : champs reçus ignorés, réécriture intacte, ancien bouton utilisant titre/heures/répétition périmés, intervalle devenu invalide encore envoyé et flèches de jour ancrées à une date ancienne. Réutilisation du hook de brouillon ; patch limité aux six champs éditables, auteur et série préservés. Validation relue dans l’action, changements de jour fonctionnels cumulables. Les tests de verrou et erreurs tardives saisissent désormais réellement avant sauvegarde, sans retirer leurs assertions de sécurité.

Preuves : lint, TypeScript, 48 suites / 894 tests applicatifs (7,44 s), diff relu et git diff --check. Le contrôle des ancres de suppression de série reste inchangé ; aucune suppression réelle. React : dépendances complètes et aucune nouvelle souscription. Serveur/règles inchangés, dernière preuve sécurité 48 tests à 17:19. Aucun service facturable, notification réelle (doublée dans les tests), build, diffusion ou statut Apple relu. Limites : conflit sur un même champ non arbitré ; les valeurs invalides ou membres retirés sont la prochaine piste de validation à reproduire.

## 2026-10-15, 17:46 Europe/Brussels — Compatibilité des patches restaurant et agenda

Base 6abbb3e80cba5347ed5b91663c4264629ab54b7d. Deux tests de compatibilité ajoutés : patches complémentaires par Alice/Bob fictifs, puis lecture complète confirmant les métadonnées, l’auteur, la série et les champs non modifiés. Retrait de note accepté ; tiers, usurpation et intervalle horaire invalide refusés. Aucune modification de règle ni de serveur, aucun défaut serveur prétendu.

Preuves : compilation fonctions et 50 tests sécurité réussis en 28,28 s sur demo-nous-deux-security, sortie 0 et émulateurs arrêtés. Lint/TypeScript et git diff --check propres, diff relu. Dernière suite applicative : 894 tests à 17:44, aucun code applicatif changé depuis. Aucun compte réel, notification, suppression réelle, build, déploiement, distribution ou dépense. Ces tests ne constituent pas un essai multi-téléphones.

## 2026-10-15, 17:49 Europe/Brussels — Réattribuer un horaire après départ d’un membre

Base 71497cf7d2c288b7911728f365720535818b40ef. Deux tests rouges reproduisent un bouton actif après retrait du membre sélectionné en création et édition. Le formulaire vérifie désormais les membres courants au rendu et dans l’action, y compris depuis un ancien bouton. Message explicite et saisie conservée ; remplacement par un membre présent permet l’enregistrement. Contrôle supplémentaire du choix Nous deux, toujours accepté conformément aux règles existantes.

Preuves : lint, TypeScript, 48 suites / 897 tests applicatifs (7,41 s), diff relu et git diff --check. Sécurité : 50 tests sur émulateurs à 17:46 ; règles inchangées. Aucun départ réel, accès à du contenu réel, notification réelle, build, déploiement ou dépense. Limite : contrôle client avant envoi, pas d’annulation d’une écriture déjà engagée ni de garantie transactionnelle avec un départ ultérieur.

## 2026-10-15, 17:53 Europe/Brussels — Ouverture cartographique refusée

Base 1ed0dd608408e81ad537c7e77dcc7b91760df875. Cinq tests rouges reproduisent le rejet de Linking.openURL propagé sans traitement, immédiat et après changement de contexte. Le rejet est maintenant absorbé, avec un message seulement si la fiche et sa destination sont encore courantes. Deux contrôles ajoutés pour destination modifiée et nouvelle tentative réussie. Les URL restent limitées par restaurantMapUrl, aucune ouverture réelle.

Documentation Expo 57, llms.txt et React Native 0.86 Linking relue (https://reactnative.dev/docs/0.86/linking) : rejet possible si annulation ou application indisponible. Inspection Haptics sans changement : l’API installée est déjà async et son rejet est absorbé ; aucun défaut synchrone artificiel ajouté. Preuves : lint/TypeScript, suite complète 48 suites / 902 tests puis 46 tests restaurant couvrant les deux contrôles supplémentaires, git diff --check et diff relu. Serveur/règles inchangés, derniers 50 tests sécurité à 17:46. Aucun service facturable, données réelles, build, déploiement ou distribution.

## 2026-10-15, 18:06 Europe/Brussels — Association de souvenirs préparée, non activée

Base 16625a5cc0bc6f7266dd28936b1b2720ad3532d4. Défaut d’usage déjà établi : upload puis création aléatoire, une réponse perdue ne permet pas de rejouer sans risque de doublon. Nouveau module functions/src/memories.ts volontairement absent des exports index.ts et sans appelant actif : reçu privé et souvenir atomiques dans Firestore, contenu normalisé lié à la clé, reprise sans réécriture ni recréation après retrait. URL Storage limitée au bucket/chemin du demandeur, métadonnées vérifiées ; aucune récupération d’URL arbitraire. Quota existant réutilisé. Aucun nouveau service ni dépendance, architecture Firebase conservée après lecture du guide backend et documentation officielle transactions/Storage.

Treize tests ajoutés : cinq appels concurrents, répétition après édition/retrait, conflit de clé, identité/appartenance/verrou, reçus privés, schéma/quota, changement de membre entre contrôles, référence et métadonnées de fichier. Suppression du compte étendue aux reçus, partenaire conservé et orphelins privés nettoyés au dernier départ. Tous les fichiers sont des octets fictifs sur demo-nous-deux-security. Le test de frontière a révélé une erreur dans le nouveau schéma (préfixe inclus dans la borne de 600000), corrigée avant commit : 599996 caractères base64 + préfixe acceptés, 600000 refusés, comme le client existant. Cette erreur de préparation n’a pas été distribuée.

Preuves finales : compilation fonctions et 63 tests sécurité réussis en 30,34 s, script sortie 0, émulateurs arrêtés ; 48 suites / 904 tests applicatifs, lint/TypeScript à 17:59, aucun code applicatif changé depuis. Diff relu et git diff --check. Node 24.19.0 et Java 17.0.20, pas de validation runtime production Node 22. MEMORY-PROTOCOL.md et inventaire de conservation précisent : pas de durée inventée, pas de purge périodique de reçus, pas de transaction Storage/Firestore ni de nettoyage compensatoire. Les créations directes historiques restent possibles. Aucun export visuel, build, déploiement, diffusion, coût ou statut Apple relu ; flags publics/payants inchangés. Suite : préparation client non raccordée, conservation et transition avant toute activation.

## 2026-10-15, 18:11 Europe/Brussels — Intention client stable, sans raccordement

Base b96fd8659192b2684ca01d68b94fefae1e2888c8. Préparation du contrat manquant pour reprendre une association après réponse perdue : contrôleur pur séparé, sans import depuis les écrans et sans activation. Une intention copie photo/légende/date/clé, conserve son payload normalisé malgré les mutations du brouillon/adaptateur, partage sa promesse en vol et exige une nouvelle action explicite après échec. Les réponses invalides ne deviennent pas un succès ; seul le reçu est confirmé, sans prétendre que la fiche existe encore. Les erreurs brutes ne sont pas retournées. Identité/espace/mode recontrôlés, invalidation définitive et résultat tardif ignoré ; mode local refusé sans mutation.

29 nouveaux tests de contrat, tous fictifs, dont réponse perdue puis reprise, double appel, huit réponses invalides, erreur synchrone, indisponibilité de l’album, cinq invalidations avant envoi et réponses tardives. Les intitulés des cas de taille ont été raccourcis pour ne pas imprimer leur longue chaîne fictive. Preuves : lint/TypeScript, 49 suites / 933 tests applicatifs en 6,86 s, git diff --check et code relu. Dernière sécurité : 63 tests à 18:06 ; serveur/règles inchangés pour cette tâche.

Limites explicites : génération de clé, persistance et raccordement UI non réalisés ; l’appelant doit invalider au démontage/changement de contexte, y compris les aller-retours invisibles entre deux observations. Rien ne relance un upload ni ne crée une fiche aléatoire. Aucun test téléphone/transport réel, aucun build, déploiement, contenu réel ni coût. La relance reçue pendant le travail a été intégrée après relecture GitHub des quatre consignes/journal et vérification de la tête b96fd86, sans recommencer les tâches terminées.

## 2026-10-15, 18:14 Europe/Brussels — Contrat souvenir vérifié sur émulateurs

Base 24c9afb842f0ea7f482216d84e033381dbbcce77. Quatre tests de contrat relient le vrai contrôleur client (transpilation du fichier source, pas réimplémentation) au module serveur via un adaptateur contrôlé appelant run(). Réponse perdue après commit puis modification par le partenaire : reprise même clé, un document et légende préservée. Confirmation invalide puis retrait : reçu retrouvé sans recréation. Deux instances partageant la clé : un seul souvenir. Invalidation après commit : résultat obsolète ignoré sans prétendre annuler une écriture terminée.

Preuves : compilation fonctions, 67 tests sécurité en 35,33 s, sortie 0 et émulateurs demo-nous-deux-security arrêtés ; lint/TypeScript, git diff --check et diff relu. Dernière suite applicative : 49 suites / 933 tests à 18:10, aucun code applicatif changé. Contrôleur et endpoint toujours non raccordés/non exposés. Pas de transport HTTPS Callable, jeton réel, photo mobile, build native, déploiement ni dépense. Prochaine tâche réalisable repérée dans le code existant : vérifier les anciennes actions de création de dépense qui capturent encore les champs du rendu initial.

## 2026-10-15, 18:17 Europe/Brussels — Création de dépense et brouillon courant

Base 7409d4d1d6c54c4678fdd02b1e392f817de07b3b. Cinq tests rouges : ancienne action envoyant montant/payeur/titre périmés, contournant trois validations devenues invalides, ou restant bloquée après une saisie devenue valide. L’action relit les champs via la référence courante déjà utilisée pour le contexte, puis valide et arrondit le montant courant. Verrou de mutation, fermeture et protection du compte conservés ; aucun nouvel effet ni abonnement, dépendances complètes.

Preuves : lint/TypeScript, 49 suites / 938 tests en 7,94 s, diff relu et git diff --check. Dernière sécurité : 67 tests à 18:14, serveur/règles inchangés. Ces tests saisissent des montants fictifs dans un backend doublé ; aucun paiement, transfert, compte réel ni opération financière. Pas de création ordinaire idempotente après réponse perdue, pas de validation clavier native ou de distribution. Aucun coût ni déploiement.

## 2026-10-15, 18:18 Europe/Brussels — Ajout de date depuis une action ancienne

Base f5f90c56649ba9504653010e7388526e57b9b14b. Trois tests rouges puis verts : titre/date/répétition périmés, titre vidé encore enregistré et action ancienne restant bloquée après saisie valide. La référence courante contient désormais les trois valeurs et la sauvegarde les relit ; fermeture, lecture et verrou immédiat inchangés.

Preuves : lint/TypeScript, 49 suites / 941 tests en 8,15 s, git diff --check et diff relu. Revue react-best-practices appliquée aux deux formulaires ; règle advanced-use-latest lue, mécanisme de référence existant conservé pour ces actions d’interface, sans détourner useEffectEvent hors d’un effet. Pas de nouvelle souscription, d’effet de synchronisation du brouillon, de changement visuel ou natif. Dernière sécurité : 67 tests à 18:14 ; serveur/règles inchangés. Aucun rappel réel, données réelles, build, déploiement, distribution ou coût.

## 2026-10-15, 18:20 Europe/Brussels — Clôture et intégrité de dix checkpoints

Durée observée du travail et des contrôles avant cette entrée : 17:34:02 → 18:20:11, soit 46 min 09 s. Dix tâches cohérentes sauvegardées indépendamment, puis contrôle d’intégrité ; clôture proche de la cible approximative de 50 minutes, sans attente artificielle ni heure entière revendiquée. La relance reçue pendant le travail a été intégrée sans dupliquer les tâches. Les horodatages de tâches sont consignés à la minute ; les durées de tests viennent de leurs sorties.

Checkpoints GitHub (SHA distants, distincts des commits locaux de la copie texte) :

- 16e48f8419da4581e4ba7570517e8b90ad8cbfed : champs intacts restaurant et hook partagé, 888 tests applicatifs.
- 6abbb3e80cba5347ed5b91663c4264629ab54b7d : champs/actions courants agenda, 894 tests.
- 71497cf7d2c288b7911728f365720535818b40ef : patches restaurant/agenda, 50 tests sécurité.
- 1ed0dd608408e81ad537c7e77dcc7b91760df875 : membre retiré de l’agenda, 897 tests applicatifs.
- 16625a5cc0bc6f7266dd28936b1b2720ad3532d4 : refus d’ouverture cartographique, 904 tests confirmés par la suite complète suivante.
- b96fd8659192b2684ca01d68b94fefae1e2888c8 : association souvenir serveur non exposée, 63 tests sécurité.
- 24c9afb842f0ea7f482216d84e033381dbbcce77 : intention client stable non raccordée, 933 tests applicatifs.
- 7409d4d1d6c54c4678fdd02b1e392f817de07b3b : contrat client/serveur sur émulateurs, 67 tests sécurité.
- f5f90c56649ba9504653010e7388526e57b9b14b : anciennes actions de dépense, 938 tests applicatifs.
- 2708d6ad1737157fd944e4eb71ca91a93f8d320a : anciennes actions de date, 941 tests applicatifs.

La première création d’arbre du dernier checkpoint a échoué sans fournir de SHA au helper, avant création de commit ou mise à jour de référence. Relecture : PR toujours ouverte/brouillon et tête attendue f5f90c5 intacte. Une nouvelle tentative a réussi ; CAS expected_sha=f5f90c5 et force=false confirmé. Cause initiale non déterminée ; aucune perte ni référence forcée, pas de nouveau blocage persistant.

Intégrité vérifiée à 18:20 : les 152 fichiers texte suivis ont tous le SHA de la tête 2708d6a ; sept PNG absents localement restent identiques à l’arbre initial b5aef519b8b90dcb670ad74e79a1359b1529308e. Arbre local propre avant cette entrée, aucun workflow GitHub présent. Diff cumulé sans erreur d’espacement ; fonctions/index, règles Firestore/Storage, configuration EAS/app, flags de services et informations publiques inchangés. publicationStatus=draft et retentionVerified=false confirmés. Aucune image factice, aucun export visuel ou essai natif prétendu.

Preuves finales : lint/TypeScript et 49 suites / 941 tests applicatifs à 18:18 ; compilation fonctions et 67 tests sécurité à 18:14, émulateurs arrêtés, aucun code serveur changé ensuite. Les modules souvenir sont préparés mais non activés, aucun écran raccordé ; aucun déploiement, build signée, distribution TestFlight ou statut Apple relu. Aucun contenu intime, compte réel, suppression réelle, envoi à un tiers ni opération financière.

Suite prête : préparer le raccordement de reprise des souvenirs avec une stratégie explicite de clé et de persistance, sans l’activer avant conservation/transition et coût vérifiés ; auditer les anciennes actions des autres formulaires encore non couverts. Limites maintenues : créations ordinaires non idempotentes, pas de compensation des uploads orphelins, pas de résolution serveur des conflits sur un même champ, essais multi-appareils/visuels/natifs restant à réaliser. Aucun nouveau blocage nécessitant le propriétaire ni incident réel découvert.

## 2026-10-20, 13:19 Europe/Brussels — Envoi de la question du jour

Reprise à 13:14 : PR #3 ouverte/brouillon, tête 56095a91d2ff315a12b8900bfc2d1671e525b918. Quatre consignes/journal relus via GitHub. Les 152 fichiers texte locaux correspondent aux SHA distants, arbre initial propre ; sept PNG absents, aucun workflow présent. Dépendances existantes disponibles et utilisées, pas de réinstallation prétendue.

Audit ciblé du parcours existant : 13 régressions rouges reproduites (double clavier/bouton, action après démontage/date/membre/backend/retrait/lecture indisponible/réponse reçue, brouillon périmé et succès/erreur tardifs). Verrou immédiat par membre porté par la question, survivant aux reprises de lecture ; permission et réponse courantes relues, résultat obsolète ignoré avant notification. Un acquittement réussi empêche un nouvel envoi en attendant la collection. Quatre cas supplémentaires vérifient panne/reprise, ancienne saisie, résultat ambigu et deux membres locaux. Les erreurs brutes sont remplacées par un résultat honnête non confirmé ; aucun faux échec certain de commit.

Preuves : 49 suites / 958 tests applicatifs en 14,479 s ; après ajustement de la structure du gestionnaire pour la revue React, lint/TypeScript réussis et les 25 tests question repassent en 0,901 s. Diff relu, git diff --check propre. Aucun serveur/règle changé : tests sécurité non relancés, dernière preuve historique 67 tests le 15 octobre. Tous appels/notifications doublés ; aucun contenu réel, build, déploiement, message à un tiers ni dépense. Pas de validation visuelle/native, pas de transaction locale multi-appareils ni d'annulation d'un envoi déjà engagé. Le mécanisme serveur existant submitDailyAnswer reste inchangé. Suite : anciennes actions et réponses tardives des mots doux.

## 2026-10-20, 13:25 Europe/Brussels — Brouillons et envoi des mots doux

Huit régressions reproduites avant correction : brouillon visible après changement d'utilisateur/couple/mode, ancien bouton envoyant l'ancien texte ou renvoyant un texte confirmé, succès/erreur tardifs après départ et action ancienne après remplacement de backend. Isolation du formulaire par session, relecture du brouillon courant et invalidation des actions/retours périmés. Le transport accepte un garde optionnel avant écriture et avant notification ; les autres appelants gardent leur comportement. Message de résultat non confirmé avec vérification de l'historique avant reprise, sans promettre qu'une erreur exclut un enregistrement.

Preuves : 8 tests rouges puis verts ; 23 tests ciblés dont cinq tests du vrai transport avec backend fictif (aucun message envoyé). Suite complète 49 suites / 971 tests, 8,262 s. Lint réussi ; deux accès aux résultats du mock corrigés après diagnostic TypeScript, puis lint/TypeScript réussis. Diff relu et espacement vérifié. Aucun serveur/règle changé, aucun test sécurité supplémentaire nécessaire à ce changement client. Les créations de notes ne sont pas idempotentes après réponse perdue, une écriture déjà engagée n'est pas annulée. Les boutons cœur et la suppression restent à auditer séparément. Pas de build, export visuel, déploiement, distribution ou dépense.

Premier checkpoint confirmé sur la référence Git : 89240abb4f34ce0251a4bbdbf472488733ecdbae. La lecture immédiate de la PR conservait l'ancienne tête après update_ref réussi ; vérification directe de la référence confirme le nouveau SHA, aucune seconde écriture ni force. Les checkpoints suivants vérifient directement la référence avec expected_sha.

## 2026-10-20, 13:28 Europe/Brussels — Bouton cœur et retours tardifs

Sept régressions rouges corrigées en deux passes : action sans partenaire cloud, ancien bouton contournant le délai, changement de partenaire/backend, résultat dans le compte suivant, deux appuis successifs avant rafraîchissement et erreur tardive d'un backend remplacé. Garde de session transmis au transport, état isolé par compte/couple/mode, acquittement immédiat avant rendu et minuteur nettoyé au démontage. Le résultat ambigu est signalé sans promettre un échec certain. Contrôle supplémentaire du délai de 2,5 secondes et du mode local sans partenaire avec horloge simulée.

Preuves : 31 tests ciblés réussis en 1,440 s, lint/TypeScript réussis après dernier ajout. Dernière suite complète : 971 tests au checkpoint précédent ; pas présentée comme une suite complète de ce lot. Diff relu et git diff --check propre. Aucun appel réel, serveur/règle modifié, build, déploiement ni dépense. Une opération déjà engagée n'est pas annulée. Suite : confirmations de suppression et saisie pendant l'envoi.

## 2026-10-20, 13:31 Europe/Brussels — Suppression des mots doux

Dix régressions reproduites puis corrigées : confirmation après départ, changement de compte/backend, chargement/panne, retrait/modification/changement d'auteur, confirmation rejouée et ancien appui long pendant une panne. L'action vérifie les données et droits courants avant dialogue et avant suppression, protège chaque confirmation contre le rejeu et verrouille les opérations concurrentes. Trois contrôles supplémentaires couvrent l'échec visible sans erreur brute, la reprise par une nouvelle confirmation, la concurrence et le rejet tardif silencieux après départ.

Preuves : 49 suites / 992 tests applicatifs réussis en 8,132 s ; lint/TypeScript réussis après les derniers tests. Diff relu et espacement vérifié. Aucun compte réel ni donnée réelle supprimée. Cette vérification client ne remplace pas les règles serveur et ne fournit pas de transaction conditionnelle sur la version d'un document modifié simultanément à distance. Aucun serveur/règle changé, aucun build, déploiement, distribution ni dépense. Suite : verrouillage de saisie et acquittement des notes avant rafraîchissement React.

## 2026-10-20, 13:32 Europe/Brussels — Verrou de saisie et acquittement immédiat

Deux régressions rouges supplémentaires : ancien bouton rejouant une note après acquittement mais avant rendu, ancienne saisie modifiant le texte pendant l'envoi. Verrou synchrone partagé par la saisie et l'envoi ; brouillon relu et mis à jour immédiatement par les événements, vidé dès confirmation courante. Un troisième test vérifie une saisie suivie d'envoi avant le rendu. Le brouillon reste intact après échec et les retours d'une ancienne session restent ignorés.

Preuves finales : 49 suites / 995 tests applicatifs réussis en 7,041 s ; 47 tests mots doux/cœurs dont les nouveaux scénarios. Lint/TypeScript réussis sur ce code et ces tests ; diff relu, git diff --check propre. Cinq lots de correction préparés et contrôlés, chacun avec son checkpoint CAS expected_sha, sans force. La lecture de référence a confirmé les quatre premiers checkpoints : 89240ab, ddc7d52, bf1288b, b0b8bcc. Ce cinquième lot inclut cette entrée.

Durée observée à cette entrée : environ 18 minutes depuis 13:14, pas une heure. Clôture après les cinq lots contrôlés pour rendre le point d'activité demandé par le propriétaire pendant la session ; aucune durée supplémentaire, limite de quota ou activité continue prétendue. Prochaine priorité : audit des autres actions d'accueil, puis préparation isolée de la reprise des souvenirs selon MEMORY-PROTOCOL.md, sans activation avant prérequis. Une limite reste explicite : les créations ordinaires après réponse perdue ne sont pas idempotentes, les contrôles client ne remplacent pas les règles ou transactions serveur.

Aucune modification serveur/règles/configuration native/EAS ou activation payante. Pas de build native, export visuel, déploiement, distribution TestFlight ou relecture de validation Apple. Sept PNG toujours indisponibles localement ; aucun substitut créé. Aucun contenu intime réel, opération sur compte réel, message à un tiers, paiement ni dépense.

## 2026-10-20, 14:32 Europe/Brussels — Reprise d'ajout photo après panne de lecture

PR #3 ouverte/brouillon, tête initiale 2ab831f955da06926b04da29e5da7ddd55152f4f. Consignes relues via GitHub ; 152 fichiers texte concordent avec les SHA distants, sept PNG absents, aucun changement local initial. Le verrou de useAddMemory était recréé au retour de disponibilité, permettant de rouvrir le sélecteur alors qu'une sélection, un upload ou un ajout était toujours engagé. Trois régressions rouges puis vertes : verrou désormais conservé par backend jusqu'à la résolution de l'opération, indépendamment de la disponibilité de lecture. Les étapes suivantes de l'ancien contexte restent abandonnées ; un nouveau compte indépendant garde son fonctionnement.

Preuves : 20 tests ciblés réussis ; lint/TypeScript réussis ; 49 suites / 998 tests applicatifs en 8,373 s. Diff relu, git diff --check propre. Aucun upload réel, aucune ressource factice, aucune annulation ou suppression compensatoire d'upload. Verrou limité à cette instance du hook ; pas d'idempotence ni de verrou entre plusieurs appareils.

Contrôle de sécurité tenté via npm run test:security : compilation functions réussie, CLI annonce explicitement demo-nous-deux-security, puis téléchargement de cloud-firestore-emulator-v1.19.8.jar. Le contrôle automatique d'approbation a rejeté la poursuite, motif : connexion Firebase publique avec risque de toucher un environnement réel/transmettre des données. Cache des émulateurs vide ; aucun test de sécurité lancé ou déclaré réussi, aucune nouvelle tentative de téléchargement par un autre moyen. Le fichier de tests exige les trois variables EMULATOR_HOST mais ne vérifie actuellement que leur présence. Dernière preuve de sécurité reste historique (67 tests le 15 octobre), notamment pour le lot de suppression précédent ; aucune fusion/distribution permise sur cette seule preuve historique. Ce blocage n'empêche pas les tâches client et les contrôles locaux.

Suite : améliorer les messages des étapes photo sans exposer d'erreurs techniques brutes ; durcir les préconditions locales du banc de sécurité, puis poursuivre les tâches prêtes sans cloud réel. Aucun build, déploiement, service payant ni dépense.

## 2026-10-20, 14:34 Europe/Brussels — Erreurs photo compréhensibles et sans détails privés

Quatre régressions rouges reproduites : erreurs de sélection/upload/enregistrement pouvant afficher une URL privée ou un jeton contenu dans le message du fournisseur ; erreur non standard dont la conversion en texte provoquait un second échec sans dialogue. Messages fixes par étape, sans interpolation de l'erreur. Le résultat ambigu après création reste explicitement non confirmé et invite à vérifier l'album ; les erreurs de préparation donnent une action utile. Aucun fichier envoyé ou supprimé automatiquement.

Preuves : 24 tests ciblés réussis en 1,054 s, lint/TypeScript réussis, diff relu et git diff --check propre. Dernière suite complète de ce cycle : 998 tests avant ce second lot ; les quatre nouveaux tests ciblés sont vérifiés séparément. Sécurité sur émulateurs toujours bloquée comme documenté à 14:32. Le propriétaire demande un aperçu visuel pendant le cycle : préparation d'une démonstration isolée des états, avec données fictives et sans prétendre montrer une build native. Prochain travail de développement : garde stricte localhost du banc de tests, puis parcours d'accueil restant ; pas d'activation du protocole souvenir.

## 2026-10-20, 15:32 Europe/Brussels — Préconditions locales des tests de sécurité

PR #3 toujours ouverte/brouillon, référence b91696973c7af8ce7dbd2e7361ad2c11e8daa2db. Consignes relues via le connecteur ; 152 fichiers texte locaux correspondent aux SHA Git distants, sept PNG absents. Le banc ne vérifiait que la présence des variables d'émulateur et importait les SDK avant le contrôle. Trois tests hors réseau ont reproduit cet ordre dangereux : l'intercepteur d'import arrêtait Firebase avant toute initialisation. Nouvelle garde pure exécutée en première instruction : projet demo-nous-deux-security obligatoire, ports explicites valides et hôtes strictement loopback, refus des URL/chemins/identifiants/hôtes distants et des projets d'environnement contradictoires. Endpoints validés transmis explicitement aux tests des règles, sans découverte implicite du hub. Les erreurs n'affichent aucune valeur d'environnement.

Preuves : trois régressions rouges puis vertes ; 11 tests de garde réussis (268 ms), couvrant aussi les formes invalides de chaque endpoint et du hub, les variables absentes et les projets incorrects. Lint, TypeScript applicatif et compilation functions réussis. Suite applicative complète : 49 suites / 1002 tests réussis en 11,079 s. Diff relu, git diff --check propre. Commande test:guard disponible sans dépendance Firebase ; intégrée à la commande de sécurité avant les tests d'émulateurs.

Limites : aucun émulateur démarré ni téléchargement retenté, aucun accès cloud ni donnée réelle. L'exécution complète des 67 tests sécurité demeure bloquée par la préparation des émulateurs signalée à 14:32 ; la garde ne contourne pas cette restriction et ne valide pas l'intégration avec leurs SDK. Aucun code serveur métier/règle changé, aucune fusion, build, distribution, activation payante ou dépense. Suite : audit des dernières actions d'accueil puis contrôles des correctifs client utiles.

## 2026-10-20, 15:35 Europe/Brussels — Anciennes actions de Votre histoire

Sept régressions reproduites : ancienne date/cadrage envoyés malgré une saisie plus récente, validation d'une date devenue future contournée, actions de date/photo exécutées depuis le cadrage. Les valeurs courantes sont désormais relues dans l'action et mises à jour dès l'événement, avant le rendu ; les transitions de cadrage invalident immédiatement les actions de l'autre vue. Une ancienne fermeture de cadrage ne peut plus fermer une nouvelle ouverture.

Preuves : sept tests rouges puis verts et trois contrôles supplémentaires sur les transitions sans rendu et anciennes fermetures ; 35 tests CounterSheet réussis en 1,126 s. Lint et TypeScript réussis, diff relu et git diff --check propre. Revue React : références uniquement mises à jour dans les effets/événements, verrou commun conservé, aucun nouveau module ni effet réseau. Dernière suite applicative complète : 1002 tests au checkpoint 808add9, avant ce lot de dix tests. Aucun serveur/règle ni mécanisme de suppression touché ; tests uniquement fictifs. Pas d'essai de cadrage réel, build, déploiement ou dépense. Suite : synchronisation d'une date intacte reçue du partenaire et erreurs du formulaire sans données techniques privées.

## 2026-10-20, 15:37 Europe/Brussels — Date de rencontre partagée

Trois régressions reproduites : une date intacte gardait l'ancienne valeur après mise à jour du partenaire ou reprise de lecture, et une validation inchangée émettait une écriture inutile. Le formulaire réutilise useSharedDraft : réception des valeurs tant que le champ est intact, conservation de la saisie modifiée, fermeture sans écriture si identique à la date actuellement reçue. Une date non définie reste enregistrable. Les tests de verrou/sauvegarde préexistants saisissent maintenant une vraie modification au lieu de dépendre d'une écriture inchangée.

Preuves : trois tests rouges puis verts et trois contrôles complémentaires, 41 tests CounterSheet réussis en 1,366 s ; lint/TypeScript réussis, diff relu et git diff --check propre. Aucun champ photo/cadrage renvoyé avec la date, aucune API native modifiée. Limite : les modifications concurrentes du même champ après le contrôle client ne sont pas transactionnelles ; aucun essai multi-appareils réel. Aucun serveur, règle, build, déploiement ni dépense. Suite : erreurs du formulaire contenant potentiellement des détails privés, puis cadrage intact reçu du partenaire.

## 2026-10-20, 15:40 Europe/Brussels — Erreurs de Votre histoire sans contenu privé

Six régressions reproduites : sélection, upload, association, date et cadrage réaffichaient le message fournisseur contenant une URL/jeton fictif ; un objet d'erreur avec getter message fautif provoquait un nouvel échec. Le formulaire ne lit plus l'erreur brute : textes fixes selon l'étape photo et résultat explicitement non confirmé après une écriture. Brouillon conservé, vérification des informations reçues demandée avant reprise, anciens retours toujours ignorés. Aucune suppression compensatoire de photo ni reprise automatique.

Preuves : six tests rouges puis verts, 47 tests CounterSheet réussis en 1,250 s ; lint et TypeScript réussis, diff relu et git diff --check propre. Les anciennes assertions exigeant le message fournisseur ont été remplacées par les textes publics contrôlés. Revue React : état d'étape local à chaque action, même verrou synchrone, aucune dépendance ajoutée. Aucun SDK/service réel appelé ni donnée privée réelle consultée ; il s'agit de défauts reproduits avec données fictives, pas d'une fuite réelle constatée. Aucun serveur/règle, build, déploiement ni dépense. Prochain contrôle : cadrage reçu du partenaire tant que l'éditeur est intact.

## 2026-10-20, 15:42 Europe/Brussels — Cadrage intact reçu du partenaire

Trois régressions reproduites : cadrage intact non actualisé après modification distante ou reprise de lecture, validation inchangée écrivant inutilement. Le cadrage est traité comme une transformation complète : il suit la valeur reçue uniquement s'il est intact, sans fusionner séparément x/y/zoom. Une modification locale est préservée et la sauvegarde inchangée referme le cadrage sans écriture. Les protections de photo remplacée et de session sont conservées.

Preuves : trois tests rouges puis verts et deux contrôles supplémentaires ; 52 tests CounterSheet réussis en 1,274 s. Suite complète : 49 suites / 1029 tests réussis en 8,751 s ; lint/TypeScript réussis, diff relu et git diff --check propre. Revue React : synchronisation conditionnelle stable pendant le rendu, pas de refs modifiées durant le rendu ni nouvelle dépendance. Aucun ajustement réel sur téléphone ; pas de transaction serveur sur une modification concurrente de la même photo. Aucun serveur/règle, build, déploiement, distribution ou dépense. Suite de l'audit : actualisation de la question quotidienne et de l'accueil lors d'un changement de jour.

## 2026-10-20, 15:50 Europe/Brussels — Accueil et question au changement de jour

Trois régressions reproduites sur la question : le brouillon de la veille restait affiché sans nouvelle collection, pouvait être envoyé depuis une ancienne action avant un rendu, et un résultat tardif pouvait encore notifier le partenaire. useToday partage désormais une seule horloge locale et un abonnement AppState entre les consommateurs de l'accueil : question, date/compteur, agenda/comptes à rebours et anniversaire souvenir. Actualisation proche de minuit, au retour au premier plan et contrôle local borné à une minute pour les changements d'horloge/fuseau ; arrêt des minuteurs lorsque l'app est inactive ou sans consommateur. La question revalide aussi le jour au moment de l'action et du retour, sans prétendre annuler une écriture engagée.

Lectures prescrites effectuées pour Expo ~57.0.28 / React Native 0.86.3 : https://docs.expo.dev/versions/v57.0.0/, https://docs.expo.dev/llms.txt et https://reactnative.dev/docs/0.86/appstate ; API AppState actuelle et implémentations installées native/web examinées. Aucun paquet ajouté ni configuration native modifiée. Revue React : abonnement partagé avec useSyncExternalStore, snapshot primitif, aucune notification de rendu si le jour reste identique, nettoyage après dernier démontage.

Preuves : trois régressions rouges puis vertes ; huit tests d'horloge simulée (minuit, reprise de plusieurs jours, arrière-plan, état inconnu, retour d'horloge, consommateurs multiples, absence de rendu inutile et nettoyage). Un test d'intégration de l'accueil vérifie le nouvel agenda/Jour J et la conservation du formulaire ouvert, sans écriture. Les fixtures ont été corrigées pour garder les exports natifs du preset Expo, distinguer les microtâches React des minuteurs applicatifs et lire le texte rendu plutôt que sérialiser des props React circulaires. Suite finale : 50 suites / 1041 tests réussis en 8,236 s ; lint/TypeScript réussis, diff relu et git diff --check propre.

Limites : horloge et AppState doublés, aucun cycle veille/reprise réel sur iPhone/Android ni export visuel. Pas de nouveau sondage réseau, notification réelle, tâche système en arrière-plan ou écriture automatique. Aucun serveur/règle, build, déploiement, distribution ni dépense. Les tests de sécurité restent bloqués comme précédemment. Suite : vérifier une saisie de réponse suivie immédiatement de validation avant le rendu.

## 2026-10-20, 15:52 Europe/Brussels — Réponse relue dès la saisie

Quatre régressions rouges : validation immédiatement après une saisie conservant le texte précédent, texte effacé encore envoyé, première réponse ignorée et deux brouillons locaux non disponibles avant rendu. Le gestionnaire de saisie actualise désormais sa référence courante immédiatement puis l'état React, en conservant la séparation par membre et les gardes jour/session/verrou.

Preuves : quatre tests rouges puis verts ; 32 tests question réussis en 0,992 s, lint/TypeScript réussis, diff relu et git diff --check propre. Dernière suite complète : 1041 tests au checkpoint e3cb299, avant les quatre nouveaux cas. Aucune écriture ou notification réelle ; pas de modification du serveur, des règles, de la distribution ni des fonctions payantes. Ce correctif ne crée pas de garantie d'idempotence multi-appareils. Suite : robustesse du convertisseur partagé d'erreurs face aux objets malformés, puis contrôles finaux et revue des limites.

## 2026-10-20, 15:55 Europe/Brussels — Convertisseur d'erreurs résilient

Neuf régressions reproduites : message non textuel, propriétés code/message qui lèvent une exception, lecture inutile d'un message fournisseur malgré un code reconnu/inconnu, et rejet secondaire dans useAsyncAction. userError valide les types, traduit le code avant d'accéder au message, utilise un repli pour les propriétés fautives et ne convertit pas arbitrairement l'objet en texte. Le verrou de l'action reste réutilisable après le repli, sans reprise automatique.

Preuves : neuf tests rouges puis verts ; 28 tests ciblés, puis 51 suites / 1065 tests applicatifs réussis en 9,388 s. Lint/TypeScript réussis, diff relu et git diff --check propre. Aucun mécanisme d'écriture/suppression changé ; seulement l'interprétation client d'un rejet. Le comportement historique des messages métier sans code est conservé : ce lot ne prétend donc pas masquer globalement tous les messages bruts. Les parcours photo précédents utilisent leurs propres textes fixes. Les autres convertisseurs backend doivent être audités avant une politique globale de messages explicitement fiables. Aucun accès à des données réelles, serveur/règle, build, déploiement ou dépense.

## 2026-10-20, 16:02 Europe/Brussels — Messages de connexion et de fonctions robustes

Douze régressions reproduites après extraction à comportement identique : codes auth hérités d'Object.prototype, messages callable non textuels, propriétés qui lèvent une exception et lecture inutile d'un message malgré un code technique. Les convertisseurs sont isolés dans service-errors, sans SDK ; seuls les codes auth propres à la table sont reconnus, les types sont vérifiés et les getters fautifs ont un repli. Les messages métier des codes callable explicitement autorisés restent compatibles : il ne s'agit pas d'une politique globale masquant tout texte serveur.

Preuves : 12 tests rouges puis verts et sept contrôles de compatibilité ; suite complète de 52 suites / 1084 tests réussie en 13,211 s. Lint et TypeScript réussis ; diff relu et git diff --check propre. Les fonctions d'authentification, d'écriture et de suppression utilisent les mêmes appels qu'avant ; seule la présentation des rejets est modifiée. Aucun SDK distant appelé dans ces nouveaux tests, aucun serveur/règle, build, déploiement ni dépense. Suite : revue des scénarios natifs à vérifier et des changements de la session avant clôture.

## 2026-10-20, 16:04 Europe/Brussels — Couverture de reprise et recette native préparée

Amélioration concrète de couverture : les fonctions publiques du backend sont désormais exercées après les rejets malformés des convertisseurs extraits, et l'horloge est vérifiée pendant les journées de changement d'heure. Six tests de reconnexion/création doublées prouvent le message de repli, la conservation de la session mémorisée, l'absence de déconnexion et le succès d'une action suivante explicite. Deux tests supplémentaires traversent le jour civil sans rendu intermédiaire inutile, puis changent de date au minuit suivant.

Preuves : TZ=Europe/Brussels jest ciblé, 78 tests réussis en 1,499 s ; les durées calculées par Node dans ce même fuseau sont bien 23 h le 29 mars 2026 et 25 h le 25 octobre 2026. Lint/TypeScript réussis ; diff relu et git diff --check propre. Pas de nouveau défaut affirmé : ajout de couverture des corrections précédentes, sans changement de production. Dernière suite complète : 1084 tests au checkpoint 93a2581, avant ces huit nouveaux cas.

TESTFLIGHT-REVIEW.md complète les essais natifs non exécutés : validation immédiate, changement de jour/reprise, date et cadrage reçus du partenaire, remplacement de photo, erreurs d'upload et reconnexion. Critères attendus, traçabilité build/SHA et limites explicites. Aucune build créée, aucun appareil, compte, notification ou service réel utilisé ; aucune dépense. Suite : contrôle final intégral et correspondance des blobs GitHub.

## 2026-10-20, 16:12 Europe/Brussels — Préférences de thème résilientes

Huit régressions reproduites : valeurs héritées acceptées par l'opérateur in, lecture tardive écrasant un choix récent, rejets de lecture/écriture non traités, sauvegardes simultanées non ordonnées et choix inconnu injecté dans l'action. La restauration accepte uniquement les thèmes propres à la table et n'écrase pas un choix utilisateur. Les écritures de ce provider sont sérialisées, leurs rejets absorbés pour cette préférence cosmétique ; l'affichage reste utilisable en mémoire. Une ancienne action après démontage ne sauvegarde plus. Aucun effacement ni migration de préférence.

Preuves : après correction d'un mock React Native trop minimal, huit tests rouges et deux contrôles verts ont été observés ; puis dix tests ciblés réussis en 0,802 s. Un contrôle de démontage supplémentaire porte la nouvelle suite à onze cas. Le lint a aussi signalé la transmission via createElement d'un callback utilisant des refs et une affectation de fixture pendant rendu : provider converti en JSX, fichier theme.ts déplacé vers theme.tsx sans perte de contenu, fixture mise à jour dans un effet. Aucun contournement/désactivation de règle lint. Vérification finale : lint/TypeScript réussis, 53 suites / 1103 tests applicatifs réussis en 8,443 s, diff relu et git diff --check propre.

Limites : stockage natif doublé, ordre garanti dans ce provider seulement ; une écriture refusée peut perdre le choix au redémarrage, aucune promesse de persistance ou de reprise automatique. Recette native ajoutée sans la cocher. Aucun serveur/règle, opération financière, build, déploiement ni essai sur appareil.

## 2026-10-20, 16:13 Europe/Brussels — Contrôle de clôture de la session

Session poursuivie depuis 15:25:45 ; 47 min 43 s observées au contrôle de 16:13:28, avant cette dernière sauvegarde. Onze lots indépendants enregistrés, sans attente artificielle ni prétention à une heure entière : garde du banc de sécurité, actions de Votre histoire, date partagée, erreurs photo/date/cadrage, cadrage partagé, changement de jour, saisie immédiate des réponses, userError, convertisseurs auth/callable, couverture de reprise/recette, préférences du thème. Dernier checkpoint de code : db3979934be668b0a1270e46eb477d124fcaf015.

État final vérifié : 53 suites / 1103 tests applicatifs réussis en 8,443 s ; lint et TypeScript réussis. Les 11 tests hors réseau du garde des émulateurs et la compilation TypeScript functions ont également réussi. Il ne s'agit pas de l'exécution des 67 tests historiques sur émulateurs : ceux-ci restent bloqués par le refus déjà consigné, sans nouvelle tentative ni voie alternative. Diff examiné, git diff --check propre, worktree propre avant l'ajout de cette entrée. Les 160 blobs présents correspondent exactement aux SHA de l'arbre distant non tronqué ; sept PNG demeurent absents. Le renommage theme.ts vers theme.tsx est bien enregistré, sans ancien fichier concurrent.

PR #3 toujours ouverte et en brouillon lors du contrôle ; chaque checkpoint a utilisé expected_sha et force:false, puis une relecture de référence. Aucun EAS/runner/déploiement, fusion, distribution, changement de groupe TestFlight, validation Apple ni dépense. Configuration publique toujours draft et retentionVerified:false ; indicateurs payants et configurations natives non activés. Pas d'export visuel ou d'essai physique revendiqué. Les messages métier explicitement conservés par les convertisseurs ne constituent pas une garantie générale de confidentialité de toutes les erreurs.

Suite prioritaire réalisable : poursuivre l'audit ciblé des libellés et états accessibles des formulaires existants, sans inventer de défaut ni modifier les couleurs sans preuve. Les protocoles serveur, l'activation de l'association souvenir, la distribution et les essais natifs attendent toujours leurs prérequis. Ce bilan est une preuve de code préparé et sauvegardé, pas d'une nouvelle version installée chez les testeurs.

## 2026-10-20, 16:38 Europe/Brussels — Événements de contrôles désactivés

Reprise de la PR #3 ouverte/brouillon à 3263ccfaef091da4e40d32913ec913fdceea8470 ; consignes et journal relus via GitHub. Les 160 blobs texte disponibles correspondent au SHA distant, sept PNG absents, worktree initial propre. Priorité : cohérence des états des contrôles partagés. Six régressions reproduites : Button ne revalidait pas disabled dans son action et les anciennes actions de Button/IconButton/Chips/ColorPicker pouvaient passer après désactivation. Une garde de génération du contexte actif refuse maintenant les événements périmés, y compris après désactivation/réactivation ou démontage, sans modifier les gardes métier des formulaires.

Preuves : six cas rouges puis verts, six contrôles initiaux et huit contrôles complémentaires ; 53 suites / 1123 tests applicatifs réussis en 8,818 s. Lint/TypeScript réussis, diff relu et git diff --check propre. Documentation versionnée Expo 57 et index relus, ainsi que https://reactnative.dev/docs/0.86/accessibility et /textinput. Grille React utilisée : contexte mémorisé sur le seul état disabled, refs mises à jour en effet, aucun effet réseau ou ref mutée au rendu. Les tests appellent les gestionnaires retenus avec composants natifs doublés ; pas de preuve de gestes/VoiceOver/TalkBack réels. Aucun serveur/règle, build, déploiement ou dépense. Suite : noms accessibles et états des champs de saisie.

## 2026-10-20 — 16:43 Europe/Brussels — Champs nommés et état accessible

- Base : `96836f05a7fb681cef0d9e60ef2fb6d33c31e3c1`. Sept régressions reproduites : cinq annonces absentes dans Field, deux libellés d’accueil absents ; deux contrôles de compatibilité déjà verts.
- Field conserve la priorité du nom explicite puis du titre et utilise le placeholder comme dernier repli, jamais la valeur saisie. L’état disabled suit editable/readOnly (priorité native readOnly), sans effacer busy ni les indications explicites. Noms stables et distincts pour réponse personnelle/partenaire et mot doux.
- Preuves : lint et TypeScript réussis ; 53 suites / 1132 tests réussis en 9,183 s ; diff relu et `git diff --check` propre. Documentation Expo57/React Native0.86 et implémentation TextInput installée consultées. Tests uniquement fictifs et contrats de composants.
- Limites : aucune preuve VoiceOver/TalkBack réelle ni aperçu complet (sept PNG absents), aucune build/distribution/validation Apple. Serveur et règles inchangés ; aucun émulateur ni service réel appelé. Suite : audit ciblé des confirmations web et accessibilité des contrôles.

## 2026-10-20 — 16:46 Europe/Brussels — Confirmation web consommée une seule fois

- Base : `593a67845195d65e1ba546e1a62938bc54aeff56`. Six cas rouges reproduits dans DialogHost : double validation/annulation, anciennes validation/fermeture après remplacement, et action après démontage.
- Le dialogue courant est actualisé dès sa réception puis consommé avant l’appel du callback. Remplacement, fermeture (avec ou sans annulation) et démontage invalident les événements retenus. Une action ouvrant un second dialogue le conserve. Alert natif reste inchangé.
- Preuves : dix tests nouveaux, dont six rouges puis verts ; 56 tests ciblés, lint et TypeScript réussis. Contrôle transversal : 54 suites / 1142 tests réussis en 8,613 s. Diff relu et sans erreur d’espacement.
- Limites : tests de composants et callbacks fictifs, pas de clic navigateur ni d’alerte native réellement essayés. Aucune écriture serveur, build, distribution ou dépense. La garde de confirmation ne remplace pas les vérifications métier au moment de l’écriture.

## 2026-10-20 — 16:48 Europe/Brussels — Dates complètes et contexte accessible

- Base : `1f369687caa8a3e66ecba6fe7c0b0836517d7aae`. Trois cas rouges : année absente du bouton Android et champs date/heure iOS sans nom explicite.
- Le bouton Android affiche et annonce le jour, le mois et l’année. Le sélecteur iOS reçoit le titre du champ et son état disabled, sans remplacer sa valeur native ni modifier la sélection.
- Preuves : trois régressions vertes, 98 tests ciblés (sélecteurs, histoire, souvenir), lint et TypeScript réussis, diff relu/propre. Documentation Expo57 date-time-picker (version recommandée9.1.0), README et transmission des props de la version installée consultés.
- Limites : contrats natifs simulés ; rendu compact, VoiceOver, TalkBack et lisibilité à grande taille à vérifier sur appareils. Aucun export visuel/build/distribution. Dernier contrôle transversal : 1142 tests avant ce lot ; pas de nouvelle preuve de tests serveur.

## 2026-10-20 — 16:50 Europe/Brussels — Contraste des actions principales sombres

- Base : `8030604d9e48fc41a197faed7f0e33966d0b927f`. Mesure sRGB des quatre thèmes sombres : texte blanc entre 2,15:1 et 2,91:1 sur primary ; cinq tests rouges, quatre contrôles clairs déjà verts.
- onPrimary sombre devient #160E12 (couleur de fond sombre existante), sans changer les fonds ni les quatre accents. Boutons et boutons icône utilisant déjà ce jeton en bénéficient ; Fab et son indicateur utilisent maintenant le même jeton. Contraste calculé entre 6,53:1 et 8,82:1 sur les fonds sombres concernés ; thèmes clairs inchangés.
- Preuves : 55 suites / 1154 tests réussis en 9,262 s, dont neuf tests de contraste/connexion au composant ; lint/TypeScript et diff propres. Références : https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html et https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html.
- Limites : calcul sur couleurs opaques au repos, pas certification globale WCAG ni recette native (états pressés, dégradés et autres pastilles hors périmètre). Aucun service/build lancé. Les heures des deux entrées précédentes ont été corrigées d’après les horodatages réels des checkpoints : 16:46 et 16:48, sans changer leurs résultats.

## 2026-10-20 — 16:53 Europe/Brussels — Titres navigables par lecteur d’écran

- Base : `db66e56f7a10267b89dce4e6e783d2b5533c4cbd`. Quatre cas rouges : titres de Screen, SectionTitle, Sheet et Empty sans sémantique d’en-tête.
- T transmet désormais accessibilityRole lorsqu’il est explicitement fourni. Les quatre vrais titres reçoivent header ; les nombres ou textes seulement stylés h2 ne deviennent pas automatiquement des titres. Écran sans titre fourni sans en-tête vide.
- Preuves : quatre cas rouges puis verts et deux contrôles ; lint/TypeScript réussis ; 55 suites / 1160 tests réussis en 9,847 s. Diff relu/propre, documentation React Native0.86 accessibilité consultée.
- Limites : propriétés de composants testées, navigation réelle au rotor VoiceOver/TalkBack non essayée ; pas de certification ni de build. Aucune modification serveur ni activation de fonctions payantes.

## 2026-10-20 — 16:55 Europe/Brussels — Longues confirmations web défilantes

- Base : `a873d90aab1481c91d0000f8c78bccd918e363d1`. Revue du code : message de confirmation pouvant inclure un titre saisi long, boîte sans hauteur maximale et sans défilement, actions repoussées par le contenu. Un test structurel rouge confirme l’absence de zone défilante sur un message fictif long ; ce test n’est pas une reproduction pixel sur navigateur.
- Boîte bornée à la hauteur disponible, titre/message dans une ScrollView réductible, boutons séparés sans réduction. Texte intégral conservé ; comportements de confirmation inchangés.
- Preuves : lint/TypeScript et 20 tests ciblés réussis (1,294 s), diff relu/propre. Documentation React Native0.86 ScrollView/Layout consultée pour le bornage et flexShrink. Dernier contrôle transversal : 1160 tests avant ce lot.
- Limites : recette visuelle navigateur étroit/paysage et texte agrandi encore nécessaire, aucun export complet ni validation native. Pas de service réel, build ou distribution.

## 2026-10-20 — 16:57 Europe/Brussels — Onglets sans hauteur fixe ni troncature forcée

- Base : `1f638b6a169833a022eb9711d2b1553cf5ade386`. Revue du sélecteur partagé des listes/restaurants : hauteur40 fixe et texte limité à une ligne malgré la mise à l’échelle système. Un test structurel rouge vérifie ces contraintes ; aucune capture mobile n’est revendiquée.
- Hauteur minimale40 conservée, hauteur naturelle et marge verticale autorisées ; libellés centrés pouvant passer sur plusieurs lignes, sans désactiver l’agrandissement système. Sélection et actions inchangées.
- Preuves : lint/TypeScript réussis, 93 tests ciblés en1,625s, diff relu/propre. Documentation React Native0.86 Text/Layout consultée. Dernier contrôle transversal :1160 tests avant les deux derniers lots.
- Limites : vérifier 320px, paysage et grande police sur appareils autorisés avant diffusion ; tests structurels insuffisants pour valider la mise en page réelle. Aucune build, publication ou dépense.

## 2026-10-20 — 17:01 Europe/Brussels — Cases de liste identifiables

- Base : `839c96a9e040a64139ef9cb3be5f3c81505d342b`. Trois régressions confirmées après correction du sélecteur de test : les cases annonçaient seulement une action générique, un renommage ne donnait aucun contexte accessible, et leur coche restait blanc sur l’accent sombre clair.
- Chaque case porte maintenant le titre déjà affiché de son article, l’action restant une indication séparée ; état checked/busy/disabled inchangé. Le coche utilise onPrimary, déjà vérifié au lot de contraste. Aucun contenu nouveau lu ni transmis.
- Preuves : lint/TypeScript et 61 tests ciblés réussis en1,503s, diff relu/propre. Le checkpoint précédent a subi une déconnexion réseau lors du CAS : référence relue inchangée, même commit réessayé avec expected_sha, succès vérifié sans forcer ni doubler le commit.
- Limites : VoiceOver/TalkBack et focus des contrôles imbriqués encore à vérifier. Playwright est présent mais son Chromium attendu est absent et aucun navigateur système trouvé ; aucun téléchargement lancé, donc pas de recette pixel. Les sept PNG restent absents ; aucune build/distribution.

## 2026-10-20 — 17:04 Europe/Brussels — Cycle de vie des célébrations

- Base : `2d5859f1158fda54b791983e233af73214443bcd`. Quatre cas rouges reproduits avec animations doublées et horloge fictive : ancienne expiration effaçant un message récent au même Date.now, délais accumulés, délai après démontage, animations sans arrêt explicite.
- Identifiant monotone par couche au lieu de Date.now, un seul délai remplacé/nettoyé, largeur relue à chaque événement. Séquences et particules arrêtées lors de leur remplacement/démontage. Durées existantes conservées.
- Preuves : cinq nouveaux tests, quatre rouges puis verts et contrôle de durée nominale ; 99 tests ciblés réussis en1,766s, lint/TypeScript et diff propres. Documentation React Native0.86 Animated consultée.
- Limites : animations natives simulées, pas de mesure de fluidité/mémoire sur téléphone. Aucun service externe ni contenu réel. Suite : respect du réglage système de réduction du mouvement.

## 2026-10-20 — 17:09 Europe/Brussels — Célébrations sans mouvement imposé

- Base : `5d499b0b8db2e8da97a5a6e8ca7ca0e36ce30cd9`. Huit régressions rouges puis vertes : réglage activé, inconnu, rejeté ou fautif ; changement en direct ; réponse initiale tardive ; réactivation ; nettoyage de l’écoute.
- Hook conservateur sans mouvement avant lecture fiable, événement système prioritaire sur la requête initiale. Les particules et animations du message sont arrêtées lorsque la réduction est active ; le message reste affiché, durée existante conservée.
- Preuves : 56 suites / 1178 tests réussis en 8,513 s, lint/TypeScript et diff propres. Documentation React Native0.86 AccessibilityInfo/Animated et implémentation web installée consultées.
- Limites : doubles de plateforme, pas de test du réglage sur iPhone/Android ; autres animations hors périmètre. Aucun export, build, service payant ni distribution.

## 2026-10-20 — 17:12 Europe/Brussels — Choix sélectionnés du thème sombre

- Base : `35c71b48547cbd1874d74830c29f85b2fd035ee4`. Huit nouveaux cas de contraste calculé sur les choix Chips : quatre thèmes clairs déjà verts et quatre thèmes sombres rouges (2,15–2,91:1).
- Les choix utilisant primary reprennent onPrimary pour texte et icône, au lieu du blanc imposé ; couleurs personnalisées inchangées et encore à auditer. Les états et actions restent inchangés.
- Preuves : huit cas verts après correctif, 61 tests ciblés réussis en 1,494 s, lint/TypeScript et diff propres. Même formule sRGB et référence WCAG que le lot précédent de contraste.
- Limites : couleurs opaques au repos seulement, pas de certification globale ni d’essai natif. Aucun service, build ou distribution.

## 2026-10-20 — 17:30 Europe/Brussels — Contraste des couleurs de membre

- Reprise : PR #3 ouverte et en brouillon à b71065c4f1540a0614c81faa279a30580157f3a2, quatre fichiers de consignes relus via GitHub ; 164 blobs présents vérifiés par SHA, sept PNG toujours absents, worktree propre. Aucune répétition des douze lots précédents.
- Deux régressions reproduites : texte sélectionné et petite initiale sur orange #C26A1B à 3,91:1. Foreground opaque adapté pour Avatar et Chips personnalisés ; blanc conservé s’il atteint 4,5:1, sinon noir, sans modifier la couleur enregistrée. Formats non hexadécimaux/avec alpha inchangés, sans garantie de contraste.
- Preuves : deux cas rouges puis verts, douze contrôles des autres couleurs et quinze tests du calcul/repli (dont les 256 gris). Lint/TypeScript réussis ; 56 suites / 1215 tests réussis en 10,345 s ; diff relu/propre. Source : https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html. Documentation Expo57 et index relus.
- Limites : calcul opaque au repos, pas de validation native ni certification globale ; états atténués, transparence et autres composants hors périmètre. Aucun serveur/règle, build, déploiement, dépense ou distribution.

## 2026-10-20 — 17:32 Europe/Brussels — Cœur d’accueil sans mouvement imposé

- Base : `ded9704aa077e719ccad94348a41870dddb614f8`. Deux régressions rouges : PingCard lançait sa boucle malgré la réduction du mouvement et ne l’arrêtait pas lors d’une activation en direct.
- Réutilisation du hook conservateur existant ; boucle non lancée/arrêtée, échelle neutre et effet de pression sans réduction de taille. Action explicite, confirmation et envoi local simulé inchangés.
- Preuves : quatre nouveaux tests (deux rouges puis verts, deux contrôles), 65 tests ciblés réussis en 1,917 s ; lint/TypeScript et diff propres. Documentation React Native0.86 AccessibilityInfo/Animated relue. Tests d’animations et d’envoi doublés, aucun cœur ni notification réel envoyé.
- Limites : autres animations (logos, transitions) encore à examiner ; pas de réglage système essayé sur appareil ni de validation globale. Aucun serveur/règle, build, déploiement ou dépense.

## 2026-10-20 — 17:35 Europe/Brussels — Transitions modales adaptées

- Base : `85ab4b7f200395fc64e3fb5f2d19b576cec33acd`. Deux tests rouges sur Sheet et DialogHost : animations slide/fade encore demandées après activation de la réduction du mouvement.
- animationType devient none lorsque le hook indique une réduction (y compris avant lecture fiable), sans démonter les champs ni remplacer la confirmation. Alert natif n’est pas remplacé.
- Preuves : deux régressions vertes avec conservation du champ/message et de la fermeture/confirmation ; lint/TypeScript réussis, 57 suites / 1221 tests réussis en 12,514 s, diff relu/propre. Source : https://reactnative.dev/docs/0.86/modal.
- Limites : propriétés de composants vérifiées, animation native déjà engagée et focus clavier non essayés sur appareil/navigateur. Aucune build, distribution, dépense ni activation de fonctionnalité payante.

## 2026-10-20 — 17:38 Europe/Brussels — Logos décoratifs statiques sur demande

- Base : `ae264651ad6a1d9c3077aadc6bd1b2bc87210a4c`. Revue des deux FloatingHeart : boucles démarrées sans consulter le réglage système, contrairement aux célébrations maintenant corrigées. Amélioration justifiée par ces chemins inconditionnels, sans prétendre à une reproduction visuelle.
- Contrôleur partagé useFloatingHeartMotion : translation/échelle neutres si réduction active ou inconnue, nettoyage de la boucle au changement/démontage. Accueil conserve sa durée 2000 ms et sa translation seule ; onboarding conserve 1800 ms et son échelle. Images et dimensions inchangées.
- Preuves : cinq tests du contrôleur, 22 tests ciblés réussis en 1,546 s ; lint/TypeScript et diff propres. Pas de faux logo ni de fixture binaire : contrôleur isolé, aucune importation/rendu des images absentes dans ces tests.
- Limites : intégration/rendu des deux écrans non validés sur appareil ; transitions du navigateur et assistant désactivé hors périmètre. La lecture immédiate après le CAS précédent était incohérente ; seconde lecture confirmant exactement ae264651ad6a1d9c3077aadc6bd1b2bc87210a4c, sans répéter l’écriture ni forcer.

## 2026-10-20 — 17:45 Europe/Brussels — Invitations courantes uniquement

- Base : `44cef6a85c5f76110e316971f2ff8977d8ff52be`. Six régressions reproduites avant correction : double création avant rendu, création/partage après démontage, ancien partage après remplacement, ancien code conservé après remplacement ambigu et erreur de partage affichée dans un autre espace. Septième régression : texte promettant encore 24 heures malgré une échéance proche.
- Verrou synchrone partagé création/partage, identité du code courant et présence de l’écran revalidées. Retrait immédiat de l’ancien code au remplacement, même si la réponse échoue ; nouvelle tentative volontaire disponible. Texte partagé avec échéance réelle et fuseau. Erreurs fournisseur codées converties par userError, sans revendiquer une anonymisation des erreurs métier sans code.
- Preuves : sept cas rouges puis verts, quatre contrôles supplémentaires, dix-huit tests invitation ; lint/TypeScript réussis, 58 suites / 1237 tests réussis en 9,791 s ; diff relu/propre. Share et backend simulés, aucune invitation créée/envoyée. Source : https://reactnative.dev/docs/0.86/share.
- Limites : callbacks et propriétés React vérifiés, aucun partage natif ni livraison à un destinataire prouvés. Une opération serveur déjà engagée n’est pas annulée. Aucun serveur/règle, build, distribution, déploiement ou dépense.

## 2026-10-20 — 17:47 Europe/Brussels — Noms accessibles des couleurs

- Base : `2846b0bec03e12da442f63fe28b9ba2efadcf3a1`. Les sept pastilles de membre annonçaient uniquement un code hexadécimal, peu utile au lecteur d’écran ; sept assertions de noms compréhensibles rouges avant correction.
- Palette extraite avec ses noms français, valeurs/ordre strictement conservés et réexport compatibles depuis theme. ColorPicker annonce le nom connu ; valeur inconnue conservée explicitement, casse ignorée pour le nom seulement. Sélection et valeur transmises inchangées.
- Preuves : sept cas rouges puis verts, trois contrôles de compatibilité ; 115 tests ciblés réussis en 1,816 s, lint/TypeScript et diff propres. Aucun écran à image absente simulé.
- Limites : propriétés accessibles vérifiées, prononciation/navigation VoiceOver et TalkBack non essayées. Aucune migration, build, distribution, dépense ni donnée utilisateur modifiée.
