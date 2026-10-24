# Pages de confidentialité, d’assistance et de suppression

État au 14 octobre 2026 : aperçu privé préparé. L’utilisateur a précisé que **XII Tech Studio est le nom utilisé pour son activité informatique, avec le même numéro de TVA que son activité de coiffure**. Il ne présente pas XII Tech Studio comme une société distincte. Le nom commercial est confirmé ; l’identité officielle et le numéro de TVA associés restent à fournir. Coordonnées déjà fournies : **Rue de Jace 189, 4101 Jemeppe-sur-Meuse, Belgique**, **xiitechstudio@gmail.com**. La politique de conservation et les autres mentions applicables restent à finaliser. Ce document ne constitue pas une validation juridique ni une autorisation de publication publique.

## Source et génération

- `website/` contient les trois pages, leur style et la préparation locale des e-mails.
- `src/constants/public-info.json` distingue le nom commercial (`operatorName`) du nom légal de son éditeur (`operatorLegalName`), encore vide. Le contact et les informations de publication y sont également centralisés. La génération publique et les liens dans l’app exigent les deux noms ; le contact d’assistance reste utilisable pendant le brouillon.
- `npm run website:preview` génère un aperçu explicitement marqué comme brouillon, avec `noindex`.
- `npm run website:build` refuse de produire une version publique tant que les informations requises manquent. Le garde-fou vérifie leur présence, pas leur exactitude juridique.
- Les polices et le logo sont copiés depuis les dépendances et les ressources existantes ; leurs licences accompagnent la sortie. Exécuter `npm ci` avant une génération sur un nouveau poste.
- Les liens Web de l’écran Aide restent masqués lorsque le statut est `draft`. Le contact e-mail confirmé reste accessible indépendamment de ce statut. L’accès public effectif doit être vérifié avant de définir `publicationStatus` à `published` et de reconstruire l’app.

## Informations à confirmer avec l’éditeur

1. Nom commercial confirmé : XII Tech Studio, utilisé pour l’activité informatique sous le même numéro de TVA que la coiffure. Demander le nom officiel du titulaire (nom complet ou dénomination enregistrée) et le numéro de TVA ; ne pas les déduire d’un compte Apple, GitHub ou du profil ChatGPT. L’adresse et l’e-mail sont déjà fournis. Vérifier ensuite les mentions applicables à cette identité et les déclarations professionnelles des stores. Aucune société distincte ni modification des activités enregistrées n’a été créée par ce travail.
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
- Le protocole de marques préparé le 15 octobre ajoute des reçus privés d’idempotence, sans déploiement à ce jour. Leur inventaire et leur nettoyage lié au départ figurent dans FIREBASE-RETENTION.md. Aucune purge périodique de ces reçus n’existe. Le 24 octobre 2026, le propriétaire a confirmé explicitement la conservation des reçus de remboursement jusqu’à la suppression du compte concerné ou de l’espace du couple, conformément au nettoyage existant : départ du demandeur, conservation des reçus du partenaire restant, puis nettoyage global au dernier départ. Supprimer une marque ne supprime pas son reçu. Pas de purge périodique ni de délai maximal en jours ; les reprises du nettoyage restent possibles. Cette décision concerne les données actives du protocole de remboursement, pas les reçus de souvenirs, l’assistance, les sauvegardes ni une validation juridique. Le choix est reflété dans website/content.mjs et src/app/aide.tsx ; ces informations sont préparées, pas publiées ni distribuées. Les autres prérequis de publication restent ouverts. L’empreinte liée au membre n’est pas une donnée anonyme.

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

## Recette des messages préparés — ajout du 20 octobre 2026

Préparée, **non exécutée dans Safari ou un navigateur réel**. Les 18 tests jsdom du script ne valident pas le rendu des pages générées, le presse-papiers système ni une livraison d’e-mail. Attendre une copie complète des ressources pour la recette visuelle ; ne pas remplacer les PNG manquants par des images factices.

- Dans un aperçu privé autorisé, avec des coordonnées fictives, préparer un message puis modifier l’adresse, le texte ou le motif. Le résultat et son lien doivent disparaître ; une nouvelle préparation doit reprendre les valeurs actuelles. Vérifier aussi la réinitialisation et un champ devenu invalide.
- Pour le formulaire de suppression, retirer la confirmation de propriété du compte après préparation : l’ancien résultat ne doit plus être utilisable. Cet essai ne supprime aucun compte et ne prouve pas l’identité du demandeur.
- Copier puis modifier/préparer un autre message pendant l’attente : aucune seconde copie simultanée, aucun ancien succès ou échec ne doit remplacer le statut courant. Une copie déjà demandée au système ne peut pas être annulée ; attendre sa fin puis copier explicitement le nouveau message. Refuser la permission clipboard pour vérifier le repli manuel, sans faux message de réussite.
- Contrôler le focus, les annonces du statut, la sélection manuelle et le bouton désactivé sur mobile, portrait/paysage et texte agrandi. Ne pas ouvrir ni envoyer un e-mail de test dans le cadre autonome : ces contrôles n’autorisent aucun message à un tiers. Le formulaire ne constitue toujours pas un accusé de réception.

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
