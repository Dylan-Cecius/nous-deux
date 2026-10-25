# Préparation de la revue TestFlight — Nous Deux

## Contrôle du candidat le 25 octobre 2026

Source `c735fff`, copie complète de 202 blobs vérifiée : 66 suites / 1 828 tests applicatifs, lint et TypeScript réussis. Export JavaScript iOS hors ligne réussi avec Firebase non configuré et IA/Places désactivés ; ce contrôle n'est ni un binaire signé, ni un essai iPhone. Sécurité réexécutée sous Node 22.23.4 : 67 tests + 11 gardes réussis sur `demo-nous-deux-security` (SECURITY-VALIDATION.md).

Accès EAS en lecture seule confirmé depuis Hydan, utilisé ponctuellement à la demande du propriétaire ; MSI hors ligne. CLI 25.3.0, compte dylancecius, plan Free, iOS 1/15 et total 2/30 consommés, dépassement nul ; cycle finissant le 1er novembre. Le plan Free ne facture pas de dépassement selon https://docs.expo.dev/billing/plans/ consulté ce jour. Cette observation doit être renouvelée avant une opération future. Aucune build ni soumission lancée, aucune authentification exportée, aucun abonnement modifié. Preuves locales : `docs/release-evidence/2026-10-25/`.

Blocages restants inchangés : identité légale et TVA à fournir par le propriétaire, conservation/procédure des demandes d'assistance et inventaire des copies de maintenance à finaliser ; politique publique et déclarations non validées. Ne pas assimiler une permission générale de poursuivre à la fourniture de ces informations. La transition des règles reste coordonnée avec le nouveau client et les essais natifs ; les anciens ajouts directs ne sont pas désactivés par ces contrôles.

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

Actualisation du 24 octobre 2026 : createCouple, joinCouple, deleteAccount et retryAccountDeletions ont été déployées et vérifiées ACTIVE sous Node 22 ; les deux paragraphes précédents décrivent le prérequis historique désormais satisfait côté serveur. Les essais natifs restent à faire (SERVER-ROLLOUT.md).

Le client cloud des dépenses utilise désormais `recordSettlement` pour les marques informatives de remboursement. La fonction a été déployée et vérifiée ACTIVE le 24 octobre 2026 à 13:58:49 UTC ; l’absence de repli vers l’ancien ajout direct reste inchangée. Le nouveau client n’est pas encore distribué. Aucun déploiement n’est autorisé sans preuve d’absence de coût supplémentaire. Voir SETTLEMENT-PROTOCOL.md pour les reçus privés, la reprise et la limite des anciens clients. Le mode local n’appelle pas ce service. Aucun paiement ni transfert d’argent n’est réalisé par cette fonctionnalité.

Conservation confirmée par le propriétaire le 24 octobre : les reçus privés de remboursement restent jusqu’à la suppression du compte du demandeur ou de l’espace, sans expiration périodique ; supprimer une marque ne retire pas son reçu. L’aide intégrée et la politique en brouillon sont mises à jour. Dans les déclarations de la prochaine version, tenir compte de ces empreintes/identifiants/dates liés au membre, traités pour le fonctionnement anti-doublon, sans les déclarer anonymes ni comme un paiement traité par l’app. Aucune déclaration App Store Connect n’a été modifiée ou validée par ce document ; vérifier les catégories avec les instructions Apple en vigueur avant envoi. Les reçus de souvenirs non activés ne sont pas couverts par cette décision.

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

## Recette complémentaire — étapes d’entrée et invitations (20 octobre, 22 h)

Parcours préparés, **non exécutés sur appareil**. Utiliser un environnement de test autorisé, des données fictives et des doubles de service pour retarder les réponses. Les ressources originales et les prérequis de build/serveur/coût restent obligatoires. Aucune invitation ni réinitialisation réelle à envoyer.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Correction du profil et transitions | Depuis le choix cloud, revenir avec Modifier mon profil ; en configuration locale seule, utiliser Retour avant création. Modifier prénom/couleur puis poursuivre. Avec le montage contrôlé, injecter un événement de l’étape précédente avant/après son changement et un aller-retour. | Brouillons conservés, nouvelle saisie prise en compte ; anciens événements de l’étape ignorés et une seule destination par transition. Le contrôle de provenance décrit comme piste dans la recette précédente est maintenant couvert en tests de logique ; gestes et clavier natifs restent à vérifier. |
| Connexion et aide | Retarder une connexion ou réinitialisation simulée, ouvrir l’aide puis revenir avant son résultat. Tester aussi un retour sans demande en cours. | Aucun résultat/dialogue de l’ancien passage ; coordonnées conservées et nouvelle tentative volontaire possible après résolution. La demande distante déjà engagée n’est pas annulée par ce garde d’interface. |
| Échec local et explications d’invitation | Faire rejeter le stockage doublé avec un contenu technique fictif, puis reprendre. Lire les conseils de reconnexion locale et synchronisée ; inspecter le texte de partage sans le transmettre. | Message générique d’ouverture non confirmée, saisie conservée ; aucun détail brut du rejet. Parcours prénom → Continuer → Rejoindre explicite et distinction avec l’accès TestFlight. Aucun statut d’acceptation Apple déduit. |
| Noms longs et texte agrandi | Utiliser des prénoms fictifs longs dans les choix de membre de l’agenda/dépenses et agrandir le texte système ; vérifier aussi Souvenirs/Tout voir et À venir/Ajouter en largeur réduite. | Choix contenus dans la largeur disponible, libellés lisibles sur plusieurs lignes, action de rubrique accessible après retour à la ligne. Vérifier pixels, toucher, VoiceOver/TalkBack et paysage : tests de composants et styles ne valident pas ce rendu. |

## Recette complémentaire — agenda et comptes à rebours (20 octobre, 23 h)

Préparée seulement, **aucun essai visuel ou natif réalisé**. Utiliser des données fictives en mode local et les ressources originales, dans un environnement de test autorisé. Les prérequis de coût, serveur et distribution restent inchangés ; ne pas modifier l’horloge d’un téléphone utilisé pour des données réelles.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Agenda au changement de journée | Avec une horloge de test contrôlée, rester sur une autre journée de la semaine jusqu’à minuit, puis tester une reprise après arrière-plan. | Le repère du jour avance, sans déplacer le jour consulté. Le test React contrôle l’horloge ; il ne prouve pas le réveil de l’application sur appareil. |
| Retour au jour courant | Parcourir plusieurs semaines vers le passé et le futur puis toucher Revenir à aujourd’hui. Refaire au changement dimanche/lundi. | Semaine courante affichée, bonne journée sélectionnée, horaires inchangés. Vérifier la disposition du bouton en portrait/paysage et avec texte agrandi. |
| Date passée et reprise | Dans Nouvelle date, choisir hier sans répétition, puis un anniversaire ancien avec répétition ; retirer ensuite la répétition. Corriger une date refusée puis valider. | Date passée non annuelle expliquée et refusée, brouillon conservé ; anniversaire annuel et date corrigée acceptés. Un ancien appui à minuit doit aussi expliquer le refus, sans écriture. |
| Contraste des comptes à rebours | Afficher au moins deux dates à venir dans chacun des quatre thèmes, en modes clair et sombre. | Tous les nombres suivent le thème choisi et restent lisibles ; plus de bleu fixe sur une carte sur deux. Les ratios sont calculés sur couleurs opaques ; rendu réel à vérifier. |
| Conseil de rappel | Lire la carte vide À venir et retrouver Nous → Notifications. Sur un appareil de test autorisé seulement, vérifier séparément autorisation refusée et accordée. | Conseil d’activation explicite, aucune promesse de livraison inconditionnelle. Les rappels effectifs et les permissions natives ne sont pas validés par la seule lecture du texte. |

## Recette complémentaire — mode sans compte, montants et dates relatives (21 octobre, 00 h)

Préparée seulement, **aucun essai visuel ou natif exécuté**. Utiliser un espace local de démonstration et des données fictives, sans compte réel, invitation ni notification à un tiers. Les ressources originales et les prérequis de build/coût/distribution restent obligatoires. Ne pas changer l’horloge d’un téléphone contenant des données réelles.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Cadeaux sur un téléphone partagé | Ouvrir Cadeaux en mode sans compte, avant et après ajout d’une idée fictive. | L’accès possible par la personne utilisant le téléphone est expliqué dans les deux états, sans cadenas ni promesse de secret. Ce texte ne constitue pas un verrou de confidentialité. |
| Courses et question locales | Consulter Courses vide/remplie, puis lire la question du jour avant de répondre avec les deux profils fictifs. | Absence de synchronisation explicite ; réponses visibles dès leur enregistrement annoncées. Vérifier la lisibilité en texte agrandi et la lecture vocale. |
| Mots doux et cœurs locaux | Saisir un mot fictif, contrôler la touche clavier et le libellé du bouton ; activer un cœur local. | Enregistrer le mot, touche de fin de saisie et cœur enregistré sur ce téléphone ; aucune promesse de notification distante. Aucun test cloud avec destinataire réel. |
| Montant collé et arrondi | Dans une dépense fictive, saisir/coller 1,005 ; 1.015 ; 10,075 ; 1 234,56 (espaces normale, insécable et fine). Essayer aussi 0x10, 1e3, 0,009 et 100000,001. | Aperçu puis valeur enregistrée : 1,01 ; 1,02 ; 10,08 ; 1 234,56. Les quatre derniers exemples sont refusés. Vérifier le clavier natif et le collage ; aucun paiement ni transfert n’est effectué. |
| Historiques à minuit | Dans un montage à horloge contrôlée, afficher mot, cœur reçu fictif et dépense du jour à 23:59 ; garder un brouillon ouvert et franchir minuit, puis tester une reprise après arrière-plan. | Aujourd’hui devient hier sans émission de collection, brouillons conservés. Un cœur reçu peut être fourni par un double de collection : aucun envoi à un tiers nécessaire. Les tests React ne valident pas le cycle de vie natif. |
| Souvenirs et attentes de rappel | Lire les deux états vides de Souvenirs puis afficher une photo fictive d’une année passée à la même date dans le montage de test. | Le texte décrit la carte sur l’accueil, sans promettre une notification annuelle. L’image et son cadrage doivent être contrôlés avec les ressources originales. |

## Recette complémentaire — invitations (21 octobre, 01 h)

Préparée seulement, **non exécutée sur appareil**. Utiliser un montage autorisé avec backend/Share doublés, codes fictifs et horloge contrôlée. Ne pas créer d’invitation réelle, modifier l’horloge d’un téléphone personnel ni transmettre un message. Ressources originales, build et prérequis de coût/distribution toujours requis pour une recette native.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Réponse incorrecte et reprise | Faire retourner null, un code objet ou une date invalide au double de création ; recommencer avec une réponse valide fictive. | Message de réponse non vérifiée, aucun code inutilisable partagé ni écran en erreur ; nouvelle tentative possible. Une forme valide n’atteste pas la validité serveur. |
| Échéance et changement d’horloge | Afficher un code fictif, passer en arrière-plan jusqu’après expiration puis reprendre. Refaire avec horloge reculée dans le montage, et avec un partage lancé après expiration. | Code expiré retiré avec explication ; code encore valide conservé après recul. Aucun appel serveur automatique. Vérifier le cycle de vie réel séparément ; le serveur reste l’autorité sur l’échéance. |
| Correction de saisie | Essayer un code de dix caractères contenant 0/1, I/O ou ponctuation ; corriger avec le code fictif du montage, en minuscules puis avec séparateur. | Conseil visible et bouton désactivé pour une forme invalide ; pas de jonction déclenchée. Saisie valide normalisée avant le double de jonction. Aucun compte réel. |
| Sélection et renouvellement | Sélectionner le code fictif dans la carte ; faire expirer puis créer une nouvelle invitation via le double. | Sélection native utilisable pour copie manuelle ; message d’expiration retiré lors du renouvellement et nouveau code affiché. Ne rien transmettre ni coller dans un service tiers ; la propriété selectable seule ne valide pas le geste natif. |

## Recette complémentaire — années et navigation agenda (21 octobre, 02 h)

Préparée seulement, **aucune recette native exécutée**. Utiliser des données fictives, une horloge de test et les ressources originales. Garder les notifications doublées pour contrôler les dates sans envoi ; ne pas modifier l’horloge d’un téléphone personnel. Les prérequis de coût, de serveur et de distribution restent applicables.

| Parcours | Manipulation prévue | Résultat attendu et limite |
| --- | --- | --- |
| Première date annuelle future | Depuis une horloge de test en octobre 2026, ajouter le 30 novembre 2028 avec répétition annuelle ; refaire avec le 29 février 2028. | Compte à rebours vers la date choisie, aucune occurrence anticipée en 2026/2027. Le double de programmation reçoit la veille et le jour de la première date ; réception native non validée. |
| Année des historiques | Afficher des mots, cœurs et dépenses fictifs du même jour/mois sur plusieurs années ; vérifier aussi aujourd’hui et le 31 décembre vu le 1er janvier. | Année indiquée hors année courante, aujourd’hui/hier conservés. Lire avec texte agrandi et lecteur d’écran ; aucun contenu intime réel nécessaire. |
| Semaine entre deux mois | Consulter le 1er novembre depuis la semaine du 26 octobre 2026, puis le 3 janvier depuis celle du 28 décembre ; ouvrir une fiche horaire. | En-tête couvrant les deux mois/années, date complète du jour choisi et dans la fiche. Vérifier les retours à la ligne et la largeur disponible en portrait/paysage. |
| Appuis rapides de navigation | Toucher deux fois semaine suivante/précédente, puis faire un aller-retour rapide ; revenir à aujourd’hui. | Chaque appui pris en compte, jour sélectionné toujours dans la semaine affichée. Les tests couvrent aussi un ancien callback de jour, sans prétendre reproduire le geste matériel. |
| Horaires superposés et titres longs | Ajouter deux horaires fictifs du même membre aux mêmes heures, puis un horaire commun recouvrant un horaire individuel ; utiliser un titre long. | Chaque fiche reste accessible via Détail des horaires sous la grille, titre complet, heures et membre lisibles. Contrôler le défilement et VoiceOver/TalkBack. La grille conserve son placement actuel ; l’alternative détaillée ne constitue pas une correction visuelle de la superposition. |

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
### Sélecteurs d’heure — recette préparée le 21 octobre à 03:38
- [ ] Sur un appareil de test en Europe/Brussels, ouvrir un horaire de 02:30 avec la date système au 29 mars 2026, sans compte réel ni notifications activées : le sélecteur doit présenter 02:30, même si l’événement édité est un autre jour. Confirmer sans modification : 02:30 doit rester affiché.
- [ ] Sélectionner ensuite 00:15 et 23:45, fermer et rouvrir la fiche : aucune translation de fuseau. Vérifier également sous un fuseau éloigné et sur Android.
- [ ] Vérifier qu’un champ de date conserve la journée locale sélectionnée et sa borne maximale. Restaurer les réglages du téléphone de test.
Preuves disponibles : tests de propriétés et callbacks simulés uniquement ; aucune recette native cochée ni build produite.
### Cartes restaurants — recette préparée le 21 octobre à 03:41
- [ ] Avec VoiceOver puis TalkBack, atteindre séparément la fiche d’un restaurant fictif et son bouton de carte ; la fiche annonce nom/détails/auteur ou note, la carte annonce sa destination.
- [ ] Ouvrir la fiche sans lancer Maps ; ouvrir Maps sans ouvrir la fiche. Le tirage au sort possède une cible dédiée. Vérifier les cibles en texte agrandi et sur écran étroit.
Preuves actuelles : structure et événements simulés ; parcours natifs non exécutés.
### Actions des listes — recette préparée le 21 octobre à 03:43
- [ ] Dans chaque rubrique, atteindre séparément la case et la fiche avec VoiceOver/TalkBack. La case annonce titre et état ; la fiche annonce titre/détail/type de média et son action.
- [ ] Cocher un élément fictif sans ouvrir sa fiche ; ouvrir la fiche sans cocher l’élément. Vérifier texte agrandi et cibles étroites.
- [ ] Vérifier que le tirage de films possède une cible unique. L’appui long de la fiche garde la confirmation existante ; ne tester aucune suppression sur des données réelles.
Contrôles automatisés seulement ; recette native non exécutée.
### Profils et sauvegardes non confirmées — recette préparée le 21 octobre à 04:46
- [ ] Sur des données fictives uniquement, rendre un des deux profils indisponible : les dépenses restent consultables, le solde indique « Solde indisponible » et aucun remboursement n’est proposé. Restaurer les profils : le solde réapparaît sans perte du brouillon.
- [ ] Dans un environnement de test isolé permettant de perdre la réponse après l’écriture, vérifier séparément : dépense, liste, restaurant, agenda, légende/date de souvenir et date à venir. Le dialogue « Enregistrement non confirmé » recommande de vérifier les données actualisées avant une reprise ; il ne contient ni chemin interne, ni détail de l’erreur, ni contenu privé.
- [ ] Vérifier que le brouillon reste dans le formulaire, que le bouton redevient utilisable et qu’aucune écriture n’est relancée automatiquement. Vérifier texte agrandi, lecture du dialogue et retour du focus sur iOS/Android. La fermeture volontaire du formulaire ne promet pas de conserver le brouillon.
- [ ] Pour l’agenda, un résultat non confirmé n’entraîne pas de notification de succès ; utiliser uniquement un double de notification, aucun envoi réel.
Preuves disponibles : scénarios automatisés avec données et backends fictifs ; aucune de ces recettes natives exécutée. Une erreur réseau ne prouve pas que l’écriture a échoué. Ces messages ne constituent pas un protocole d’idempotence et ne garantissent pas l’absence de doublons après une reprise manuelle.
### Bandeau et années des dates — recette préparée le 21 octobre à 05:46
- [ ] Dans un espace de test fictif, avec une date de rencontre devenue future par rapport au téléphone, vérifier « Date de rencontre à vérifier », la date enregistrée et le conseil de vérifier l’horloge ; aucun compteur négatif ni cap de zéro jour. La fiche doit rester ouvrable et la date ne doit pas être réécrite automatiquement.
- [ ] Restaurer la journée correspondante avec la fiche ouverte : le compteur revient sans fermeture de la fiche ni perte de saisie. Restaurer les réglages de date/heure du téléphone après le test.
- [ ] Lors d’une indisponibilité simulée de l’espace, vérifier le message de synchronisation ; aucun conseil d’ajout de date tant que son absence n’est pas établie. À la reprise, retrouver le compteur normal.
- [ ] Pour les dates à venir, lire explicitement l’année lorsqu’elle diffère de l’année actuelle, y compris un anniversaire récurrent. En texte agrandi et avec VoiceOver/TalkBack, les messages et dates doivent rester lisibles.
Preuves automatisées seulement : résolution du logo original par Jest, valeurs et structure React. Aucun pixel, geste ni lecteur d’écran natif validé.

### Cadrage, chargement et accessibilité — recette préparée le 21 octobre à 06:48
- [ ] Avec une photo fictive, enchaîner zoom/dézoom rapidement : chaque appui est pris en compte dans les limites. Après Photo entière ou Remplir le cadre, le zoom part de ce choix ; après glissement, il conserve la position.
- [ ] Pendant un glissement, changer l’orientation ou la taille de la fenêtre : le geste s’arrête sans saut, une nouvelle prise fonctionne. Un clic de zoom/réinitialisation termine également le geste précédent. Répéter avec portrait et paysage.
- [ ] Dans un environnement de test isolé, remplacer le cadrage reçu pendant une prise encore intacte : aucun mouvement tardif ne rétablit l’ancien cadrage, une nouvelle prise utilise la valeur reçue. Le retour normal de notre propre déplacement ne doit pas interrompre le geste.
- [ ] Simuler un échec d’image avant et après affichage : conseil fixe, aucun détail technique, commandes inactives jusqu’au chargement réussi. Fermer/rouvrir et changer de photo : aucune erreur ancienne sur la nouvelle source. Aucun upload ou contenu réel pour cette recette.
- [ ] Sur iOS/Android, avec VoiceOver/TalkBack : atteindre la surface « Cadrage de la photo », entendre zoom/position et utiliser chacune des quatre actions nommées de déplacement ainsi que le zoom. Vérifier sens, bornes, annonce des changements, accès distinct aux boutons et désactivation pendant sauvegarde/échec d’image.
- [ ] Sur le web, parcourir les boutons de déplacement au clavier (Tab, Entrée/Espace), puis les boutons de zoom. Vérifier focus visible, noms annoncés, ordre, sens et retour à la ligne à petite largeur/texte agrandi.
Preuves actuelles : structure React et callbacks simulés, contrats Expo Image 57 / React Native 0.86 et implémentation clavier du composant web installée consultés. Aucun pixel, VoiceOver/TalkBack, focus navigateur ou toucher sur appareil validé ; aucune build signée ni distribution.

### Compte, profil et états de l’album — recette préparée le 21 octobre à 07:53
- [ ] Avec un souvenir fictif ouvert autour de minuit, vérifier que la date maximale avance sans perte de légende. Simuler un recul de date sur un appareil de test : une date future est expliquée, Enregistrer est désactivé, puis redevient disponible à la bonne journée. Restaurer l’horloge du téléphone.
- [ ] Simuler une réponse perdue après modification de prénom/couleur : le dialogue demande de vérifier le profil actualisé, aucun détail technique n’apparaît et le prénom saisi reste présent. Aucune reprise automatique.
- [ ] Avec des doubles d’authentification et d’envoi d’e-mail, vérifier les trois formulaires de compte : diagnostics connus conservés ; rejet inconnu remplacé ; vérification du compte/de la boîte mail proposée en cas de confirmation manquante. Vérifier fermeture, retour du focus et lisibilité en texte agrandi ; aucun e-mail ni compte réel.
- [ ] Dans la création/jonction d’espace et la carte d’invitation, simuler un rejet avec un détail privé fictif : aucune reprise du détail. Les messages de code invalide/expiré, limite atteinte et espace déjà partagé restent explicites. Après remplacement incertain, l’ancien code reste absent ; aucune invitation ni partage réel.
- [ ] Simuler un échec de photo dans la grille, la bande d’accueil, la carte anniversaire et la fiche : « Photo indisponible » remplace le vide, les autres photos et les actions restent disponibles. Un succès ou une nouvelle source retire l’indicateur ; une ancienne erreur ne le rétablit pas. Vérifier petits formats, textes agrandis, thèmes clairs/sombres et maintien des dimensions ; la légende en cours reste intacte.
- [ ] Pendant une sélection fictive, simuler une indisponibilité puis une reprise de l’album : le bouton d’ajout remonté reste occupé et inactif jusqu’à la fin de la demande. Vérifier indicateur, annonce VoiceOver/TalkBack et retour disponible, sans second envoi.
Preuves disponibles : tests React et callbacks simulés, mesure sRGB du contraste ; aucune recette native exécutée, aucun rendu visuel, focus, galerie ou authentification réelle validé. Les prérequis de sécurité, coût, confidentialité et distribution restent applicables.

### Confirmations courantes et lisibilité — recette préparée le 21 octobre à 08:44
- [ ] Dans chaque rubrique de listes, avec stockage doublé, appliquer une case puis simuler une confirmation perdue : message fixe demandant de vérifier la liste, case reçue conservée, aucun détail privé ni succès trompeur, aucune répétition automatique. Changer de rubrique pendant l’attente : aucun dialogue tardif.
- [ ] Avec des doubles de notifications, rejeter successivement autorisation, programmation et enregistrement de jeton : confirmation inconnue expliquée, aucun titre/jeton technique repris. Une reprise volontaire fonctionne ; aucun envoi réel dans cette recette.
- [ ] Avec un relevé fictif local/cloud doublé, appliquer une marque informative puis perdre la réponse : vérifier l’historique avant reprise, aucun détail technique. Le refus « relevé changé » et la fonction absente restent explicites ; aucune opération financière ou compte réel.
- [ ] Parcourir les textes secondaires de Nous, des mots doux, des formulaires et onglets dans les quatre thèmes clairs, puis sombres : lisibilité sur fonds doux et cartes, texte agrandi et VoiceOver/TalkBack. La nuance secondaire claire est #756069 ; les mesures automatisées ne prouvent pas la qualité du rendu natif.
Ces recettes ne sont pas exécutées. Aucun nouveau binaire, aperçu visuel ou statut Apple obtenu ; conditions de sécurité et de distribution inchangées.

### Historique, thème et notation — recette préparée le 21 octobre à 09:42
- [ ] Dans un espace fictif contenant plusieurs mots doux, atteindre la commande d’historique avec VoiceOver/TalkBack et au clavier web : rôle bouton, état replié/déplié, ouverture et fermeture ; le brouillon en cours reste intact. Vérifier la cible avec texte agrandi et des appuis rapprochés.
- [ ] Dans Nous, restaurer un thème enregistré puis choisir un autre thème : chaque radio annonce son nom et une seule option est cochée. Vérifier aussi les thèmes sombres et les grandes polices ; aucune préférence du partenaire ne doit être modifiée.
- [ ] Dans la fiche d’un restaurant fictif, distinguer les cinq cœurs pleins/vides en clair et sombre, toucher chaque valeur puis retirer la note sélectionnée. Vérifier cibles séparées, petite largeur et retour à la ligne ; la désactivation pendant sauvegarde reste effective. Les résumés en lecture seule restent compacts et annoncés une fois.
Preuves disponibles : structure React, interactions simulées et ratios numériques. Recettes non exécutées sur appareil/navigateur ; aucun aperçu, binaire signé ou statut Apple nouveau.

### Date de rencontre — recette préparée le 23 octobre à 00:39
- [ ] Dans un espace fictif, laisser « Votre histoire » ouverte au changement de journée : la nouvelle date doit devenir sélectionnable sans fermeture ni perte de saisie. Après recul de l’horloge rendant la date future, vérifier le message, le bouton désactivé et sa réactivation quand la date redevient valide. Le contrôle automatisé ne remplace pas le sélecteur natif ni l’essai de reprise au premier plan.

### Exemples de saisie sombres — recette préparée le 23 octobre à 00:42
- [ ] Sur l’entrée et la reconnexion, vérifier la lisibilité des exemples de prénom, code et adresse e-mail sur la carte vitrée, avec luminosité réduite et texte agrandi. Les placeholders ont une opacité de 0,65 ; les mesures numériques sur fonds composés ne remplacent pas l’observation native.

### Sélecteurs Android — recette préparée le 23 octobre à 01:31
- [ ] Avec grande taille de texte, vérifier une date longue (par exemple mercredi 30 septembre 2026) dans l’agenda, un souvenir et « Votre histoire » : date complète à l’intérieur du champ, icône séparée, hauteur suffisante et ouverture du calendrier. Contrôler aussi les deux champs horaires voisins. Styles vérifiés dans le code ; rendu et geste natifs non exécutés.

### Choix du thème — recette préparée le 23 octobre à 01:33
- [ ] Dans Nous, agrandir le texte système et réduire la largeur disponible : les quatre noms doivent rester lisibles sous leur pastille sans se chevaucher, les commandes restant séparées. Vérifier sélection, restauration et lecture des noms par VoiceOver/TalkBack. Rendu non exécuté ; les contrôles de code ne valident pas la géométrie native.
