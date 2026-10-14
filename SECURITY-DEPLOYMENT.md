# Correctifs avant bêta — 14 octobre 2026

## Ce qui change

- Les identifiants d'espace ne sont plus des codes d'accès. Le serveur émet une invitation aléatoire de 10 caractères, valable 24 heures, utilisable une fois ; un renouvellement annule l'ancienne.
- La création et l'association des comptes passent par des transactions serveur. Les membres et l'index utilisateur ne sont plus modifiables par l'app.
- Les règles refusent les lectures par un tiers, les modifications du profil du partenaire, l'usurpation d'auteur et les champs inconnus. Les listes et l'agenda restent collaboratifs.
- La première réponse quotidienne est stockée dans l'espace privé de son auteur. Seul le serveur publie les deux réponses après leur réception. Le statut partagé contient uniquement les identifiants des personnes ayant répondu.
- La déconnexion appelle Firebase Auth et retire la session locale ainsi que les rappels locaux. Un compte anonyme doit être associé à un e-mail avant de pouvoir se déconnecter.
- La suppression demande une réauthentification aux comptes par mot de passe, bloque immédiatement le compte et journalise le travail avant de l'exécuter. Elle nettoie le profil, les réponses, notes, cadeaux, souvenirs/photos de l'auteur, l'index et Firebase Auth. Les éléments partagés conservés perdent son identifiant d'auteur ; le dernier départ supprime tout l'espace. Un échec est repris automatiquement chaque heure. Le partenaire conserve un accès en lecture pendant le nettoyage.
- Les jetons push sont privés. Le serveur envoie uniquement des messages génériques, sans le texte des mots doux.
- L'assistant exige un accord explicite, révocable, avant l'envoi de la demande ou de la photo à Anthropic. Les prénoms du couple ne sont plus ajoutés automatiquement. Les appels IA et Places ont des quotas atomiques par utilisateur, par couple et globaux, ainsi que des limites de taille.

## Validation reproductible

Prérequis : Node 22.13+ et Java 17 pour la version du CLI verrouillée dans `functions/package-lock.json`.

```sh
npm ci
npm --prefix functions ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run test:security
npx expo export --platform web
```

Le CLI Firebase est une dépendance de développement ; il n'est pas embarqué dans les fonctions déployées. Les tests serveur utilisent exclusivement `demo-nous-deux-security` avec les émulateurs Auth, Firestore et Storage. Ils refusent de démarrer sans ces émulateurs. Aucun appel à Anthropic, Places ou Expo Push n'est nécessaire aux tests.

22 tests de l'app et 16 scénarios serveur/règles couvrent notamment les accès interdits, les usages partagés autorisés, les courses entre invitations/réponses, les quotas, le consentement, la réauthentification, la reprise après panne Storage et une migration exécutée deux fois.

## Activation sur un projet existant

Cette version exige une mise à jour coordonnée de l'app, des fonctions et des règles. Une simple mise à jour d'Expo ne suffit pas. Les anciens codes de couple deviennent inutilisables ; les membres existants restent associés. Pour changer de téléphone, utiliser la connexion par e-mail.

1. Se connecter au compte administrateur du projet avec le CLI (`firebase login`) et vérifier le projet sélectionné explicitement. Les fonctions nécessitent un projet disposant de la facturation appropriée ; ne pas activer de forfait payant implicitement.
2. Faire une sauvegarde Firestore/Storage dans l'environnement du propriétaire. Préparer une fenêtre de mise à jour et arrêter les anciens clients pendant le basculement.
3. Compiler et déployer les fonctions de sécurité. Les fonctions `assistant` et `searchPlaces` nécessitent leurs secrets existants. Elles peuvent être déployées séparément si les services facultatifs ne sont pas configurés.
4. Fournir au script de migration des identifiants administrateur via Application Default Credentials. La connexion du CLI Firebase seule ne fournit pas nécessairement ces identifiants au SDK Admin. Ne jamais mettre une clé de service dans le dépôt ou dans `EXPO_PUBLIC_*`.
5. Exécuter la simulation, qui ne modifie rien :

   ```sh
   npm --prefix functions run migrate:security -- --project nous-deux-80525
   ```

   Tout conflit d'index, profil invalide ou suppression en cours arrête le préflight. Vérifier ces cas avant de poursuivre.

6. Déployer les règles Firestore et Storage de cette version pour fermer les anciennes écritures, puis appliquer la migration :

   ```sh
   firebase deploy --project nous-deux-80525 --only firestore:rules,storage
   npm --prefix functions run migrate:security -- --project nous-deux-80525 --apply
   ```

   La migration ne remplace pas une réponse déjà présente au nouvel emplacement et peut être relancée. Les anciens documents `answers` sont conservés, mais leurs lectures/écritures clientes sont interdites ; la suppression de compte les nettoie également. Les jetons push sont déplacés hors du document partagé.

7. Lancer l'app mise à jour ou distribuer les nouveaux builds. Vérifier sur deux appareils de test : invitation, inscription/connexion, réponse cachée puis révélée, photo, modification partagée, déconnexion et suppression d'un compte de test. Ne pas tester une suppression sur les comptes réels du couple.
8. Surveiller les erreurs et les tâches `accountDeletions` encore `pending`. L'ordonnanceur `retryAccountDeletions` doit être actif et ses erreurs surveillées. Une tâche terminée conserve uniquement un journal technique minimal (identifiant, espace, dates et état).

Ne pas restaurer les anciennes règles permissives pour contourner une erreur. En cas d'échec de migration, maintenir les anciennes écritures bloquées, corriger la cause et reprendre.

## Limites à connaître avant publication

- Ce changement n'est pas un chiffrement de bout en bout. Les URL Firebase de téléchargement restent des liens porteurs d'un jeton ; ne pas les journaliser ni les publier. La suppression retire les fichiers appartenant au compte, mais ne peut pas effacer les copies déjà téléchargées par quelqu'un.
- Les quotas limitent les appels payants aux fournisseurs ; ils ne constituent pas un plafond de facturation Firebase. App Check et les alertes de budget doivent être configurés pour les builds distribués. App Check n'est pas activé par ces modifications, afin de ne pas prétendre à une attestation absente d'Expo Go.
- La politique de confidentialité publique, les déclarations des stores, le parcours web de demande de suppression exigé par Google Play et les vérifications sur appareils réels restent des étapes de publication distinctes.

Au moment de la validation locale, le CLI du PC ne disposait d'aucun compte Firebase connecté : les corrections et la migration n'ont donc pas été appliquées à `nous-deux-80525`.
