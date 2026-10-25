# Validation de sécurité — 24 octobre 2026

## Actualisation du 25 octobre 2026 — Node 22

Source `c735fff1c66ca95f1d3a280372a92a056c272f35`, 202 blobs vérifiés, dont les ressources binaires originales. À **22:19–22:20 Europe/Brussels (UTC+01:00)**, une nouvelle copie isolée sans credentials a été compilée et testée avec **Node 22.23.4**, la version majeure déclarée pour le serveur : **11/11 gardes et 67/67 tests de sécurité réussis**, zéro échec/ignoré. Suite de sécurité 33,618 s ; compilation et émulateurs compris 52,86 s, code 0. Les cinq ports sont fermés après arrêt.

Archive Linux officielle Node 22.23.4 comparée à `https://nodejs.org/dist/v22.23.4/SHASUMS256.txt` : SHA-256 `1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce`. Les deux JAR ont été revérifiés aux empreintes ci-dessous. Garde réseau recompilé, autocontrôle Node effectué : loopback accepté, IPv4/IPv6 externes et résolution non locale refusées. Même séparation par projet demo, copie dédiée, environnement explicite et garde processus ; **pas de confinement réseau noyau**. Cette exécution locale sous Node 22 ne reproduit pas toute la plateforme Cloud Functions.

Preuves : `docs/security-evidence/2026-10-25/` (résultat, journal, empreintes, autocontrôle, configuration, script d'exécution et source du garde). Première préparation arrêtée avant les tests : l'extraction de l'archive avait retiré les bits exécutables ; droits d'exécution restaurés uniquement sur les binaires locaux téléchargés et vérifiés. Aucun déploiement, appel réel, migration ou changement serveur/règles. Les résultats du 24 octobre restent historiques.

## Résultat du 24 octobre

Code contrôlé : `921721ce125aeb8ee1c3e71c1e8a51896920f6c2`, branche `feat/privacy-support-pages`, PR #3 ouverte et en brouillon. Les 192 blobs du checkout ont été comparés aux SHA GitHub avant exécution : aucune différence.

Exécution le 24 octobre 2026 vers 12:11 UTC (13:11 UTC+01:00) :

- compilation TypeScript des fonctions : code retour 0 ;
- protection de l'environnement (`emulator-guard.test.cjs`) : **11/11 réussis**, aucun échec/ignoré ;
- sécurité sur Auth, Firestore et Storage locaux (`security.test.cjs`) : **67/67 réussis**, aucun échec/ignoré, 32,939 secondes ;
- commande complète, compilation et démarrage/arrêt compris : **44,64 secondes**, code retour 0 ;
- lint applicatif et TypeScript `--noEmit` : codes retour 0 ;
- après arrêt : ports 9098, 8088, 9198, 4400 et 4500 fermés.

Les erreurs `PERMISSION_DENIED` visibles dans le journal correspondent aux opérations interdites attendues par `assertFails`. Le bilan final de la suite est vert. La suite couvre notamment l'isolation des membres/tiers, les règles Storage, les invitations concurrentes/expirées, les réponses privées, les reçus de remboursement et de souvenir, les gardes d'identité, la suppression/reprise et la migration. Ce périmètre ne constitue pas un audit exhaustif.

## Environnement et séparation

- Projet exclusivement fictif : `demo-nous-deux-security`. Aucun projet Firebase créé ni connexion de compte effectuée.
- Copie distincte des seules sources nécessaires, règles et tests ; aucun `.env`, `.firebaserc`, secret ou configuration de production copié. Les sources copiées sont identiques à celles contrôlées ; empreintes dans `source-sha256.json`.
- Environnement des processus recréé par liste explicite, répertoire utilisateur/configuration dédié sans compte, chemin de credentials volontairement inexistant, métadonnées redirigées vers loopback. Dépendances déjà installées réutilisées, sources recompilées dans la copie.
- Tous les émulateurs configurés sur `127.0.0.1`. Le garde existant refuse un projet différent et les endpoints distants avant import des SDK. Un garde additionnel `LD_PRELOAD` refuse les connexions/résolutions non locales des exécutables dynamiques utilisés.
- Autocontrôle du garde additionnel : connexion loopback acceptée ; connexions IPv4 `192.0.2.1` et IPv6 `2001:db8::1` refusées avec EPERM ; résolution `example.invalid` refusée. Ces adresses sont des valeurs de test.
- La requête facultative du CLI vers `firebase-public.firebaseio.com/cli.json` a été refusée par le garde (résolution bloquée), puis le CLI a continué normalement avec la configuration de démonstration. Aucun téléchargement pendant les tests.
- Uniquement les comptes, documents et fichiers fictifs construits par les tests ; aucun compte réel, invitation envoyée, e-mail, notification réelle, paiement, build ou déploiement.

Limite importante : ce runtime interdit `unshare --net` et le traçage `ptrace/strace` ; Landlock n'y est pas disponible. Il ne s'agit donc **pas d'un réseau séparé au niveau noyau ni d'un confinement de code hostile**. Le garde LD_PRELOAD est une protection supplémentaire pour les processus Node/Java de confiance ; il ne remplace pas un pare-feu noyau. La séparation repose également sur le projet demo sans ressource réelle, la copie sans credentials et le garde SDK. Aucun audit système exhaustif des paquets n'est revendiqué.

## Préparation des binaires

La tentative antérieure via le CLI complet avait été refusée par le contrôle automatique. Cette exécution sépare les phases : récupération uniquement des deux fichiers publics, sans SDK/CLI Firebase, identifiant de projet, authentification ni données du dépôt dans la requête ; puis tests dans la copie dédiée avec garde réseau actif. Aucun changement des permissions du runtime.

Versions et intégrité contrôlées selon les métadonnées du `firebase-tools` installé :

| Émulateur | Version | Taille | SHA-256 |
| --- | --- | --- | --- |
| Firestore | 1.19.8 | 63634791 | `9d43599ed6151199e8d604dc87fac51218e49e5f3a48519b1ae560bbe5e3382d` |
| Storage Rules | 1.1.3 | 52892936 | `0cd52db6f6271d62078f805220706377c849220b73bd68aa27078d977df9c900` |

Sources publiques utilisées :
- https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.8.jar
- https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-storage-rules-runtime-v1.1.3.jar

Aucun binaire ni dépendance ajouté au dépôt. Node 24.22.1, Java 17.0.20 ; le paquet functions demande Node 22 : cette exécution n'est pas une validation de la plateforme de production Node 22.

## Preuves conservées

Sous `docs/security-evidence/2026-10-24/` : journal complet `result.log`, bilan `result.json`, configuration locale `firebase.json`, empreintes des sources, source du garde et `run-record.py` (commande exacte exécutée). Le script est une **trace de cette exécution**, avec chemins absolus de ce runtime, pas un installateur portable. Les chemins temporaires ne sont pas supposés persistants ; reconstruire une copie vérifiée et adapter les chemins pour rejouer. Vérifier les empreintes des deux binaires avant toute reprise, compiler le garde avec GCC, répéter son autocontrôle, puis lancer le CLI uniquement avec la configuration demo/loopback et l'environnement nettoyé consignés.

Documentation de référence : https://firebase.google.com/docs/emulator-suite/use_hosting (distinction projets réels/demo) et https://firebase.google.com/docs/emulator-suite/install_and_configure (suite et cache des binaires).

## Ce que cela débloque — et ce qui reste

La preuve historique du 15 octobre est remplacée, pour ce SHA et ce périmètre, par cette nouvelle exécution complète. Aucun correctif serveur/règle n'a été nécessaire pour obtenir le résultat.

Avant TestFlight restent distinctement requis : compatibilité et déploiement coordonné serveur/client/règles, accès Expo/Apple et preuve actuelle d'absence de coût supplémentaire. Les tests appellent les handlers locaux et les émulateurs ; ils ne prouvent pas le déploiement, le transport callable sur appareil, les notifications réelles ou l'état Apple. Les essais natifs suivent une build autorisée et compatible. Les exigences des pages publiques, les fonctions payantes désactivées et les limites de confidentialité restent inchangées. Aucune nouvelle build envoyée et aucune automatisation réactivée.
