# Bêta Nous Deux — 14 octobre 2026

## Distribution

- **Android** : le build 1.0.0 (3) est terminé. La page Expo affiche **Succeeded** et propose l’APK de distribution interne : [installation Android](https://expo.dev/accounts/dylancecius/projects/nous-deux/builds/bcecf4ec-ebe0-42cc-b1af-34b17be18449). Ouvrir ce lien sur le téléphone Android et télécharger l’APK. Cette version est autonome : le PC et Expo Go ne sont pas nécessaires. Le téléchargement vers l’environnement de contrôle n’a pas abouti ; l’intégrité du fichier et son fonctionnement une fois installé restent à vérifier sur un appareil.
- **iPhone** : le [build iOS 1.0.0 (6)](https://expo.dev/accounts/dylancecius/projects/nous-deux/builds/cae1ceb6-139b-4ab9-8dc3-b67b48186d50) est terminé. Son [envoi à App Store Connect](https://expo.dev/accounts/dylancecius/projects/nous-deux/submissions/dbc90a6e-4d34-4316-8581-04a073a63ebd) porte le statut EAS `FINISHED`, achevé le 14 octobre à 22 h 53 min 43 s (Bruxelles), sans erreur. L’app porte l’identifiant App Store Connect `6822899165`, enregistré dans les profils de soumission `beta` et `production`. Apple confirme désormais le build avec `processingState=VALID`, `internalState=IN_BETA_TESTING` et `externalState=WAITING_FOR_BETA_REVIEW`. La version est disponible pour les tests internes du propriétaire ; la demande de revue pour les testeurs externes a été déposée et attend Apple. L’essai réel sur iPhone reste à confirmer. La création de la clé APNs ne prouve pas la réception effective des notifications.
- Une clé App Store Connect avec le rôle `APP_MANAGER` a été créée et conservée par EAS. Seul son usage géré par EAS est nécessaire ; aucune clé privée n’est ajoutée au dépôt.
- EAS a créé le groupe interne `Team (Expo)` et activé l’accès TestFlight pour le propriétaire du compte. Aucune invitation à une autre personne ni publication publique sur l’App Store n’a été lancée. Aucun envoi au Play Store n’a été effectué.
- Le nom `Nous Deux` était indisponible dans App Store Connect ; EAS a créé l’app avec le nom provisoire `Nous Deux (2c885a)`. Choisir et vérifier un nom de boutique disponible avant la publication publique. Le bundle identifier reste `com.cecius.nousdeux`.

Les six variables Firebase sont présentes dans l’environnement EAS `preview`. Le hook `eas-build-post-install` bloque un build si elles manquent. La clé de signature Android est gérée par EAS. La configuration de production et les identifiants de soumission aux stores restent à terminer.

## Corrections incluses

- Les actions asynchrones empêchent les doubles appuis, montrent leur progression et permettent de réessayer après un échec.
- Les formulaires conservent leur contenu en cas d’échec ; les horaires inversés et les montants hors limites sont refusés.
- Une série d’horaires est enregistrée dans un seul lot atomique.
- Une panne de restauration de session propose de réessayer et ne renvoie plus silencieusement vers la création d’un compte.
- Les nouvelles données cloud utilisent l’heure Firebase ; une horloge client en avance d’une heure a permis de reproduire puis corriger un refus d’enregistrement. Les anciennes dates numériques restent lisibles.
- Les photos du mode local restent disponibles après un rechargement web.
- L’aide, les libellés accessibles et les messages de notifications ont été précisés. L’autorisation de notifications se demande depuis les réglages.
- L’assistant, l’import IA et Google Places sont masqués tant que leurs services et indicateurs ne sont pas activés. La saisie manuelle des restaurants fonctionne.

## Vérifications réalisées

| Vérification | Résultat |
| --- | --- |
| Lint et TypeScript | Réussis |
| Tests de l’app | 26 réussis |
| Règles et fonctions dans les émulateurs Firebase | 17 réussis, dont horodatage serveur et refus des dates futures |
| Parcours web en affichage mobile | 15 contrôles réussis ; largeurs 320, 390 et 430 px, thème sombre, formulaires, rechargement, aucune erreur JavaScript non interceptée |
| Deux sessions distinctes sur Firebase réel | 8 contrôles réussis : invitation, message synchronisé, réponses privées puis révélées, série d’horaires, compte e-mail, reconnexion, suppression de chacun des deux comptes |
| Bundles JavaScript Android et iOS | Compilation réussie |
| Build natif Android 1.0.0 (3) | Statut Expo Succeeded et lien APK disponibles, confirmés sur la page du build le 14 octobre 2026 ; essai sur téléphone restant |
| Garde de configuration du build | Configuration absente et indicateur invalide refusés ; configuration complète acceptée |

Les deux comptes synthétiques du dernier test cloud ont été supprimés. Les règles Firestore prenant en charge l’heure serveur ont été déployées. Les vérifications dans le navigateur ne remplacent pas les essais d’une application installée sur un téléphone physique.

## Parcours conseillé aux premiers testeurs

1. Ouvrir le lien Android ci-dessus et installer l’APK sur un téléphone de test. Sur iPhone, installer TestFlight puis ouvrir l’invitation dès que la version est approuvée pour le groupe : le fichier APK ne s’installe pas sur iOS.
2. Créer un espace sur un premier téléphone. Générer une invitation et rejoindre cet espace sur le second téléphone.
3. Dans **Nous > Ton compte**, associer un e-mail et un mot de passe avant de changer de téléphone ou de se déconnecter.
4. Envoyer un mot doux, répondre chacun à la question du jour, ajouter un horaire répété, un restaurant, une course et une dépense. Vérifier les mises à jour sur l’autre téléphone.
5. Ajouter une photo, fermer complètement l’app et la rouvrir. Vérifier la photo, le compte et les données.
6. Tester une connexion instable, le clavier, les écrans courts et le thème sombre. Vérifier qu’un formulaire reste récupérable après un échec.
7. Pour les notifications, vérifier les permissions et la réception avec l’app en arrière-plan. Les identifiants FCM/APNs et la livraison sur téléphone restent à valider.
8. Signaler le modèle du téléphone, sa version système, l’écran concerné et les étapes de reproduction, avec une capture sans contenu intime. Tester la suppression uniquement avec un compte de test.

## Avant une diffusion plus large

- Valider l’APK et la version iOS sur de vrais téléphones, notamment le démarrage, le clavier, les photos, les permissions et les notifications.
- La signature Apple et l’envoi TestFlight sont configurés ; attendre la décision de revue externe puis vérifier le groupe et le lien public.
- Finaliser puis publier les pages préparées dans `website/` : confidentialité, assistance et demande de suppression. L’aperçu est privé et les liens dans l’app restent masqués en mode brouillon. L’identité, le contact et la conservation doivent être finalisés selon `PRIVACY-RELEASE.md` ; la page d’aide intégrée ne remplace pas ces informations.
- Compléter les déclarations de données des stores, les captures et les informations d’assistance.
- Vérifier les alertes de budget, la surveillance des erreurs et la configuration App Check avant d’élargir le public.
- Si l’IA ou Places doivent être ouverts : configurer les clés exclusivement côté serveur, déployer et tester les services, puis activer les indicateurs et reconstruire l’app.

## Correctifs préparés après la soumission de la build 6

- Contact d’assistance confirmé accessible dans Aide avant connexion, même si le site est encore privé ; adresse sélectionnable et solution de repli si aucune messagerie n’est configurée.
- Permissions micro et reconnaissance vocale retirées de la configuration native quand l’assistant est désactivé. Le module vocal est également exclu de la compilation native. Sa réactivation future exige de retirer cette exclusion dans `package.json`, d’activer l’assistant et de reconstruire l’app.
- Aide alignée sur les services activés et les limites du mode local.
- Nettoyage des traces techniques implémenté et testé dans les émulateurs ; son déploiement Firebase et son exécution réelle restent à vérifier.
- Consignes d’examen et points à finaliser dans `TESTFLIGHT-REVIEW.md`.

Ces changements ne sont pas dans la build 6. Le projet n’intègre ni `expo-updates` ni configuration EAS Update : modifier GitHub ne modifie pas une application déjà installée. Les changements natifs nécessitent dans tous les cas une nouvelle build et un nouvel envoi. Les testeurs peuvent ensuite utiliser les mises à jour automatiques de TestFlight ou le bouton Mettre à jour, une fois la build disponible dans leur groupe.

- [ ] Cartes interactives et bouton + : activer Réduire les animations sans quitter l’app ; vérifier l’absence de rétrécissement à l’appui, le retour visuel par opacité et l’ouverture normale des fiches. Désactiver la préférence et vérifier le retour du zoom ; aucune action réelle sur un compte de production.

- [ ] Accueil : sur un espace de test ancien (compteur à quatre ou cinq chiffres), agrandir le texte et réduire la largeur disponible. Vérifier que le nombre et « jours ensemble » restent entièrement lisibles, quitte à passer sur deux rangées, et que l’ouverture de Votre histoire fonctionne. Essai non réalisé dans le runtime cloud.

- [ ] Cœurs reçus : avec deux comptes de test autorisés sur un même téléphone, vérifier que chaque membre conserve son propre dernier cœur vu après déconnexion/reconnexion. Première ouverture après mise à jour : pas de replay historique. Vérifier aussi l’indépendance du mode local ; aucun envoi à un vrai utilisateur.

- [ ] Premier cœur : sur un espace de test sans cœur reçu, laisser la liste se charger puis recevoir un cœur fictif depuis l’autre compte de test. Vérifier une seule annonce/célébration et aucune répétition au prochain affichage ; les historiques déjà présents à la première ouverture ne doivent pas être rejoués.

- [ ] Bulle de célébration : avec comptes de test autorisés, quitter l’espace pendant l’affichage d’un message de cœur ; vérifier son retrait immédiat à la déconnexion et l’absence de réapparition dans un autre contexte. Un simple changement d’onglet dans le même espace conserve la fin normale de la bulle. À vérifier sur appareil et sur le web.

- [ ] Agenda avec VoiceOver/TalkBack : créer uniquement dans un espace de test des horaires identiques pour chacun des membres et pour Nous deux. Vérifier que les boutons de la grille annoncent le bon membre et ouvrent sa fiche, y compris lorsque les horaires se superposent.

- [ ] Agenda avec VoiceOver/TalkBack : vérifier que le jour courant annonce « aujourd’hui » même après sélection d’un autre jour. Franchir minuit avec l’app ouverte : le repère change de date sans déplacer la sélection ; changer de semaine et vérifier qu’aucun autre jour ne l’annonce. Contrôle sur appareil non réalisé.
