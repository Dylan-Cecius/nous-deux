# Association de souvenirs — préparation, non activée

État au 15 octobre 2026 : `functions/src/memories.ts` est testé sur émulateurs mais **n’est pas exporté par `functions/src/index.ts`**. Aucun appelant applicatif n’est raccordé. Un déploiement général du point d’entrée actuel ne doit donc pas publier cette nouvelle fonction. Aucun déploiement n’a été effectué pour ce protocole.

## Défaut traité et contrat préparé

Le parcours actuel fait `uploadPhoto`, puis `backend.add('memories', ...)`. Une confirmation perdue après l’ajout ne prouve pas son absence ; une nouvelle création à identifiant aléatoire peut doubler le souvenir. Le client conserve actuellement son message honnête « Enregistrement non confirmé » ; il ne dispose pas encore de la reprise ci-dessous.

`associateMemory` reçoit l’espace, l’identité attendue, une clé d’intention de 12–80 caractères, l’URL photo, la légende et la date. Le demandeur doit être actif et membre ; l’espace ne doit pas être en suppression. La même clé est isolée par espace et demandeur.

Une transaction crée ensemble le souvenir et un reçu privé contenant seulement l’empreinte du contenu normalisé, l’identifiant de souvenir et une date serveur. Une reprise identique retourne l’identifiant initial sans réécrire la fiche, y compris après modification ou suppression de celle-ci. Une clé réutilisée avec un autre contenu est refusée. Un retour d’identifiant ne prouve donc **pas** que la fiche existe encore : le futur client devra relire l’album et ne pas annoncer à tort une recréation.

## Photos et limites

- URL HTTPS Firebase Storage uniquement, bucket configuré, chemin exact `couples/{coupleId}/photos/{uid}/{filename}`. Aucun téléchargement depuis une URL client arbitraire.
- Métadonnées du fichier vérifiées avant première association : présence, taille positive et inférieure à 10 Mio, type image JPEG/PNG/WebP, jeton de téléchargement correspondant. Les règles existantes refusent la mise à jour des fichiers de ce chemin ; elles permettent leur suppression au propriétaire.
- Le repli compact JPEG en data URI reste compatible, avec base64 non vide, format et taille du **base64 seul** strictement inférieure à 600000 caractères (préfixe exclu, comme `toCompactDataUri`). Il ne déclenche aucun nouveau service ni upload. Cette validation ne décode pas les pixels et n’atteste pas la qualité ni l’intégrité visuelle d’une image.
- La transaction couvre Firestore, **pas** Storage : un fichier peut être retiré indépendamment pendant/après l’association. Pas de suppression compensatoire, de récupération automatique d’orphelins, de nouvelle tentative d’upload ou de déduplication de deux intentions différentes.
- Quota anti-abus préparé : 30 demandes/heure par membre, reprises comprises, via le mécanisme existant. Ce quota n’est ni un budget ni une preuve d’absence de coût supplémentaire.
- Les anciennes créations directes de souvenirs restent autorisées par les règles : ce protocole n’est pas une garantie globale pour tous les anciens clients.

## Conservation et activation

Les reçus `private/{uid}/memoryRequests/{requestId}` sont refusés en lecture/écriture directe, même au demandeur, par les règles existantes. Ils suivent le nettoyage privé au départ du demandeur et le nettoyage complet au dernier départ ; le reçu du partenaire restant est conservé. Une suppression de souvenir seule ne retire pas son reçu, pour empêcher sa recréation par une réponse tardive.

Il n’existe pas de purge périodique de ces reçus et aucune durée maximale n’est promise. Leur empreinte et leur chemin restent des données rattachées à un compte, non anonymes. Décision de conservation et information publique requises avant activation ; voir `FIREBASE-RETENTION.md`. Ne pas inventer de durée ni activer `retentionVerified`.

Suite de développement gratuite : préparer une intention client stable et explicite après upload, sa reprise sans sélectionner/envoyer à nouveau la photo, son isolation au changement de compte et l’affichage d’un résultat dont la fiche peut avoir été supprimée. Ne pas modifier le parcours actif avant tests complets, choix de persistance et traitement des réponses ambiguës. Le mode local n’est pas rendu idempotent par ce module serveur.

### Contrôleur client préparé, non raccordé

`src/lib/memory-association.ts` prépare une intention uniquement après un upload réussi, avec une clé fournie par le futur appelant et validée. Sa préparation ne fait aucun appel. `submit()` est explicite : deux appels simultanés partagent la même promesse ; un rejet ou une réponse invalide donne `unconfirmed` et conserve exactement la même clé, photo, légende et date pour la reprise. Aucun upload, création aléatoire, reprise automatique, stockage persistant ni service supplémentaire n’est déclenché par ce contrôleur.

Une réponse valide donne `receipt-confirmed`, jamais « photo créée/présente ». L’interface future doit attendre la lecture courante de l’album et gérer la fiche déjà supprimée. Le résultat confirmé est mémorisé pour ne pas renvoyer inutilement ; cela ne remplace pas une actualisation de l’album.

L’appelant devra fournir des gardes courants `isCurrent` (session/espace/backend/ouverture) et `canSubmit` (lecture de l’album disponible), puis appeler `invalidate()` au changement de session, à la fermeture et au démontage, y compris un aller-retour entre deux comptes. Une perte de contexte observée invalide définitivement l’intention ; une écriture déjà partie ne peut pas être annulée. Ce module seul ne peut pas détecter un changement puis retour entre deux observations sans l’invalidation fournie par l’interface.

La clé n’est pas générée ici : choisir une source d’identifiants unique et compatible Expo lors du raccordement. Aucune intention n’est persistée après fermeture/redémarrage. Tant que le choix de persistance et l’interface de reprise ne sont pas prêts, aucun écran ne doit importer ce module et le parcours actif reste inchangé. Les 29 contrôles unitaires utilisent un transport doublé ; ils ne prouvent pas un parcours complet téléphone/serveur.

Avant activation : protocole client testé, conservation décidée, règle de transition des anciens clients documentée, accès et absence de coût supplémentaire vérifiés ; ensuite seulement exposition volontaire du module, déploiement autorisé et validation séparée avant diffusion du client. Aucun échec ne doit entraîner un repli aveugle sur l’ancienne création aléatoire.

## Preuves et portée

Les tests utilisent uniquement `demo-nous-deux-security` : concurrence, reprises, modifications/suppression de fiche, confidentialité des reçus, identités, appartenance, suppression en cours, payloads invalides, quota, références de fichiers et métadonnées. Les fichiers de test sont des octets fictifs, pas des photos personnelles ni des essais de rendu. Les scénarios de suppression couvrent les reçus du demandeur et les orphelins au dernier départ.

Quatre tests de contrat supplémentaires compilent le véritable contrôleur TypeScript client et l’appellent avec le véritable module serveur sur les émulateurs : réponse perdue après commit puis modification partenaire, réponse invalide puis fiche supprimée, deux instances avec une même clé, invalidation après écriture. Les 67 tests sécurité passent. L’adaptateur de transport est contrôlé et appelle `associateMemory.run()` directement : ce n’est pas un test HTTPS Callable, Auth natif, upload mobile ou interface complète. Le module demeure non exporté, et les écrans ne sont pas raccordés.

Références techniques consultées : [transactions Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [Storage Admin](https://firebase.google.com/docs/storage/admin/start). Le code conserve Firebase et les dépendances existantes ; aucun nouveau service provisionné.
