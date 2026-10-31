# Import local d’un planning photographié

**31 octobre 2026 : build iOS 1.0.0 (8) compilée et envoyée à Apple avec succès.** La version 7 ne contient pas cette fonction. La disponibilité de la 8 dans TestFlight reste à confirmer ; la lecture photo et sa précision doivent encore être essayées sur iPhone. Voir TESTFLIGHT-REVIEW.md et docs/release-evidence/2026-10-31-photo/.

## Parcours

Agenda → Importer mon planning en photo → appareil photo ou galerie → choisir la personne → vérifier la semaine/année de référence → corriger le texte extrait → confirmer les dates, heures et personne → ajouter les créneaux.

Le bouton est indépendant de l’assistant IA, qui reste désactivé. Sur une ancienne build, dans Expo Go ou sur web, la lecture native manque : diagnostic explicite et possibilité de coller le texte. Aucun appel Anthropic, Cloud Vision, Places ou autre API facturée.

Formats reconnus (une date par ligne) :

```text
Lundi 9h-12h 13h30-17h
03/11/2026 10:00-18:00
2026-11-04 09:00-17:00
Jeudi repos
```

Un jour sans date utilise la semaine choisie. Une date sans année utilise l’année choisie : elle n’est pas reportée automatiquement sur l’année suivante. Un jour de semaine incompatible avec une date explicite est refusé. Les dates impossibles, heures ambiguës, nuits traversant minuit et lignes non reconnues bloquent l’ajout jusqu’à correction. Limite de 52 créneaux distincts et 12 000 caractères ; pas de troncature silencieuse.

Photographier/recadrer une seule personne et retirer les autres noms. Les tableaux à plusieurs colonnes ne sont pas reconstruits automatiquement : les heures peuvent devoir être replacées sur la ligne de leur date dans le texte modifiable. La reconnaissance manuscrite et les photos difficiles ne sont pas garanties. Une photo ne déclenche jamais directement une écriture sans revue.

## Partage et protection des écritures

En mode cloud, tous les événements sont sous `couples/{coupleId}/events` et les deux membres s’abonnent à cette même collection. `who` désigne la personne concernée ; ce n’est pas un filtre de confidentialité. Les membres peuvent modifier les événements communs. En mode local, aucun partage entre téléphones : un message le précise dans l’agenda et dans l’import.

L’import utilise `backend.addEvents` en un lot, uniquement si la collection est lisible et la personne toujours membre. Il ignore les créneaux de travail exactement identiques pour cette personne, dans le document et dans le dernier état reçu. Il ne supprime ni n’écrase les événements existants. Les chevauchements différents restent possibles, comme dans l’agenda manuel.

Double appui bloqué ; confirmation invalidée après correction ; anciennes actions et réponses photo ignorées après changement de session/fermeture. Après un échec d’écriture, aucun rejeu dans le formulaire : vérifier l’agenda actualisé avant de rouvrir un import. La déduplication côté client n’est pas une garantie globale contre deux imports simultanés depuis deux appareils ; aucun protocole serveur d’idempotence n’a été ajouté.

## Reconnaissance native et confidentialité

Module Expo local `modules/schedule-ocr`, détecté par l’autolinking Apple et Android du SDK 57. Apple Vision sur iOS ; modèle latin ML Kit embarqué `com.google.mlkit:text-recognition:16.0.1` sur Android, sans téléchargement de modèle à l’exécution. Le module refuse les URL réseau. Le code n’envoie ni la photo ni le texte OCR à Firebase/une IA ; seuls les événements confirmés sont enregistrés. Aucun journal de contenu OCR. Photo sélectionnée gérée par le cache du sélecteur système ; ne pas prétendre à son effacement immédiat ni à une durée de purge. Texte du brouillon uniquement en mémoire, perdu à la fermeture.

La dépendance expo-text-extractor 2.0.0 a été évaluée puis retirée : son script Gradle attend un fichier absent d’Expo Modules Core SDK 57. Aucun changement final de package.json/package-lock.json ; module local avec le plugin Gradle actuel. Les permissions caméra/photos mentionnent maintenant la lecture locale du planning ; microphone toujours désactivé.

Sources techniques consultées via leur dépôt officiel (le site de documentation renvoyait une erreur d’accès) :
- https://github.com/expo/expo/blob/main/docs/pages/versions/v57.0.0/sdk/imagepicker.mdx
- https://github.com/expo/expo/blob/main/docs/pages/modules/get-started.mdx
- https://github.com/expo/expo/blob/main/docs/pages/modules/module-api.mdx
- https://github.com/googlesamples/mlkit/blob/master/android/vision-quickstart/app/build.gradle

## Contrôles et limites

- Suite applicative : 70 suites / 1 868 tests réussis ; lint et TypeScript réussis. Contrôles ciblés rejoués après les derniers gardes de confirmation/rejeu.
- Emulateurs `demo-nous-deux-security`, Node 22.23.4 : 68 tests sécurité + 11 gardes réussis. Nouveau test : Alice écrit pour Bob, Bob reçoit le lot en temps réel, Bob modifie et Alice relit ; tiers et anonyme refusés. Aucun compte réel ni règle modifiée. Preuves : `docs/security-evidence/2026-10-30-agenda/`.
- Export JavaScript iOS hors ligne réussi, Firebase vide et fonctionnalités payantes fausses. Résolution des modules natifs réussie pour Apple et Android. Cela **ne compile pas** Swift/Kotlin et ne valide pas la précision OCR.
- Le 31 octobre, compilation native iOS réussie via EAS Free, puis envoi Apple réussi, version 1.0.0 (8). Android natif non compilé ; aucun appareil physique essayé. Aucun changement de forfait, dépense, OTA, fusion, notification ou ajout de testeur.

Recette de la bêta iOS et prérequis avant validation générale : essai photo/galerie sur appareils (rotation, refus d’accès, image illisible, tableau, texte imprimé et écrit à la main, annulation), puis deux comptes de démonstration rattachés au même espace pour observer l’ajout partagé. Aucun compte intime réel pour cette recette. Vérifier à nouveau le coût nul avant toute build distante.
