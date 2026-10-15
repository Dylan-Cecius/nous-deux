# Marques de remboursement — protocole préparé

État du 15 octobre 2026 : code serveur testé sur les seuls émulateurs demo-nous-deux-security, non déployé. Aucun paiement : le résultat est uniquement une ligne informative dans les dépenses. Le raccordement du client reste à réaliser à ce checkpoint.

## Intention et concurrence

`recordSettlement` reçoit coupleId, expectedUserId, requestId et au plus 500 entrées attendues (id, amount, paidBy, kind). Aucun titre intime ni montant de remboursement proposé par le client n’est nécessaire. Le serveur relit le relevé en transaction, refuse tout ajout/retrait/changement depuis la vue confirmée, recalcule le solde en centimes et crée une seule marque. Un compteur serveur dans le document couple sérialise les intentions concurrentes des deux membres.

Le client doit conserver le même requestId et les mêmes entrées pour réessayer une intention après résultat ambigu. Une nouvelle intention explicite utilise un nouvel identifiant. Le reçu vérifie l’empreinte des entrées et renvoie le résultat initial sans recréer la marque, même si cette dernière a été supprimée entre-temps. Une autre intention sur l’ancien relevé échoue après le premier commit.

Les reçus sont rangés sous `couples/{coupleId}/private/{uid}/settlementRequests/{requestId}`. Ils contiennent uniquement l’empreinte, l’identifiant de la marque et une date serveur. Les règles existantes refusent toute lecture/écriture directe, même par le demandeur. Le nettoyage privé existant les retire lors de la suppression du demandeur ; celui du couple les retire lors du départ du dernier membre. Aucun délai d’expiration ni engagement de conservation n’est inventé ici. Ce nouveau stockage préparé doit rejoindre l’inventaire de confidentialité avant toute mise en production.

## Limites à ne pas masquer

- **Ancien chemin toujours autorisé** : les règles Firestore actuelles acceptent deux ajouts directs `kind=settle`. Un test d’émulateur reproduit expressément cette limite. Le nouveau protocole protège ses propres appels, pas les anciens clients ni un client qui contourne la fonction. Ne pas prétendre à une garantie globale avant la stratégie de migration et le durcissement des écritures directes.
- Les membres historiques anonymisés (`former-member`) ne sont pas attribués arbitrairement au partenaire actuel : le protocole refuse de solder automatiquement un tel relevé.
- Garde technique : 500 entrées, solde non nul et au plus 100 000 €, 30 tentatives par heure et par utilisateur. Ces bornes ne sont ni une offre payante ni une autorisation d’augmenter le budget. Le quota inclut les reprises.
- Le serveur et le client calculent séparément le même arrondi symétrique ; leurs tests couvrent les demi-centimes. Garder ce contrat cohérent lors d’une modification future.
- Aucun appel réel, build, déploiement ou migration n’a été lancé. L’accès et la preuve d’absence de coût supplémentaire restent nécessaires avant toute mise en service.

## Vérifications de préparation

41 tests de sécurité passent sur émulateurs : concurrence entre membres et même intention, réponse perdue simulée par réexécution, suppression de la marque puis reprise, modification de relevé, droits, identité, quota avant validation, limites, solde nul, centimes et nettoyage privé. La reproduction des anciennes écritures directes est volontairement conservée pour ne pas confondre préparation et fermeture du chemin historique. Les tests ne constituent pas un essai réseau sur deux téléphones.
