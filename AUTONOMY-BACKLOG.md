# Priorités de développement autonome

Les entrées « à examiner » sont des pistes d’audit, pas des bugs déjà constatés. Reproduire un défaut avant de modifier le comportement. Choisir la première tâche utile réalisable avec les accès présents et sans dépense supplémentaire.

| Priorité | Tâche | État / critère de fin |
| --- | --- | --- |
| P0 | Reprendre le code et exécuter les contrôles dans le cloud, indépendamment du PC | Fait : reconstruction des 97 fichiers texte de GitHub, SHA vérifiés, installation neuve, lint, TypeScript et 41 tests réussis. Les 7 images restent absentes de cette copie de contrôle. |
| P0 | Bloquer les liens publics avec une configuration de confidentialité invalide | Fait : adresse d’assistance validée et `retentionVerified === true` exigé ; 3 cas de régression observés avant correction, 15 cas de contrôle réussis après. |
| P1 | Parcours de reconnexion et perte de réseau | À examiner : restauration de session, erreurs visibles, nouvelle tentative, absence de création silencieuse d’un nouvel espace ; corriger un défaut reproductible et vérifier sa régression. |
| P1 | Invitations et séparation des données des deux membres | À examiner : erreurs et expiration, séparation des cadeaux/réponses privées, arrivée/départ du partenaire ; commencer par lire les tests existants, vérifier uniquement sur émulateurs. |
| P1 | Échecs d’écriture et double appui | À examiner : photos, dépenses, agenda, messages ; comparer aux protections existantes, préserver la saisie et éviter les doublons en cas d’échec. |
| P2 | Accessibilité et écrans vides | À examiner sur les écrans existants : taille de texte, libellés, contraste, retour d’erreur, absence de données ; faire une amélioration précise et contrôlable sans refaire le design entier. |
| P2 | Préparation de la prochaine version interne | Préparer les notes et contrôles sur le code. Build/signature/distribution bloquées tant qu’un accès cloud utilisable et l’absence de coût supplémentaire ne sont pas vérifiés. Essai physique à distinguer des tests automatisés. |
| P2 | Politique publique et informations de l’éditeur | Bloqué partiellement : identité légale et numéro de TVA non fournis, conservation de l’assistance et copies de maintenance à finaliser. Avancer sur les autres tâches ; ne rien inventer. |

Si toutes les tâches prêtes sont terminées, faire un audit ciblé des parcours existants et inscrire uniquement des problèmes étayés. Les fonctions nouvelles doivent répondre à un besoin exprimé ou à un défaut d’usage observé et respecter la limite de coût. Ne pas ajouter de monétisation, abonnement ou service externe payant.
