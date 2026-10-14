# Pages de confidentialité, d’assistance et de suppression

État au 14 octobre 2026 : aperçu privé préparé. Coordonnées confirmées par l’éditeur : **XII Tech Studio**, **Rue de Jace 189, 4101 Jemeppe-sur-Meuse, Belgique**, **xiitechstudio@gmail.com**. La politique de conservation et les autres mentions légales applicables restent à finaliser. Ce document ne constitue pas une validation juridique ni une autorisation de publication publique.

## Source et génération

- `website/` contient les trois pages, leur style et la préparation locale des e-mails.
- `src/constants/public-info.json` centralise l’identité, le contact et les informations de publication.
- `npm run website:preview` génère un aperçu explicitement marqué comme brouillon, avec `noindex`.
- `npm run website:build` refuse de produire une version publique tant que les informations requises manquent. Le garde-fou vérifie leur présence, pas leur exactitude juridique.
- Les polices et le logo sont copiés depuis les dépendances et les ressources existantes ; leurs licences accompagnent la sortie. Exécuter `npm ci` avant une génération sur un nouveau poste.
- Les liens Web de l’écran Aide restent masqués lorsque le statut est `draft`. Le contact e-mail confirmé reste accessible indépendamment de ce statut. L’accès public effectif doit être vérifié avant de définir `publicationStatus` à `published` et de reconstruire l’app.

## Informations à confirmer avec l’éditeur

1. Nom commercial et adresse professionnelle confirmés ci-dessus. Vérifier la dénomination légale correspondante et compléter le numéro BCE et les autres mentions applicables avant publication.
2. Le contact d’assistance confirmé est `xiitechstudio@gmail.com`. Organiser sa consultation régulière et le traitement des demandes relatives aux données.
3. Durée de conservation des demandes d’assistance et organisation de leur effacement.
4. Périmètre réel des prestataires, garanties de transfert applicables et bases juridiques ; vérifier notamment le traitement des contenus intimes librement saisis et les règles d’accès liées à l’âge avant une diffusion publique.

Aucune autre adresse ne doit être réutilisée sans confirmation. Le formulaire prépare un message vers le contact confirmé ; son envoi reste à la charge de l’utilisateur dans sa messagerie. Aucun message de test n’a été envoyé par l’agent.

L’adresse fournie est intégrée à l’aperçu privé. Selon le SPF Économie, un site d’entreprise belge doit afficher l’adresse de son établissement : https://economie.fgov.be/fr/themes/line/commerce-electronique/vente-par-internet/site-dentreprise-et-comptes. Compléter également les informations légales applicables, dont le numéro BCE et les moyens de contact. Pour une distribution professionnelle sur l’App Store dans l’UE, Apple publie les coordonnées du professionnel ; un compte individuel peut utiliser une adresse ou une boîte postale justifiée pour cette exigence Apple. Cela ne dispense pas des obligations belges d’adresse d’établissement : https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements.

## Conservation : travail technique avant publication

Les invitations expirent fonctionnellement après 24 heures. Leur expiration ne démontre pas leur effacement physique. Une purge quotidienne de ces traces est implémentée dans `functions/src/retention.ts`, couverte par les tests émulateurs et désormais déployée dans Firebase. Le job activé et une exécution réelle sur des traces fictives ont été vérifiés le 14 octobre 2026 à 21:54 UTC. Les preuves et les paramètres de sauvegarde et de journalisation lus dans le cloud figurent dans `FIREBASE-RETENTION.md`.

- Seuils déployés : invitation arrivée à expiration, compteurs 7 jours après la fin de leur fenêtre, journaux 30 jours après suppression achevée. Un passage quotidien traite au plus 500 documents par collection ; une panne ou un arriéré peut allonger le délai. Les tâches en attente sont exclues.
- Paramètres cloud vérifiés : aucune sauvegarde Firestore planifiée ou existante retournée, historique de versions de 1 heure, photos supprimées récupérables pendant 7 jours, journaux Cloud Logging courants pendant 30 jours et journaux d’audit obligatoires pendant 400 jours. Ces durées ne sont pas celles de la purge applicative et ne décrivent pas toutes les copies chez les prestataires.
- Terminer l’inventaire des copies de maintenance, notamment sur MSI hors ligne, et des éventuels exports. Confirmer les dates d’expiration et limiter les accès. Ne pas supprimer les sauvegardes ou comptes réels dans le cadre de cette préparation.
- Fixer une procédure de nettoyage des demandes d’assistance, puis renseigner `securityRetention`, `supportRetention` et `backupRetention` avec des descriptions conformes aux réglages déployés.
- Passer `retentionVerified` à `true` seulement après ces vérifications. Ne pas annoncer « suppression sous 30 jours » sans mécanisme réel correspondant.

## Comportement de suppression décrit dans les pages

Le traitement serveur retire les données du membre qui part, ses données privées, ses notes, réponses, souvenirs et photos, puis le compte Firebase. Certains contenus communs restent pour le partenaire ; les champs d’auteur ou de payeur concernés deviennent `former-member`. Cela n’efface pas les noms saisis dans les textes et ne constitue pas une anonymisation complète. Le dernier départ supprime l’espace partagé. Une tâche interrompue est reprise par le traitement planifié.

Le journal technique de suppression et les délais propres aux prestataires doivent être distingués de la suppression des données actives de l’app. Les liens de téléchargement des photos peuvent donner accès au fichier à leur détenteur ; le service n’est pas chiffré de bout en bout.

## Traitement d’une demande reçue par e-mail

1. Accuser réception et relever la date de demande. Ne pas demander de mot de passe, code de connexion ou d’invitation, ni de photos intimes.
2. Vérifier de manière proportionnée que la personne contrôle le compte concerné. Une simple adresse déclarée dans le formulaire ne prouve pas son identité. Pour un compte anonyme, privilégier la suppression depuis la session authentifiée ; ne pas divulguer les informations d’un couple pour aider à identifier un compte.
3. Examiner le périmètre de la demande et les droits du partenaire restant. Traiter à part une demande visant un nom ou une information personnelle dans un contenu commun conservé.
4. Utiliser le parcours authentifié existant quand la personne dispose encore d’un accès. Une intervention administrative sans accès à l’app nécessite une procédure contrôlée et une identité vérifiée ; ne pas supprimer directement le seul utilisateur Firebase Auth, ce qui laisserait ses contenus dans le service.
5. Suivre la tâche jusqu’à son achèvement, traiter les éventuels échecs et confirmer le résultat, les exceptions et délais de copies techniques au demandeur. Le formulaire Web ne constitue pas un accusé de réception et ne déclenche aucune suppression automatique.
6. Répondre dans le délai applicable aux droits RGPD, en principe un mois. Documenter toute prolongation justifiée et l’annoncer dans ce premier mois. Archiver seulement les informations nécessaires selon la durée définie.

Avant ouverture publique, désigner la personne chargée de ce processus et terminer la procédure administrative pour les demandes vérifiées sans session. Ne jamais improviser une suppression sur un compte réel.

## Publication et vérification

1. Finaliser les informations et mesures ci-dessus, faire relire la politique et les déclarations de confidentialité des stores.
2. Générer la version publique, la déployer puis rendre le site accessible publiquement. Vérifier les trois URL sans connexion ni droit d’accès privé.
3. Tester le lien e-mail sur un téléphone avec une messagerie configurée ; le bouton de copie sert d’alternative. Les champs sont traités localement, sans API ni stockage dans le navigateur.
4. Vérifier la réception d’un message de test sur l’adresse d’assistance et le traitement d’une demande sur un compte de test. Ne pas utiliser les comptes existants du couple.
5. Reconstruire l’app avec les liens activés. Renseigner les URL dans App Store Connect et Play Console. Vérifier que les informations déclarées correspondent à la version distribuée.

L’aperçu utilise des fichiers `_headers` pour proposer les en-têtes de sécurité. Leur application effective dépend de l’hébergement et reste à vérifier ; `noindex` ne remplace pas le contrôle d’accès privé. La revue du rendu dans un navigateur n’a pas été réalisée avec le workflow Sites disponible dans cette session.

## Références officielles consultées

- Apple : https://developer.apple.com/app-store/review/guidelines/ (confidentialité, assistance, suppression de compte).
- Google Play : https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr (ressource Web de suppression, contact e-mail ou formulaire possible).
- Google Play : https://support.google.com/googleplay/android-developer/answer/10144311 (données utilisateur).
- EDPB : https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en (droits et délais de réponse).
- Firebase : https://firebase.google.com/support/privacy et https://firebase.google.com/terms/data-processing-terms (prestataire, conservation et garanties).
