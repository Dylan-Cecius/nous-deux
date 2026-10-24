# Préparation de mise à niveau serveur — 24 octobre 2026, 13:25 UTC+01:00

**État : préparé, non déployé.** Base GitHub `ee7b3012544b9dd5283eed070ceb88ddbfca9633`, PR #3 ouverte/en brouillon.

## Vérifications effectuées

- Console Firebase du projet `nous-deux-80525` accessible avec la session existante, sans consultation des documents, comptes utilisateurs ou photos.
- Dix fonctions présentes dans le tableau de bord : createCouple, joinCouple, createInvitation, submitDailyAnswer, setAiConsent, registerPushToken, notifyPartner, deleteAccount, retryAccountDeletions, cleanupTechnicalData. recordSettlement n'apparaît pas dans cet inventaire. L'inventaire ne prouve pas le contenu exact des révisions déjà déployées.
- Offre affichée : **Blaze via essai sans frais**, 80 jours et **264 €** de crédit restants, échéance affichée 13 janvier 2027. Le panneau demande de passer explicitement à un compte payant pour poursuivre ensuite ; aucun changement d'offre effectué.
- La documentation officielle https://cloud.google.com/signup-faqs indique qu'un compte d'essai n'est pas facturé sans passage manuel à un compte payant. Cette observation lève l'incertitude financière pour les services couverts pendant cet essai, sans autoriser achat, activation payante ou dépassement ultérieur. Revérifier le statut juste avant une opération.
- Compilation functions : code retour 0. `stage-security.cjs` exécuté localement ; fichiers src/lib identiques à la source compilée et entrée `lib/core.js` vérifiée. Le paquet n'exporte pas les fonctions optionnelles IA/Places ni associateMemory.
- Les 67 tests de sécurité et 11 gardes réussis plus tôt le même jour restent la preuve applicable aux sources inchangées (SECURITY-VALIDATION.md). Ils n'ont pas été répétés. Node 22 de production reste distinct de Node 24 du banc.
- Le CLI de ce runtime ne possède aucun compte Firebase connecté (`login:list --json` : résultat vide), aucun FIREBASE_TOKEN ni chemin ADC configuré.
- Cloud Shell intégré puis ouverture directe affichent tous deux **Site Unavailable / Unable to access this site**. Ce constat concerne ce navigateur, pas une panne générale de Google ; aucune tentative de contournement.
- Le plugin officiel Firebase a été trouvé disponible mais non installé. Installation/connexion proposée au propriétaire ; aucune connexion supposée acquise.

## Lot candidat et limites

Après accès de déploiement autorisé, vérifier les révisions en ligne, puis appliquer uniquement les fonctions nécessaires : createCouple, joinCouple, deleteAccount, retryAccountDeletions et recordSettlement. La fonction planifiée de reprise partage le mécanisme de suppression ; ne pas la laisser sur une version incompatible avec les nouvelles données privées.

Commande candidate **non exécutée**, à réévaluer après inventaire des révisions et prérequis du protocole :

```sh
firebase deploy --config firebase.security.json --project nous-deux-80525 --only functions:createCouple,functions:joinCouple,functions:deleteAccount,functions:retryAccountDeletions,functions:recordSettlement
```

Ne pas déployer les règles Firestore durcies dans ce lot : elles refusent le chemin de remboursement des anciens clients. Vérifier la transition et la conservation des reçus selon SETTLEMENT-PROTOCOL.md avant mise en service/distribution. La préparation des fonctions seule ne donne pas de garantie globale d'idempotence tant que les anciens ajouts directs restent possibles. Aucun assouplissement de règle ni migration de données n'est prévu.

Après déploiement autorisé : lire les métadonnées de réussite, région, runtime, fonctions et révisions ; ne pas utiliser de données réelles pour des appels de test. La disponibilité du backend ne prouve pas le fonctionnement natif. Aucun compte, invitation, message ou notification de test à créer en production.

## Empreintes locales du paquet préparé

- lib/core.js : `1abdef61d9124deabc77b1b7416f67abc3ad7f985c7cee117f433ce7cc4bed6d`
- lib/security.js : `cebd472e9541f22d1e863e8a5d72acfff772fcd4631c95350dd8bdc7a22806db`
- lib/settlements.js : `e06ef4fe181f306b7c43d94b0632a9b8d599098e66838d1912eb217e007e1507`

Le dossier généré reste ignoré par Git et n'est pas supposé persistant. Les sources et le script de préparation sont versionnés et permettent sa reconstruction. Aucun secret ni binaire ajouté au dépôt.

Aucun déploiement, build EAS, envoi TestFlight, achat, activation payante ou réactivation d'automatisation effectué.
