# Préparation de la revue TestFlight — Nous Deux

État du 14 octobre 2026. Le dernier statut Apple confirmé pour la build 1.0.0 (6) est l’attente de Beta App Review ; les dernières tentatives de lecture ont échoué avec une erreur 401. Les changements de cette branche ne remplacent pas cette build. Aucun retrait, nouvel envoi ni changement de groupe n’a été effectué pendant cet audit.

## Risques concrets et état

| Point | État |
| --- | --- |
| Contact inaccessible dans l’app tant que le site est en brouillon | Corrigé dans le code : adresse et ouverture de la messagerie depuis Aide, accessible sans compte. Nécessite une nouvelle build. |
| Micro et reconnaissance vocale déclarés alors que l’assistant est désactivé | Corrigé par configuration native conditionnelle et exclusion du module vocal de l’autolinking. La dictée exige une réintégration explicite du module et une nouvelle build pour être réactivée. |
| Conservation indéfinie des anciennes traces techniques | Fonction `cleanupTechnicalData` déployée et active ; job quotidien activé, exécution réelle et nettoyage de traces fictives vérifiés. Voir `FIREBASE-RETENTION.md`. |
| Politique de confidentialité publique | Encore bloquant : aperçu privé, conservation des sauvegardes et assistance à finaliser, identité légale et mentions applicables à compléter. Ne pas mettre l’URL privée dans App Store Connect. |
| Accès du reviewer aux fonctions à deux | Parcours ci-dessous préparé. Il faut vérifier les informations effectivement présentes dans App Store Connect et fournir deux comptes de démonstration dédiés si Apple exige une connexion préparée. Ne jamais utiliser les comptes réels du propriétaire et de son partenaire. |
| Suppression de compte | Parcours intégré ; réauthentification des comptes e-mail, suppression des données et reprise automatique couvertes par les tests serveur. Essai natif à confirmer. |
| Démarrage, photos, notifications sur iPhone | Bundle iOS compilé ; ceci ne prouve pas le fonctionnement sur un appareil physique. Essai TestFlight indispensable. |

L’accès aux métadonnées de revue via l’authentification gérée EAS a renvoyé une erreur Apple 401 à plusieurs reprises, puis la dernière lecture de statut a également échoué. Aucune clé ni permission du compte Apple n’a été modifiée. Le dernier statut confirmé séparément avec `eas submit:status` était `WAITING_FOR_BETA_REVIEW` ; ce n’est pas une lecture actuelle.

## Texte de revue prêt à adapter dans App Store Connect

Ce texte décrit la version 6, pas les modifications encore non distribuées. Relire les champs existants avant de les compléter. Il ne contient pas d’identifiants de compte. La présence de ces notes ne remplace pas un compte de démonstration si Apple en demande un.

```text
Nous Deux is a French-language private organization app for an existing couple. It is not a dating or matchmaking service. There are no public profiles, public feed, ads, subscriptions or in-app purchases in this beta.

No pre-existing account or invitation is needed to create a new space. On first launch, enter a test nickname, tap Continuer, then Créer. Firebase creates the session automatically. Do not enter real personal or intimate information while testing.

To test sharing with two devices:
1. On device A, create a new space. Generate an invitation from Home or Nous.
2. On device B, enter another test nickname, tap Continuer, then Rejoindre, and enter the invitation. Codes are single-use and expire after 24 hours; generate a fresh code if needed.
3. Add an agenda event, restaurant, shopping item, expense, photo and short message. Check synchronization on the other device.
4. Answer the daily question on both devices. Each answer is private until both members answer. Gift ideas remain private to their author in synchronized mode.

For an offline walkthrough on one device: enter a nickname, tap Continuer, then Essayer sans compte (sur ce téléphone), enter a partner nickname and tap C’est parti. Both profiles can be used on this device. This mode does not demonstrate cloud synchronization or isolation between two signed-in users.

Account recovery: Nous > Ton compte > Sécuriser mon compte links an email and password. J’ai déjà un compte on the welcome screen restores this account on another device. No social login is used.
Account deletion: Nous > Ton compte > Supprimer mon compte. Use only a disposable test account for this operation. The email account requires its password. Deletion removes the departing member’s private data; shared records may remain for the partner, and the last member’s departure deletes the shared space.

AI assistance, voice dictation, AI schedule import and Google Places search are disabled in this beta. Restaurant entry is manual. There is no background location tracking. Notifications are optional and enabled from Nous > Notifications.

Support: xiitechstudio@gmail.com (XII Tech Studio).
```

## Avant une nouvelle soumission

Prérequis ajoutés au code le 15 octobre 2026 : la suppression envoie désormais `expectedUserId` et `deleteAccount` le compare à l’identité authentifiée avant toute tâche d’effacement. Cette protection exige **le serveur corrigé et le nouveau client** ; elle n’est pas active en production par le seul commit GitHub. Lorsqu’un déploiement sera autorisé et son absence de coût supplémentaire prouvée, déployer/vérifier le serveur avant la distribution du client, puis réaliser l’essai natif avec comptes jetables. Le champ reste facultatif pour ne pas casser les anciens clients, qui ne bénéficient donc pas de cette nouvelle vérification d’intention. Aucun déploiement, build ou envoi n’a été déclenché pour cette modification.

La création/jonction utilise également `expectedUserId` depuis le correctif du 15 octobre à 12:37. Déployer/vérifier `createCouple` et `joinCouple` avant le nouveau client : l’ancien schéma strict de jonction refuserait ce champ supplémentaire. Aucun basculement en production n’a été effectué. Les anciens clients restent acceptés par le nouveau serveur mais sans garde d’intention.

Le client cloud des dépenses utilise désormais `recordSettlement` pour les marques informatives de remboursement. La fonction préparée doit être déployée et vérifiée avant distribution du nouveau client ; en son absence le bouton signale une erreur, sans retomber sur l’ancien ajout direct. Aucun déploiement n’est autorisé sans preuve d’absence de coût supplémentaire. Voir SETTLEMENT-PROTOCOL.md pour les reçus privés, la reprise et la limite des anciens clients. Le mode local n’appelle pas ce service. Aucun paiement ni transfert d’argent n’est réalisé par cette fonctionnalité.

Les règles Firestore préparées refusent désormais les marques directes et leur modification côté client. Elles ne doivent pas être déployées isolément : les anciennes versions utilisant l’ajout direct perdraient ce bouton. Vérifier le serveur, le nouveau client et la transition ancienne/nouvelle version avant activation coordonnée ; lecture et retrait des marques existantes restent permis aux membres. Ne pas affirmer que cette protection existe déjà dans TestFlight ou en production.

1. Publier une politique complète sur une URL HTTPS accessible sans connexion ; vérifier assistance et suppression sur le même principe. Renseigner les métadonnées et activer les liens de l’app seulement une fois le site public.
2. Vérifier contact, téléphone, instructions et éventuels comptes de démonstration dans TestFlight > Informations de test. Ne pas inventer les données manquantes.
3. Installer la nouvelle build en test interne, vérifier démarrage/reconnexion, photos, refus de permission, notifications, suppression avec un compte jetable et absence de perte de l’espace du partenaire.
4. Envoyer la nouvelle build via EAS, puis l’ajouter au groupe externe et suivre sa revue éventuelle. Ne pas retirer automatiquement la build 6 en cours d’examen.

## Essais natifs ciblés restant à faire — code du 15 octobre

Checklist préparée, **non exécutée sur téléphone**. Attendre une build autorisée, les prérequis serveur ci-dessus et la preuve d’absence de coût supplémentaire. Employer exclusivement des images synthétiques et des comptes de test autorisés, jamais les albums ou comptes personnels.

- Galerie/caméra : portrait très haut, paysage, petit format, annulation et refus de permission ; vérifier ratio, orientation et grand côté préparé (1600 maximum). Les tests d’API doublées ne prouvent ni qualité visuelle ni consommation mémoire.
- Envoi photo : lecture indisponible/interrompue, changement de compte ou album devenu indisponible pendant le sélecteur ; vérifier message, déverrouillage et absence de création dans le nouveau contexte. Le délai de 60 secondes ne concerne que la lecture locale, pas l’upload déjà engagé.
- Résultat ambigu : vérifier l’album actualisé avant tout nouvel ajout. Ne pas supprimer automatiquement un fichier dont l’association est inconnue ; idempotence des ajouts et réconciliation d’orphelins restent à traiter.
- Édition à deux appareils : pendant qu’A modifie une légende ou un titre, B modifie un autre champ (date, détail, type film/série). A doit conserver sa saisie, recevoir les champs intacts et ne pas les réécrire. Deux éditions simultanées du même champ ne sont pas encore arbitrées côté serveur.
- VoiceOver/TalkBack : parcourir miniatures, souvenir anniversaire, ajout occupé et fiche ; contrôler libellés complets, indication de destination et absence de focus inaccessible ou doublé. Les propriétés accessibles testées en Jest ne remplacent pas cet essai.

## Complément de recette — changements du 20 octobre

Scénarios préparés, **non exécutés sur appareil** et non présents dans la build 6 par le seul commit GitHub. Leur exécution attend une build autorisée et compatible avec les prérequis serveur ci-dessus. Ne pas modifier les comptes, photos ou horloges personnelles pour les reproduire : utiliser uniquement un appareil de test et des données fictives. Les deux appareils éventuels doivent appartenir au même espace de démonstration autorisé.

| Parcours | Manipulation à vérifier | Résultat attendu et limite |
| --- | --- | --- |
| Question quotidienne | Saisir puis valider immédiatement, effacer puis valider, appuyer deux fois ; en mode local, saisir une réponse distincte pour chaque membre. | Dernier texte envoyé, texte vide refusé, une seule action simultanée par membre. Une réponse perdue ne constitue pas une preuve d'absence d'écriture. |
| Passage de jour | Garder l'accueil ouvert à minuit puis tester une reprise après plusieurs jours ; vérifier question, compte à rebours, agenda et souvenir anniversaire. | Jour courant sans attendre une nouvelle donnée distante, ancien brouillon de réponse non envoyé pour le nouveau jour. Un formulaire d'édition déjà ouvert ne doit pas être effacé. Horloge simulée vérifiée en Jest ; veille/reprise native non prouvée. |
| Votre histoire — date | Ouvrir la date sur A, la changer sur B avant toute saisie sur A ; recommencer en modifiant A d'abord. Valider ensuite une date inchangée. | Champ intact actualisé, saisie locale conservée, aucune écriture pour une validation inchangée. Pas d'arbitrage serveur de deux modifications simultanées du même champ. |
| Votre histoire — cadrage | Répéter le scénario précédent sur la même photo ; remplacer ensuite la photo sur B alors que A cadre l'ancienne. Revenir au formulaire et rouvrir. | Transformation intacte actualisée, transformation modifiée conservée en entier ; sauvegarde sur une photo remplacée refusée, réouverture sur la photo courante. Vérifier le rendu et les gestes, non validés par Jest. |
| Upload et erreurs | Interrompre uniquement la connexion du dispositif de test pendant sélection/upload/association, puis revenir au formulaire. | Verrou jusqu'à la fin de l'action ; pas d'URL ou détail fournisseur dans les erreurs photo ; résultat d'association éventuellement non confirmé. Vérifier les données reçues avant une reprise manuelle, ne pas supprimer de fichier à l'aveugle. |
| Connexion | Provoquer une erreur de connexion sur un compte de démonstration puis réessayer explicitement. | Message lisible, action de nouveau disponible, session mémorisée non effacée par le seul affichage du rejet. Aucun achat, invitation ni notification à un tiers. |
| Thème local | Sur le dispositif de test, choisir rapidement deux thèmes au démarrage puis relancer l'app après la sauvegarde. | Dernier choix visible et restauré si le stockage a réussi. Une sauvegarde refusée garde le choix seulement en mémoire ; aucune garantie de persistance en cas de panne du stockage. Ne pas effacer les données du téléphone pour ce test. |

Pour chaque essai futur, noter date, plateforme/version système, numéro de build et SHA source, résultat réellement observé et capture anonymisée si nécessaire. Ne cocher aucun de ces parcours sur la seule base des tests automatisés. Les défauts reproduits ici utilisent des données synthétiques ; aucune fuite réelle n'a été constatée.

## Nettoyage technique : cible et déploiement

`functions/src/retention.ts` prévoit un passage quotidien et au plus 500 documents par collection et par passage :

- invitations : après leur expiration de 24 heures, avec suppression du pointeur seulement s’il désigne encore cette invitation ;
- compteurs anti-abus : 7 jours après la fin de leur fenêtre de quota ;
- journaux de suppression : 30 jours après l’achèvement, uniquement si le statut est `complete` et qu’aucun bail de travail n’est actif.

Les documents sont relus en transaction avant suppression. Les comptes, contenus, photos et tâches en attente ne sont pas parcourus par cette fonction. Les délais sont des seuils de nettoyage, auxquels s’ajoutent la cadence, une éventuelle panne ou un arriéré : ne pas les présenter comme une échéance d’effacement garantie avant validation de l’exploitation.

La connexion Firebase sur Hydan a été rétablie et le projet vérifié. Le déploiement ciblé suivant a réussi ; le poste MSI reste hors ligne :

```sh
firebase deploy --config firebase.security.json --project nous-deux-80525 --only functions:cleanupTechnicalData
```

La configuration prépare l’entrée `core.js`, sans activer les services IA. La fonction active, le job quotidien et une exécution sur six traces fictives ont été vérifiés ; toutes les traces de test ont été retirées. Les paramètres Firestore, Storage et Cloud Logging observés sont consignés dans `FIREBASE-RETENTION.md`. Les copies de maintenance du poste MSI et la conservation de l’assistance restent à finaliser. `retentionVerified` reste donc à `false`.
