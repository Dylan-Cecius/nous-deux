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

23 tests de l'app et 16 scénarios serveur/règles couvrent notamment les accès interdits, les usages partagés autorisés, les courses entre invitations/réponses, les quotas, le consentement, la réauthentification, la reprise après panne Storage, une migration exécutée deux fois et la récupération d'une session dont l'espace a été corrigé côté serveur.

## Activation sur un projet existant

Cette version exige une mise à jour coordonnée de l'app, des fonctions et des règles. Une simple mise à jour d'Expo ne suffit pas. Les anciens codes de couple deviennent inutilisables ; les membres existants restent associés. Pour changer de téléphone, utiliser la connexion par e-mail.

1. Se connecter au compte administrateur du projet avec le CLI (`firebase login`) et vérifier le projet sélectionné explicitement. Les fonctions nécessitent un projet disposant de la facturation appropriée ; ne pas activer de forfait payant implicitement.
2. Faire une sauvegarde Firestore/Storage dans l'environnement du propriétaire. Préparer une fenêtre de mise à jour et arrêter les anciens clients pendant le basculement.
3. Compiler et déployer les fonctions de sécurité avec l'entrée indépendante des services facultatifs. Le CLI analyse aussi les paramètres des fonctions non sélectionnées : l'entrée `core.ts` évite donc d'exiger les clés Anthropic/Places pour sécuriser l'app.

   ```sh
   npm --prefix functions run build
   node functions/scripts/stage-security.cjs
   node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.security.json --project nous-deux-80525 --only functions:createCouple,functions:createInvitation,functions:joinCouple,functions:submitDailyAnswer,functions:setAiConsent,functions:registerPushToken,functions:notifyPartner,functions:deleteAccount,functions:retryAccountDeletions
   ```

   Le filtre explicite conserve les éventuelles fonctions facultatives déjà déployées. Déployer `assistant` et `searchPlaces` depuis `firebase.json` lorsque leurs secrets sont configurés.
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

## Déploiement vérifié le 14 octobre 2026

Les neuf fonctions de sécurité sont déployées sur `nous-deux-80525`, en `europe-west1` avec Node 22. Les règles Firestore et Storage sont actives et la migration a été appliquée. Le nettoyage des anciennes images de conteneur est configuré à sept jours ; il ne concerne pas les photos de l'app.

Une sauvegarde complète des données et des anciennes règles a été conservée sur l'ordinateur du propriétaire avant la migration. Un doublon entièrement vide a été retiré ; l'espace contenant les données a été conservé et son index utilisateur réparé. Les deux comptes existants, les cinq documents de contenu et la photo ont été vérifiés après migration ; le fichier photo est identique à sa sauvegarde. Le jeton push existant a été déplacé dans l'espace privé de son propriétaire.

Huit parcours ont ensuite été vérifiés sur le vrai service avec trois comptes temporaires : exclusion d'un tiers, invitation à usage unique, protection des profils, réponses privées puis révélées, consentement révocable, confidentialité d'une photo, suppression d'un membre sans supprimer le partenaire, puis suppression du dernier membre. Les comptes et données de test ont été nettoyés ; aucune suppression n'était en attente à la fin du contrôle.

La copie de travail du propriétaire contient les corrections et le serveur Expo Go a été redémarré. Le manifeste iOS et le bundle ont répondu avec succès. L'export web, le lint et les vérifications TypeScript passent également. Le parcours visuel sur un téléphone reste à vérifier.

Les fonctions facultatives `assistant` et `searchPlaces` ne sont pas déployées : leurs clés Anthropic et Google Places restent à configurer. Cette activation de la sécurité ne constitue pas une publication sur les stores.
