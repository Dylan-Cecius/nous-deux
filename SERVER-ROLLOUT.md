# Mise à niveau serveur — 24 octobre 2026, 12:53 UTC

**État : quatre fonctions existantes mises à jour, recordSettlement créée et active ; nouveau client et règles durcies non distribués.**

Projet `nous-deux-80525`, région `europe-west1`, Node.js 22. Code issu de `9a98c3a0b067657a1461669ca4fa23d7ab8825fe` ; les commits suivants avant ce déploiement ne changent que la documentation. PR #3 ouverte/en brouillon, aucune nouvelle build TestFlight.

## Déploiement réalisé

| Fonction | Révision active vérifiée | Mise à jour selon Google (UTC) |
| --- | --- | --- |
| createCouple | createcouple-00002-pop | 2026-10-24T12:51:06.068495732Z |
| deleteAccount | deleteaccount-00002-rec | 2026-10-24T12:51:06.019269242Z |
| joinCouple | joincouple-00002-yib | 2026-10-24T12:51:05.761580052Z |
| retryAccountDeletions | retryaccountdeletions-00002-gim | 2026-10-24T12:51:06.982292551Z |

Commande effectuée depuis le CLI Firebase authentifié sur MSI, à la demande explicite du propriétaire :

```sh
firebase deploy --config firebase.security.json --project nous-deux-80525 --only functions:createCouple,functions:joinCouple,functions:deleteAccount,functions:retryAccountDeletions --non-interactive
```

Code retour **0**, durée du processus **78,68 secondes**. Les quatre opérations de mise à jour ont réussi ; lecture de l'API après déploiement : état ACTIVE, nouvelles révisions, même région/runtime, mémoire, limites d'instances et délais. Les six autres fonctions ont des métadonnées inchangées. Le job existant de reprise reste ENABLED, every 60 minutes, UTC. Aucun appel de test à une fonction réelle ni déclenchement manuel du job.

Preuve filtrée et comparaison avant/après : [docs/deployment-evidence/2026-10-24/functions.json](docs/deployment-evidence/2026-10-24/functions.json). Aucun environnement secret ni credential dans ce fichier. Les dates checkedAt proviennent de l'horloge de MSI, décalée d'une heure par rapport aux dates fournisseur ; les updateTime Google ci-dessus font référence pour le déploiement.

## Contrôles et coût

- Paquet transféré avec SHA-256 de l'archive et 21 fichiers du manifeste vérifiés ; les 20 blobs source/documentation ont été comparés à GitHub.
- Compilation et staging sous Node **22.23.4** réussis. Node portable officiel vérifié par SHASUMS256 ; Node global inchangé. Predeploy recompilé avec ce même runtime.
- Tests applicables aux sources inchangées : **67 tests de sécurité sur les vrais émulateurs demo-nous-deux-security + 11 gardes**, réussis le 24 octobre ; voir SECURITY-VALIDATION.md pour leur environnement Node 24 et les limites d'isolation. Cette compilation Node 22 ne constitue pas une nouvelle exécution des émulateurs sous Node 22.
- Console Firebase rechargée juste avant l'opération : **Blaze | Essai sans frais**, **264 €** et **80 jours** restants. Absence de facturation sans passage manuel au payant documentée sur https://cloud.google.com/signup-faqs ; aucun passage au payant, achat ou hausse de budget. L'opération peut consommer le crédit d'essai.
- L'accès par Cloud Shell du navigateur de l'agent restait indisponible ; connexion CLI rétablie sur MSI après validation Google par le propriétaire. Les diagnostics doivent respecter la protection des secrets ajoutée à AUTONOMY.md.

## Limites et suite

- `recordSettlement` est déployée et ACTIVE depuis le 24 octobre à 13:58:49 UTC, révision `recordsettlement-00001-sos`. Conservation confirmée et décrite dans l’aide et la politique en brouillon ; cette préparation ne constitue pas leur publication ni une validation juridique. Aucun compte réel utilisé pour tester.
- Les règles Firestore/Storage **n'ont pas été modifiées**. Les règles durcies de remboursement bloqueraient les anciens ajouts directs : transition de versions et essais restent nécessaires. Aucune garantie globale d'idempotence n'est revendiquée pendant cette transition.
- Les gardes expectedUserId de création/jonction/suppression sont désormais dans les révisions déployées ; le champ reste facultatif pour les anciens clients. Les tests de contrat disponibles restent simulés/émulés, pas des essais sur les comptes réels.
- `assistant`, `searchPlaces` et `associateMemory` restent non activés. Aucun message, invitation, compte de test ou suppression réelle déclenché pour cette vérification.
- Avant TestFlight : terminer les prérequis du nouveau protocole, préserver la preuve actuelle de gratuité EAS et vérifier les accès de soumission, puis exécuter les recettes nécessaires. Aucune nouvelle build, soumission ou validation Apple ; `publicationStatus: draft` et `retentionVerified: false` restent inchangés.

## Empreintes du code compilé contrôlé

- core.js : `1abdef61d9124deabc77b1b7416f67abc3ad7f985c7cee117f433ce7cc4bed6d`
- security.js : `cebd472e9541f22d1e863e8a5d72acfff772fcd4631c95350dd8bdc7a22806db`
- settlements.js : `e06ef4fe181f306b7c43d94b0632a9b8d599098e66838d1912eb217e007e1507` (compilé, fonction désormais active)

## Complément — recordSettlement, 24 octobre 2026, 14:58 UTC+01:00

Confirmation explicite du propriétaire pour conserver les reçus jusqu’à la suppression du compte concerné ou de l’espace ; information intégrée au checkpoint 364ce5c. Sources serveur inchangées, manifeste 21 fichiers revérifié sur MSI, compilation/staging predeploy Node 22.23.4 réussis.

Commande ciblée : `firebase deploy --config firebase.security.json --project nous-deux-80525 --only functions:recordSettlement --non-interactive`. Création réussie, code 0, 113,33 secondes. Première tentative d’exécuter un fichier PowerShell refusée par la politique du poste avant lancement du CLI ; commandes exécutées ensuite directement dans le terminal autorisé, sans changement de politique système.

Vérification API distincte : 11 fonctions, nouvelle fonction ACTIVE/Node 22, 256 MiB, 60 secondes, min 0/max 3 ; dix fonctions antérieures strictement identiques. Release Firestore inchangée depuis le 14 octobre : reçus privés refusés par défaut, ancien ajout direct de marques encore possible. Pas de publication des règles. Preuve : [settlement.json](docs/deployment-evidence/2026-10-24/settlement.json). Les checkedAt du PC gardent leur décalage d’une heure ; updateTime Google fait référence.

Essai Firebase relu avant opération : 264 € / 80 jours, sans passage au payant. Accès EAS vérifié par `whoami`, puis `account:usage dylancecius --non-interactive` avec CLI 25.3.0 : offre Free, 2 builds/30, dont iOS 1/15, aucun dépassement. Période du 1er octobre au 1er novembre 2026 ; aucune build déclenchée. La documentation officielle https://docs.expo.dev/billing/plans/ précise que l’offre Free ne peut générer de dépassement facturé. Aucun abonnement, achat ou budget modifié.

Les tests de sécurité existants du 24 octobre restent applicables aux sources inchangées : 67 tests émulateurs + 11 gardes. La nouvelle vérification ne teste pas le transport HTTPS sur appareil. Politique publique complète, déclarations Apple, transition des anciennes versions et recettes natives restent nécessaires avant distribution ; aucun résultat TestFlight nouveau.
