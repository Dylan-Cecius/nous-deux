# Marques de remboursement — protocole préparé

État du 24 octobre 2026 : code serveur testé sur les seuls émulateurs demo-nous-deux-security ; recordSettlement déployée et vérifiée ACTIVE à 13:58:49 UTC sous Node 22, révision recordsettlement-00001-sos. Dix fonctions existantes et règles Firestore inchangées. Voir SERVER-ROLLOUT.md et ses preuves. Aucun paiement : le résultat est uniquement une ligne informative dans les dépenses. Le client cloud est raccordé dans le code, avec tests d’écran simulés ; aucune nouvelle version n’est distribuée.

## Intention et concurrence

`recordSettlement` reçoit coupleId, expectedUserId, requestId et au plus 500 entrées attendues (id, amount, paidBy, kind). Aucun titre intime ni montant de remboursement proposé par le client n’est nécessaire. Le serveur relit le relevé en transaction, refuse tout ajout/retrait/changement depuis la vue confirmée, recalcule le solde en centimes et crée une seule marque. Un compteur serveur dans le document couple sérialise les intentions concurrentes des deux membres.

Le client doit conserver le même requestId et les mêmes entrées pour réessayer une intention après résultat ambigu. Une nouvelle intention explicite utilise un nouvel identifiant. Le reçu vérifie l’empreinte des entrées et renvoie le résultat initial sans recréer la marque, même si cette dernière a été supprimée entre-temps. Une autre intention sur l’ancien relevé échoue après le premier commit.

L’écran conserve l’identifiant pendant les reprises du même relevé, y compris si le titre ou l’ordre des lignes change. Ce n’est pas un secret d’accès. La réponse doit contenir un identifiant de marque valide avant d’annoncer le succès. Aucun repli sur une écriture directe n’est autorisé si la fonction échoue ou manque. Après démontage/redémarrage, l’intention en mémoire n’est pas conservée : une nouvelle demande sur un ancien relevé est refusée par la précondition serveur. La reprise exacte après redémarrage nécessiterait une persistance dédiée. Le mode local garde son annotation et ses verrous existants, sans fonction cloud ni nouvelle garantie multi-onglets.

Les reçus sont rangés sous `couples/{coupleId}/private/{uid}/settlementRequests/{requestId}`. Ils contiennent uniquement l’empreinte, l’identifiant de la marque et une date serveur. Les règles existantes refusent toute lecture/écriture directe, même par le demandeur. Le nettoyage privé existant les retire lors de la suppression du demandeur ; celui du couple les retire lors du départ du dernier membre. Le 24 octobre 2026, le propriétaire a confirmé explicitement la conservation des reçus de remboursement jusqu’à la suppression du compte concerné ou de l’espace du couple, conformément au nettoyage existant : départ du demandeur, conservation des reçus du partenaire restant, puis nettoyage global au dernier départ. Supprimer une marque ne supprime pas son reçu. Pas de purge périodique ni de délai maximal en jours ; les reprises du nettoyage restent possibles. Cette décision concerne les données actives du protocole de remboursement, pas les reçus de souvenirs, l’assistance, les sauvegardes ni une validation juridique. L’inventaire figure dans FIREBASE-RETENTION.md ; l’aide intégrée et les sources de la politique en brouillon décrivent ce choix. Leur publication effective et les déclarations de la version restent à vérifier avant distribution.

## Limites à ne pas masquer

- **Durcissement préparé, pas activé** : les règles de cette branche refusent la création directe de `kind=settle`, la conversion d’une dépense en marque et toute modification d’une marque existante. Seul le serveur crée les marques. Lecture et retrait restent possibles pour les membres autorisés ; les dépenses ordinaires restent éditables. Le doublon historique a été reproduit avant correction et le test vérifie désormais son refus. Rien ne prouve que ces règles sont déjà en production.
- Les membres continuent à pouvoir ajouter, modifier et retirer les dépenses partagées : le protocole ne certifie ni la véracité des montants saisis ni un paiement réel. Retirer une marque puis confirmer une nouvelle intention est une action distincte, autorisée ; reprendre l’ancienne intention ne la recrée pas.
- Les membres historiques anonymisés (`former-member`) ne sont pas attribués arbitrairement au partenaire actuel : le protocole refuse de solder automatiquement un tel relevé.
- Garde technique : 500 entrées, solde non nul et au plus 100 000 €, 30 tentatives par heure et par utilisateur. Ces bornes ne sont ni une offre payante ni une autorisation d’augmenter le budget. Le quota inclut les reprises.
- Le serveur et le client calculent séparément le même arrondi symétrique ; leurs tests couvrent les demi-centimes. Garder ce contrat cohérent lors d’une modification future.
- Aucun appel de test sur des comptes réels ni migration. Le serveur a été déployé le 24 octobre après confirmation de la conservation et vérification de l’essai sans frais. Aucun nouveau client distribué ; règles durcies et transition restent à valider.

## Vérifications de préparation

Les tests de sécurité couvrent concurrence entre membres et même intention, réponse perdue simulée par réexécution, suppression de la marque puis reprise, modification de relevé, droits, identité, quota avant validation, limites, solde nul, centimes et nettoyage privé. Les tests de règles ajoutent refus des écritures directes/conversions/altérations et maintien des lectures, retraits et dépenses ordinaires. Les résultats datés figurent dans AUTONOMY-LOG.md ; ils ne constituent pas un essai réseau sur deux téléphones.

## Ordre de mise en service à vérifier, sans déploiement automatique

1. Confirmer les accès, l’absence de coût supplémentaire et l’inventaire de confidentialité ; sinon rester en préparation.
2. Déployer et vérifier le serveur compatible, puis tester le nouveau client en interne. Le nouveau client sans fonction signale une erreur ; il ne contourne pas le protocole.
3. Préparer le remplacement des anciens clients et tester une session ancienne/nouvelle. L’activation des règles durcies bloque le bouton de marque des versions utilisant l’ajout direct. Ne pas la présenter comme transparente, ni la déclencher sans coordination de version.
4. Activer les règles uniquement quand cette compatibilité et les essais nécessaires sont validés. Ne pas remettre automatiquement des règles permissives en cas d’erreur : conserver le refus sûr et diagnostiquer le serveur/client.

Pendant une éventuelle transition sans règles durcies, les anciens ajouts restent un chemin de doublon. Aucune garantie globale ni distribution sûre n’est revendiquée avant fermeture vérifiée de ce chemin. Seul le déploiement de la fonction serveur est effectué et vérifié ; aucune activation des règles durcies ni aucun essai natif n’est revendiqué.
