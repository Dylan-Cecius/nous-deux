# Préparation App Store — Nous Deux 1.1

État du dossier : **12 novembre 2026**. Ce document prépare une soumission ; il ne certifie ni un build signé, ni un achat réel, ni une approbation Apple. Les résultats techniques de la session figurent dans le compte rendu du changement et dans la CI. Le document bêta d’octobre décrit une version antérieure et ne valide pas la version 1.1.

## Conditions à lever avant l’envoi

| Sujet | Travail préparé dans le dépôt | Validation externe nécessaire |
| --- | --- | --- |
| Identité et assistance | Champs publics configurables et pages légales dans l’app | Renseigner `EXPO_PUBLIC_LEGAL_ENTITY`, `EXPO_PUBLIC_SUPPORT_EMAIL`, identité/adresse complète et contact opérationnel. Ne pas déduire l’exploitant d’un pseudo GitHub. |
| Confidentialité publique | Inventaire ci-dessous et brouillons `docs/legal/` | Finaliser bases légales, durées, transferts et prestataires réellement utilisés ; héberger sans connexion sur HTTPS ; renseigner `EXPO_PUBLIC_PRIVACY_URL` et `EXPO_PUBLIC_TERMS_URL` ainsi qu’App Store Connect. Un fichier du dépôt ou une page d’aide interne ne remplace pas l’URL publique. |
| Apple Developer | Identifiant `com.cecius.nousdeux`, configuration EAS | Compte vendeur actif, accords, banque/fiscalité, droits App Store Connect, signature iOS et profil. Ces accès ne sont pas présents dans le dépôt. |
| Facturation | Parcours d’achat/restauration et vérification serveur à inspecter dans le changement | Produits auto-renouvelables, groupe unique, prix localisés, RevenueCat, clés **publiques** client et secret exclusivement serveur, entitlement et offering. Tester les transactions Sandbox, la vérification directe des droits et l’expiration. Aucun webhook n’est requis par le parcours actuel. |
| Backend | Règles, fonctions et migration de sécurité existantes | Déployer la version correspondante dans le projet cible avec les secrets requis ; tester deux téléphones et surveiller les coûts. Un changement Git ne déploie pas Firebase. |
| Confidentialité iOS | Déclarations de manifeste préparées | Inspecter le rapport de confidentialité du **build natif signé final**, dont RevenueCat et ses dépendances, et vérifier les motifs d’API réellement utilisés. |
| Suppression et contenus | Suppression dans Nous → Ton compte, traitement serveur reprenable, retrait des contenus de l’auteur | Déployer et rejouer le scénario sur la version courante ; confirmer l’effacement des fichiers et des contenus partagés et les avertissements sur les dates et dépenses. |
| App Review | Fiche et parcours proposés ci-dessous | Fournir un compte synthétique valide, environnement disponible, captures réelles, classification d’âge, déclaration de données, statut commerçant UE et revue finale. |
| Usage réel | Vérifications automatisées possibles | TestFlight sur iPhone physique, achat/restauration avec compte Sandbox, clavier, caméra, bibliothèque, contraste, VoiceOver et notifications. |

Commande locale de garde préparée par le projet : `npm run check:store`. Le hook EAS refuse également un build `production` sans identité, contact et URL légales ; une version avec achats activés exige les clés SDK natives et les liens légaux. Elle ne prouve pas le déploiement serveur, la validité des contrats ni le comportement des achats. Exécuter également lint, TypeScript, tests app, tests de sécurité émulateurs et export web selon les scripts du projet. Ne pas publier automatiquement sur la seule base d’un contrôle de variables.

## Réserves concrètes de revue

**Suppression.** La [FAQ Apple sur la suppression](https://developer.apple.com/support/offering-account-deletion-in-your-app/) indique que le contenu utilisateur partagé doit aussi être supprimé, sauf conservation légalement requise. Le changement courant retire les contenus de l’auteur (y compris restaurants, listes, dépenses et événements), les événements attribués au membre partant, ainsi que toutes les dates partagées et la date de rencontre dont les anciennes données n’identifient pas l’auteur. Le solde des dépenses peut changer. Les contenus attribués au partenaire restent ; le dernier départ efface l’espace. Ce comportement doit être testé et déployé ; la politique et les avertissements doivent correspondre au serveur effectivement actif. La tâche de suivi de suppression et les journaux doivent avoir une durée documentée.

**Contenus partagés et sécurité personnelle.** L’app est un espace privé sur invitation à deux, sans fil public ni découverte d’inconnus. Expliquer ce cadre à Review, sans présumer d’une exemption à la [règle 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) sur les contenus utilisateurs. Vérifier les moyens de signalement, le contact publié et le parcours permettant de couper l’accès à un partenaire abusif. Une suppression irréversible de compte n’est pas nécessairement un remplacement suffisant d’un blocage. Ne pas promettre une modération qui n’existe pas.

**Compte anonyme et abonnement.** Le compte anonyme dépend de sa session. Avant le paiement, le parcours doit permettre de sécuriser un compte durable et la restauration doit être vérifiée après réinstallation. La suppression du compte ne doit pas être présentée comme une résiliation ; elle doit rappeler la gestion des abonnements du store sans empêcher la suppression immédiate.

**Assistant et adresses.** Ne pas annoncer ces services s’ils restent désactivés. L’import en photo doit annoncer le prestataire, obtenir le consentement avant tout envoi et permettre de vérifier les lignes avant enregistrement. Ne pas utiliser de planning professionnel réel dans les données de démonstration.

## Abonnement dans App Store Connect et RevenueCat

1. Créer un groupe d’abonnements **Nous Deux Plus**, avec deux durées de même niveau : un mois et un an. Vérifier les identifiants attendus par le code/configuration avant de créer les produits ; les identifiants publiés sont durables.
2. Prix cibles France : **4,99 €/mois** et **29,99 €/an**. Vérifier les paliers disponibles, les autres territoires, les taxes et la devise. Aucun essai obligatoire au lancement.
3. Raccorder les produits à l’entitlement et à l’offering RevenueCat attendus par le code. Vérifier que les clés client correspondent à la bonne plateforme et que les secrets serveur ne commencent jamais par `EXPO_PUBLIC_`.
4. Si l’offre couvre deux comptes, valider côté serveur leur appartenance au couple et les droits de chaque membre. Tester le départ du payeur, l’invitation d’un nouveau partenaire, le transfert de compte, les événements en double et les événements anciens reçus après un remboursement. Ne pas activer le Family Sharing d’Apple sans politique et test séparés.
5. Montrer avant achat : nom du produit, bénéfices réellement disponibles, durée, **prix total** facturé, renouvellement automatique, liens fonctionnels vers conditions/confidentialité, restauration et gestion. L’App Store affiche la confirmation finale. Ne pas envoyer vers Stripe pour déverrouiller les biens numériques iOS dans cette version.
6. Fournir à Review la capture du paywall et les notes des achats intégrés ; joindre les premiers abonnements à la version soumise quand Apple le demande. Les éventuelles promotions doivent correspondre à une offre réellement configurée et à l’éligibilité transmise par le store.

Matrice Sandbox minimale : achat mensuel, achat annuel, annulation de la feuille Apple, achat en attente, panne réseau, fermeture pendant achat, double appui, restauration après réinstallation et connexion, même compte Apple/autre compte Nous Deux, second partenaire, renouvellement, expiration, remboursement/révocation, passage mensuel → annuel, suppression du compte abonné. Aucun de ces cas ne doit rendre Premium actif à partir d’un simple état client modifiable.

Références : [règles Apple 3.1.1 et 3.1.2](https://developer.apple.com/app-store/review/guidelines/#payments), [abonnements Apple](https://developer.apple.com/app-store/subscriptions/), [licence standard Apple](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/).

## Inventaire pour la déclaration « App Privacy »

À confronter aux catégories exactes affichées par Apple et aux SDK du binaire final. Ne pas sélectionner « aucune donnée collectée » : la synchronisation implique une collecte serveur. Une base en Europe n’empêche pas tous les transferts des prestataires.

| Données observées dans le code | Pourquoi | Destinataires / remarque |
| --- | --- | --- |
| Prénom, e-mail facultatif, UID, appartenance au couple | Compte, synchronisation, récupération | Firebase Auth/Firestore. Liées au compte même si le prénom est un pseudonyme. |
| Photos et textes ajoutés ; question/réponse ; mots doux ; listes ; agenda et dates | Fonctionnalité | Firestore/Storage et partenaire selon le contrôle d’accès. Le contenu peut révéler des informations sensibles. |
| Montant, titre et payeur d’une dépense | Répartition des dépenses | Firestore et partenaire. Évaluer « autres informations financières » dans le questionnaire ; aucune carte bancaire collectée par l’app. |
| UID, identifiants de transaction, état d’abonnement et achats | Paiement et contrôle des droits | Apple/Google et RevenueCat, selon configuration finale ; catégorie achats à vérifier. |
| Jeton push, permission et identifiant d’appareil technique associé | Notification au partenaire | Expo puis APNs/FCM. Le jeton n’est pas un identifiant publicitaire. |
| Demande assistant, image de planning choisie, consentement versionné | Service IA facultatif | Functions et Anthropic après consentement ; ne pas affirmer absence de conservation chez le prestataire sans vérifier ses conditions actives. |
| Recherche de restaurant | Recherche Places facultative | Google Places via serveur. Le code n’implique pas un accès GPS continu. |
| Journaux et quotas de sécurité, demande de suppression | Fiabilité et protection du service | Firebase/Cloud ; préciser conservation, accès opérateur et suppression. |
| Préférence de thème et session locale | Personnalisation locale | Stockage de l’appareil. Examiner séparément toute synchronisation ajoutée par un SDK. |

Aucun SDK publicitaire ni suivi inter-app n’a été identifié dans l’inventaire initial. La propriété `NSPrivacyTracking=false` est une déclaration à confirmer sur le build final, pas une preuve d’absence de suivi. Le manifeste ne remplace pas les réponses App Privacy. Source : [gérer les informations de confidentialité](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).

Les motifs d’API iOS préparés proviennent des manifestes installés Expo SDK **57**, React Native **0.86** et AsyncStorage, puis du [guide Expo Apple Privacy](https://docs.expo.dev/guides/apple-privacy/) : `UserDefaults CA92.1`, `FileTimestamp C617.1 / 0A2A.1 / 3B52.1`, `DiskSpace E174.1 / 85F4.1`, `SystemBootTime 35F9.1`. Conserver seulement les déclarations justifiées par les dépendances du binaire et inspecter le rapport Xcode agrégé après intégration des achats natifs.

## Fiche française prête à adapter

Nom (moins de 30 caractères) : **Nous Deux : la vie à deux**

Sous-titre (moins de 30 caractères) : **Vos moments, votre quotidien**

Catégorie proposée : **Style de vie**. Classification d’âge : remplir le questionnaire d’Apple selon le contenu réellement livré ; ne pas choisir arbitrairement un âge pour éviter un contrôle.

Texte promotionnel :

> Un petit espace pour votre grande histoire. Retrouvez vos envies, votre agenda et vos moments à deux, avec une question pour vous rapprocher chaque jour.

Description proposée — conserver seulement les éléments validés dans le build soumis :

> Votre quotidien mérite aussi ses petits moments à deux.
>
> Nous Deux réunit vos idées, vos rendez-vous et vos souvenirs dans un espace privé sur invitation. Créez votre espace, invitez votre partenaire et faites une place à votre histoire.
>
> UN PETIT RITUEL POUR VOUS RETROUVER
> Répondez à la question du jour et découvrez vos réponses après avoir tous les deux participé. Envoyez un mot doux ou un simple « Je pense à toi ».
>
> LE QUOTIDIEN, PLUS SIMPLE À DEUX
> Rapprochez vos horaires, préparez vos courses, gardez les restaurants à essayer et les films à regarder. Retrouvez vos dates importantes et répartissez vos dépenses communes.
>
> UNE PLACE POUR VOTRE HISTOIRE
> Gardez vos photos, retrouvez vos souvenirs et comptez les jours depuis votre rencontre. Vos idées cadeaux restent privées.
>
> VOTRE ESPACE, VOS CHOIX
> Sécurisez votre compte pour le retrouver sur un autre téléphone. Les permissions sont demandées pour les fonctions que vous choisissez. Vous pouvez supprimer votre compte depuis l’app.
>
> NOUS DEUX PLUS, SI VOUS EN AVEZ ENVIE
> Explorez toute la bibliothèque d’idées de rendez-vous et de rituels, avec des filtres selon vos envies, votre temps et votre budget. Un seul abonnement profite aux deux comptes de votre espace. Le contenu de l’offre, son prix et sa durée sont affichés avant l’achat. L’abonnement se renouvelle automatiquement, sauf résiliation dans les réglages de votre compte Apple avant le renouvellement. Consultez et gérez vos achats depuis l’écran Nous Deux Plus. L’accueil, l’agenda, les listes et les souvenirs restent gratuits.

Ajouter à la fin de la description les **vraies URL publiques** de confidentialité et conditions ; la licence standard Apple peut être liée si elle est le choix définitif du vendeur. Remplacer les brouillons avant collage dans App Store Connect. Ne pas annoncer « chiffrement de bout en bout », « sauvegarde garantie », « illimité », « sauve votre couple » ou un essai gratuit absent du catalogue.

Mots-clés proposés (moins de 100 caractères, à revoir dans Connect) : `couple,agenda,souvenirs,amour,listes,questions,relation,partage,anniversaire`

Plan de captures sur iPhone réel ou simulateur du build natif, avec données fictives :

1. Accueil — « Un petit moment pour nous ».
2. Agenda — « Trouvez du temps à deux ».
3. Question du jour — « Encore tant à découvrir ».
4. Listes / envies — « Vos petites et grandes envies ».
5. Souvenirs — « Gardez les moments qui comptent ».
6. Premium, uniquement si achats actifs — « Encore plus de moments à deux », prix et mentions exacts du build.

Exporter les dimensions requises pour les appareils sélectionnés dans App Store Connect et vérifier la [spécification de captures Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/). Ne pas présenter une capture web comme preuve d’un rendu natif. Éviter contenus intimes, vraies adresses e-mail et plannings professionnels dans les images.

Les achats de TestFlight et d’App Review utilisent aussi le Sandbox : configurer les comptes dédiés dans `BILLING_SANDBOX_UIDS` côté serveur selon [le guide des abonnements](SUBSCRIPTIONS.md), puis vérifier qu’ils débloquent réellement Plus avant la soumission.

## Notes App Review à compléter

Texte de base, à fournir en anglais avec les accès de test dans les champs privés d’App Store Connect :

> Nous Deux is a French-language app for two partners sharing an invitation-only space. There is no public feed or stranger discovery. Please use the synthetic review account supplied in the sign-in fields. The paired account and sample content contain no real personal data. From the welcome screen, choose “J’ai déjà un compte”. Account deletion is available under Nous → Ton compte → Supprimer mon compte. Premium is accessible from Nous. Purchases use Apple in-app subscriptions; restore and subscription management controls are on the Premium screen. Optional AI and Places features are [enabled and testable / disabled and omitted from this submission]. The attached purchase notes explain the exact Premium entitlement and its availability to the two accounts.

Ne pas envoyer ce texte avec les crochets. Créer et tester les comptes synthétiques juste avant la revue, maintenir le serveur disponible, expliquer les services facultatifs et fournir une vidéo uniquement en complément si utile. Le compte de démonstration ne doit pas posséder de données privées réelles.

## Ordre d’exécution

1. Terminer les informations vendeur et légales, le catalogue et le backend ; lever les réserves ci-dessus.
2. Exécuter les contrôles locaux et la garde de publication avec les variables du profil choisi. Vérifier les URL publiques depuis un appareil déconnecté de tout compte.
3. Avec une session Expo/Apple autorisée : `npx eas-cli@latest build --platform ios --profile beta` pour TestFlight. Ne pas réutiliser l’APK Android comme validation iOS.
4. Tester le binaire et les transactions ; inspecter le manifeste final et les crashs. Corriger puis reconstruire au besoin.
5. Renseigner métadonnées, déclaration de confidentialité, classification, contact review, achats, captures et documents légaux dans Connect.
6. Construire le profil `production` avec ses variables, puis soumettre le binaire validé avec le profil correspondant. Choisir une diffusion manuelle pour contrôler la mise à disposition après validation Apple.

Références officielles consultées le 12 novembre 2026 : [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [suppression de compte](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [confidentialité App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [EAS Submit](https://docs.expo.dev/submit/introduction/).
