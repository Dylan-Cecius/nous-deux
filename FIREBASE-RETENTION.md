# Conservation Firebase — vérification du 14 octobre 2026

Projet vérifié : `nous-deux-80525`. Lecture des paramètres via les API Google avec la session normale du CLI Firebase sur Hydan. Aucune clé ni aucun jeton n’a été exporté. Les réglages ci-dessous ont été lus, pas modifiés.

## Réglages observés

| Ressource | Résultat de la lecture |
| --- | --- |
| Firestore `(default)` | Région `eur3`, mode natif ; restauration PITR désactivée ; historique de versions lisible pendant `3600s` (1 heure). |
| Sauvegardes Firestore | Aucun planning de sauvegarde ni sauvegarde retourné par les API du projet lors de la vérification. Cela ne recense pas les exports ou copies manuels. |
| Photos, bucket `nous-deux-80525.firebasestorage.app` | Région `EUROPE-WEST1` ; suppression réversible pendant `604800s` (7 jours), politique effective depuis le 14 octobre 2026 à 09:51:47 UTC. Les champs versioning, retentionPolicy et lifecycle ne sont pas présents dans la réponse. |
| Cloud Logging `_Default` | 30 jours, bucket actif. |
| Cloud Logging `_Required` | 400 jours, bucket actif et verrouillé. Ne pas présenter ces journaux d’audit comme soumis à la purge applicative. |
| Reprise des suppressions | Job `firebase-schedule-retryAccountDeletions-europe-west1` activé, toutes les 60 minutes, fuseau UTC. |
| Copies de maintenance sur MSI | Poste hors ligne : inventaire et durée non vérifiés. Ne pas supprimer ces copies sans contrôle de leur contenu et de leur utilité. |

Ces observations ne constituent pas une promesse de destruction physique de toutes les copies chez les prestataires. Les délais propres à Firebase Authentication et les éventuels exports de journaux doivent être distingués des données actives de l’application.

## Nettoyage applicatif

Le code de `cleanupTechnicalData` traite uniquement les invitations expirées, les compteurs anti-abus expirés depuis 7 jours et les journaux de suppression achevée depuis 30 jours. Les documents sont relus en transaction. Le passage est borné à 500 documents par collection ; un arriéré ou une interruption peut donc retarder l’effacement.

La fonction a été déployée avec succès le 14 octobre 2026. L’API confirme `ACTIVE`, runtime `nodejs22`, région `europe-west1`, mise à jour à 21:53:20 UTC. Le job `firebase-schedule-cleanupTechnicalData-europe-west1` est `ENABLED`, planifié `every 24 hours` en UTC. Aucune autre fonction n’a été redéployée.

Un essai réel a créé six traces techniques fictives avec un identifiant unique, puis déclenché ce job par l’API Cloud Scheduler. La création utilisait la précondition `exists: false` pour ne jamais écraser un document existant.

- Exécution du 14 octobre 2026 à 21:53:49 UTC ; journal de succès à 21:53:50 UTC : 1 invitation, 1 compteur et 1 journal de suppression achevée supprimés.
- Vérification à 21:54:02 UTC : les quatre documents expirés attendus, dont le pointeur d’invitation, étaient absents ; les deux traces récentes étaient conservées.
- Les deux traces récentes fictives ont ensuite été retirées après contrôle de leur marqueur de test et de leur version. Une seconde lecture confirme qu’aucune des six traces de test ne subsiste.
- Aucun compte, espace de couple, contenu ou fichier photo n’a été créé ou parcouru par ce test. Les scénarios de concurrence et de tâches en cours restent couverts par les tests émulateurs existants.

La connexion Firebase sur Hydan est désormais opérationnelle. Une première exécution réussie ne garantit pas les exécutions futures ; surveiller les échecs du job et les arriérés avant de promettre une échéance maximale d’effacement.

## Points encore nécessaires pour la politique publique

### Stockage préparé le 15 octobre : reçus de marques informatives

Inventaire fondé sur `functions/src/settlements.ts`, `security.ts`, `retention.ts` et les règles de la branche, pas sur une lecture du projet réel. Actualisation du 24 octobre 2026 : recordSettlement déployée et vérifiée ACTIVE à 13:58:49 UTC après confirmation de la conservation. Aucun reçu réel n’a été créé ou lu par l’agent ; la présence éventuelle de reçus en production n’a pas été recensée. Les règles durcies et le nouveau client ne sont pas distribués.

| Donnée préparée | Usage et accès | Effacement observé dans le code |
| --- | --- | --- |
| `couples/{coupleId}/private/{uid}/settlementRequests/{requestId}` : empreinte SHA-256 du relevé, identifiant de marque, date serveur | Empêcher de rejouer une intention ; le chemin rattache le reçu au membre. Aucun titre ni montant en clair dans le reçu. Lecture/écriture via serveur seulement, pas d’accès direct depuis le client, même demandeur. Une empreinte et un identifiant liés au compte ne constituent pas une anonymisation. | Nettoyage récursif privé au départ du demandeur, ou de tout l’espace au dernier départ. Le reçu du partenaire restant est conservé. Retirer une marque ne retire pas son reçu : celui-ci empêche sa recréation par une ancienne demande. |
| `expenseSettlementRevision` dans le document couple | Compteur de sérialisation, sans copie du relevé ; lisible aux membres avec le couple et modifiable seulement par le serveur. | Supprimé avec l’espace au dernier départ ; pas de purge séparée. |
| Compteur anti-abus `settlements:{uid}` dans `rateLimits` (clé hachée par le mécanisme existant) | Limiter les tentatives, y compris les reprises ; même mécanisme serveur que les autres quotas. | Pris en charge par la purge technique existante des compteurs expirés, pas par une nouvelle durée. |

La purge quotidienne actuelle **ne parcourt pas ces reçus privés** : aucune expiration périodique n’est implémentée ni durée maximale promise. Le 24 octobre 2026, le propriétaire a confirmé explicitement la conservation des reçus de remboursement jusqu’à la suppression du compte concerné ou de l’espace du couple, conformément au nettoyage existant : départ du demandeur, conservation des reçus du partenaire restant, puis nettoyage global au dernier départ. Supprimer une marque ne supprime pas son reçu. Pas de purge périodique ni de délai maximal en jours ; les reprises du nettoyage restent possibles. Cette décision concerne les données actives du protocole de remboursement, pas les reçus de souvenirs, l’assistance, les sauvegardes ni une validation juridique. Un éventuel changement de durée devra préserver le contrat de reprise ou définir explicitement sa fenêtre. Les tests d’émulateurs vérifient départ individuel, conservation du partenaire et dernier départ, y compris reçus orphelins. Ils ne prouvent pas l’effacement de sauvegardes, journaux ou copies de prestataires.

### Conditions de publication restantes

Le module préparé `functions/src/memories.ts`, non exporté et non activé, ajouterait des reçus `couples/{coupleId}/private/{uid}/memoryRequests/{requestId}` : empreinte du contenu, identifiant de souvenir et date serveur. Ils empêchent une reprise de recréer une fiche supprimée. Aucune URL photo ni légende n’est copiée dans le reçu ; l’empreinte demeure rattachée au compte et n’est pas une anonymisation. Nettoyage privé au départ du demandeur, global au dernier départ, pas de purge périodique ni durée maximale décidée. Le compteur anti-abus `memory-associations:{uid}` utilise la purge technique existante. Ces données ne sont pas encore créées en production par ces travaux ; voir `MEMORY-PROTOCOL.md` et intégrer la conservation retenue avant toute activation.

- Vérifier les copies de maintenance sur MSI et leur procédure de conservation.
- Définir la conservation des demandes d’assistance et une procédure de nettoyage correspondante.
- Compléter l’identité légale de l’éditeur et les mentions applicables.
- Garder `retentionVerified: false` et la publication en brouillon tant que ces éléments ne sont pas résolus.
- Intégrer les reçus préparés et leur conservation effectivement retenue aux informations publiques et aux déclarations de la version concernée avant activation ; ne pas présenter ce stockage comme déjà déployé ou validé juridiquement.

## Références techniques

- Firestore, métadonnées de base : https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases
- Cloud Storage, politiques de bucket : https://docs.cloud.google.com/storage/docs/json_api/v1/buckets
- Cloud Logging, liste des buckets : https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/projects.locations.buckets/list
- Fonctions planifiées : https://firebase.google.com/docs/functions/schedule-functions
