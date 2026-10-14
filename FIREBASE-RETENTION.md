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

- Vérifier les copies de maintenance sur MSI et leur procédure de conservation.
- Définir la conservation des demandes d’assistance et une procédure de nettoyage correspondante.
- Compléter l’identité légale de l’éditeur et les mentions applicables.
- Garder `retentionVerified: false` et la publication en brouillon tant que ces éléments ne sont pas résolus.

## Références techniques

- Firestore, métadonnées de base : https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases
- Cloud Storage, politiques de bucket : https://docs.cloud.google.com/storage/docs/json_api/v1/buckets
- Cloud Logging, liste des buckets : https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/projects.locations.buckets/list
- Fonctions planifiées : https://firebase.google.com/docs/functions/schedule-functions
