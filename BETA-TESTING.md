# Bêta Nous Deux — 14 octobre 2026

## Distribution

- **Android** : le build 1.0.0 (3) est terminé. La page Expo affiche **Succeeded** et propose l’APK de distribution interne : [installation Android](https://expo.dev/accounts/dylancecius/projects/nous-deux/builds/bcecf4ec-ebe0-42cc-b1af-34b17be18449). Ouvrir ce lien sur le téléphone Android et télécharger l’APK. Cette version est autonome : le PC et Expo Go ne sont pas nécessaires. Le téléchargement vers l’environnement de contrôle n’a pas abouti ; l’intégrité du fichier et son fonctionnement une fois installé restent à vérifier sur un appareil.
- **iPhone** : la signature Apple est configurée. Le [build iOS 1.0.0 (6)](https://expo.dev/accounts/dylancecius/projects/nous-deux/builds/cae1ceb6-139b-4ab9-8dc3-b67b48186d50) est lancé dans le cloud ; statut EAS `IN_PROGRESS` vérifié le 14 octobre vers 22 h 42 (Bruxelles), sans erreur signalée. Sa réussite et sa soumission à TestFlight restent à vérifier.
- Aucun envoi aux stores, aucune invitation de testeur et aucune publication publique n’ont été effectués.

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

1. Ouvrir le lien Android ci-dessus et installer l’APK sur un téléphone de test. Sur iPhone, attendre la préparation du build TestFlight : le fichier APK ne s’installe pas sur iOS.
2. Créer un espace sur un premier téléphone. Générer une invitation et rejoindre cet espace sur le second téléphone.
3. Dans **Nous > Ton compte**, associer un e-mail et un mot de passe avant de changer de téléphone ou de se déconnecter.
4. Envoyer un mot doux, répondre chacun à la question du jour, ajouter un horaire répété, un restaurant, une course et une dépense. Vérifier les mises à jour sur l’autre téléphone.
5. Ajouter une photo, fermer complètement l’app et la rouvrir. Vérifier la photo, le compte et les données.
6. Tester une connexion instable, le clavier, les écrans courts et le thème sombre. Vérifier qu’un formulaire reste récupérable après un échec.
7. Pour les notifications, vérifier les permissions et la réception avec l’app en arrière-plan. Les identifiants FCM/APNs et la livraison sur téléphone restent à valider.
8. Signaler le modèle du téléphone, sa version système, l’écran concerné et les étapes de reproduction, avec une capture sans contenu intime. Tester la suppression uniquement avec un compte de test.

## Avant une diffusion plus large

- Valider l’APK et la version iOS sur de vrais téléphones, notamment le démarrage, le clavier, les photos, les permissions et les notifications.
- Configurer la signature Apple et les comptes de distribution, puis les accès des testeurs.
- Finaliser puis publier les pages préparées dans `website/` : confidentialité, assistance et demande de suppression. L’aperçu est privé et les liens dans l’app restent masqués en mode brouillon. L’identité, le contact et la conservation doivent être finalisés selon `PRIVACY-RELEASE.md` ; la page d’aide intégrée ne remplace pas ces informations.
- Compléter les déclarations de données des stores, les captures et les informations d’assistance.
- Vérifier les alertes de budget, la surveillance des erreurs et la configuration App Check avant d’élargir le public.
- Si l’IA ou Places doivent être ouverts : configurer les clés exclusivement côté serveur, déployer et tester les services, puis activer les indicateurs et reconstruire l’app.
