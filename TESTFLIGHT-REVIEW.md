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

### Accessibilité et invitations — complément du 20 octobre après-midi

Recette préparée uniquement : **aucun des essais ci-dessous n’a été exécuté sur iPhone, Android ou navigateur réel dans cette session**. Les nouvelles propriétés React, le calcul de contraste et les scénarios simulés ne prouvent pas le rendu natif. Les sept images PNG absentes de la copie de contrôle n’ont pas été remplacées par des images factices ; aucun export visuel ni nouvelle build n’a été produit.

| Parcours | Vérification future sur dispositif de test | Résultat attendu et limite |
| --- | --- | --- |
| Lecteur d’écran | Parcourir titres, champs vides puis remplis, choix de membre, date/heure et couleurs. | Titres navigables, noms de champs stables, année/date/heure explicites, choix coché/indisponible annoncé. Couleurs nommées (ex. Orange), pas uniquement un code hexadécimal. Vérifier les focus imbriqués et la prononciation, non prouvés par Jest. |
| Taille du texte | Augmenter la taille sur le dispositif de test ; vérifier onglets à libellés longs, formulaires et confirmation web longue. | Texte non tronqué dans les onglets corrigés et contenu de confirmation défilable, boutons atteignables. Ne pas généraliser à tous les écrans : vérifier portrait, paysage et clavier ouvert. |
| Contraste | Comparer thèmes clair/sombre et les sept couleurs de membre, notamment l’orange, sur actions principales, choix, petites initiales et blocs d’agenda (titre et horaires). | Premier plan lisible sans changement de couleur enregistrée. Les rapports calculés concernent les couleurs opaques au repos ; atténuation, superposition, dégradés et couleurs inconnues exigent une vérification distincte. |
| Fin de grille d’agenda | En mode local de démonstration, ajouter un horaire 9 h–12 h, puis 8 h–22 h ; faire défiler jusqu’à la fin de la grille. Vérifier aussi un horaire 6 h–7 h et un événement finissant à 23 h 30. | Plages libres jusqu’à 23 h contenues dans la grille, aucune dernière heure masquée ; début anticipé et événements tardifs conservés. Les bornes des styles sont testées, pas le défilement ni le rendu natif. |
| Réduction du mouvement | Activer le réglage avant ouverture puis le modifier pendant l’affichage des logos, du cœur d’accueil, d’une célébration et d’une feuille. | Présentation statique tant que la préférence est inconnue ou active ; arrêt des boucles décoratives concernées, transitions Sheet/DialogHost sans slide/fade, champs conservés. Les animations du système/navigateur et l’assistant désactivé restent hors périmètre. N’envoyer aucun cœur réel à un tiers pour cet essai. |
| Invitation en cours | Sur environnement de test autorisé, créer puis remplacer un code ; simuler une réponse perdue au remplacement et revenir à l’écran. | Ancien code immédiatement retiré, création/partage simultanés empêchés, aucune remise en circulation du code dont la validité n’est plus certaine. Reprise volontaire seulement ; une requête serveur engagée n’est pas annulée. |
| Partage et expiration | Ouvrir puis annuler la feuille de partage ; vérifier le texte avec une échéance proche et tenter après expiration. Quitter l’espace pendant un échec simulé. | Échéance exacte avec fuseau, pas de promesse de 24 heures supplémentaires ; code expiré ou remplacé non partagé ; aucun dialogue tardif dans l’autre espace. Ne sélectionner aucun destinataire et n’envoyer aucune invitation à un tiers. La résolution de Share ne prouve pas une livraison. |

Les essais de création d’invitation nécessitent aussi les prérequis serveur, l’environnement autorisé et la preuve d’absence de coût supplémentaire. En leur absence, garder ces lignes non exécutées ; ne pas utiliser des comptes réels ni contourner le blocage des émulateurs de sécurité. Une recette réussie ne constitue pas une approbation Apple.

## Recette complémentaire : cadrage, dates et démarrage (20 octobre)

Préparée seulement. Les tests React ci-dessous utilisent des sources fictives et des modules natifs doublés ; aucun essai sur appareil n’est coché. Utiliser des photos de démonstration non privées et un environnement autorisé ; conserver les prérequis de coût, de ressources et de serveur avant toute build ou distribution.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Source et chargement photo | Passer d’un paysage à un portrait puis revenir au paysage ; observer l’éditeur et les photos affichées pendant un chargement lent. | Aucun ancien ratio appliqué à la nouvelle source. Commandes de cadrage indisponibles avant mesure valide, puis zoom calculé depuis le ratio courant. Vérifier le rendu réel et la réapparition des commandes ; Jest ne prouve pas les événements Image natifs. |
| Fin du glissement | Déplacer une photo, relâcher puis reprendre ; interrompre un déplacement par fermeture de l’éditeur, changement de photo ou indisponibilité. | Un nouveau glissement part du cadrage courant ; un événement de l’ancien geste ne le remplace pas. Vérifier aussi une interruption système. Aucun enregistrement ou upload déjà engagé n’est annulé par cette protection. |
| Date maximale | Sur web, saisir une date future dans la rencontre ou un souvenir, sortir du champ puis saisir aujourd’hui. Sur appareil, vérifier la borne du calendrier. | La date future n’est pas transmise comme valeur acceptée ; le brouillon web revient à la valeur contrôlée à la sortie. La journée limite est acceptée entière. Les tests de callbacks iOS/Android ne remplacent pas l’ouverture du calendrier natif. |
| Démarrage et reprise | Vérifier le démarrage normal, le chargement lent des polices/session et une restauration refusée sur environnement de test. | La navigation n’apparaît qu’une fois prête ; la reprise de connexion reste accessible. Un rejet du module SplashScreen est traité avec un diagnostic générique, mais son masquage natif ne peut pas être garanti en cas d’échec. Le rendu du splash nécessite une build release autorisée, distincte de ces tests. |

## Recette complémentaire — Votre histoire et aide (20 octobre, soirée)

Parcours préparés, **non exécutés sur appareil**. Utiliser uniquement un environnement de test autorisé, des comptes et photos fictifs, une build autorisée et les prérequis serveur de cette recette. Aucune ouverture de service payant, aucun e-mail ni demande réelle de suppression.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Perte puis retour des données du couple | Retarder sélection/envoi/sauvegarde de photo ou sauvegarde de date/cadrage, rendre les données indisponibles puis les rétablir avant le résultat. | L’ancienne opération ne poursuit pas l’étape suivante, ne ferme pas la fiche reprise et n’y affiche pas d’erreur tardive. Verrou libéré à la résolution ; brouillons conservés. Une écriture déjà envoyée peut avoir réussi et doit être relue, jamais compensée aveuglément. |
| Nouvelle photo reçue pendant la préparation | Depuis deux clients de test, recevoir une autre photo pendant une sélection puis pendant un upload retardé. Réessayer explicitement ensuite. | Aucun upload supplémentaire après sélection obsolète, aucune association après upload obsolète ; explication de relance. Une relance depuis la photo courante fonctionne. Ce garde ne remplace pas une précondition atomique serveur et ne nettoie pas un upload orphelin. |
| Aide et refus d’ouverture système | Avec un double de Linking ou un refus système contrôlé, lancer une ouverture, quitter la route puis y revenir avant le refus. Tester plusieurs boutons pendant une ouverture. | Pas de dialogue tardif après départ/retour, une ouverture à la fois, sortie toujours possible, nouvelle tentative après résolution. Repli utile si le refus concerne encore l’écran courant. Aucun message envoyé ; les liens publics restent absents en configuration privée. |
| Compteur au lecteur d’écran | Avec VoiceOver puis TalkBack, atteindre Votre histoire avec/sans date, à un jour du prochain cap et après changement de journée. | Nombre de jours, date et cap annoncés, puis indication d’ouverture des réglages. Sans date, absence explicitée. Vérifier absence de double annonce et navigation vers/depuis la fiche ; Jest ne valide que les propriétés transmises. |

## Recette complémentaire — saisie immédiate et entrée (20 octobre, fin de soirée)

Préparée seulement : **aucun essai natif exécuté**. Les 108 nouveaux tests de cette session utilisent données fictives et services doublés. Les captures et builds nécessitent les ressources originales, un environnement autorisé, les prérequis serveur et une preuve d’absence de coût supplémentaire. Ne pas envoyer d’e-mail, d’invitation, de notification ni de demande de suppression à une personne réelle.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Dernière frappe des formulaires | Sur souvenirs, dépenses, listes, restaurants, agenda et dates à venir, changer plusieurs champs puis valider immédiatement sans attendre une pause ; recommencer avec un titre ou montant devenu invalide. Tester aussi date, payeur, note et répétition. | Les dernières valeurs sont conservées ensemble ; la validation relit l’état courant. Les valeurs invalides ne déclenchent pas d’écriture. Vérifier le clavier et les sélecteurs réels ; les tests de callbacks ne suffisent pas à valider leurs événements natifs. |
| Données reçues et photo de souvenir | Garder une légende en cours de saisie, recevoir une autre photo depuis un second client de démonstration ; recommencer après indisponibilité puis retour de la collection. | Source photo courante affichée, légende en cours conservée, champs intacts reçus non réécrits. Ne pas conclure à une résolution transactionnelle des conflits entre appareils. |
| Retour sans historique | Ouvrir directement Souvenirs puis Dépenses sans route précédente ; refaire après une navigation ordinaire depuis l’app. | Sans historique, retour à l’accueil ; sinon retour à la route précédente. Vérifier le comportement réel des liens profonds et du bouton système séparément. |
| Prénom du profil | Changer le prénom puis valider immédiatement ; effacer le champ et réessayer. Avec deux clients fictifs, recevoir un nouveau prénom lorsque le champ local est intact. | Dernière saisie utilisée, champ vide ou inchangé sans écriture ; prénom reçu intact préservé. Aucune garantie d’arbitrage serveur sur deux éditions simultanées du même champ. |
| Connexion et sécurisation | Dans un montage de test avec service d’authentification contrôlé, modifier adresse, mot de passe et confirmation juste avant validation ; retarder le résultat, tenter de modifier les champs puis fermer/revenir. | Coordonnées actuelles et confirmation revalidées ; champs verrouillés pendant la demande ; anciennes actions de l’ouverture fermée ignorées. Aucun e-mail de réinitialisation réel ; une demande déjà envoyée n’est pas annulée par le garde client. |
| Création, jonction et essai local | Dans un environnement fictif contrôlé, remplacer prénom, couleur, code ou prénom partenaire puis valider immédiatement ; doubler l’appui et retarder le résultat. Tenter Retour et saisie pendant la demande, puis démonter l’entrée avant sa réponse. | Une demande à la fois, valeurs courantes, champs effacés refusés, navigation/saisie verrouillées pendant les créations/jonctions, résultat périmé ignoré après démontage. Continuer ne quitte pas un prénom vide. L’écran complet et son logo n’ont pas été rendus dans la copie texte ; les anciens callbacks d’une autre étape encore montée restent une piste d’audit distincte. |

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
