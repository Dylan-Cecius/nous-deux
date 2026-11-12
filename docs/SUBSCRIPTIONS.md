# Nous Deux Plus : configuration et validation

## Offre

Positionnement recommandé : **4,99 € / mois ou 29,99 € / an pour le couple**, avec la bibliothèque complète de rendez-vous et les filtres avancés. Le quotidien existant reste gratuit : agenda, souvenirs, listes, dépenses, question du jour et messages. Voir [l’étude du marché](MARKET-AND-PRICING.md) pour les sources et leurs limites.

Le tarif présenté dans l’application vient exclusivement des produits localisés du store via RevenueCat : aucune devise, promotion, réduction ni période d’essai n’est inventée dans le code. Le tarif annuel est facturé en une fois. Le prix final doit être créé dans App Store Connect / Play Console ; ce document ne le configure pas.

## Activer les achats

1. Créer les abonnements mensuel et annuel dans App Store Connect, au sein du même groupe (et les équivalents Google Play si Android est distribué). Identifiants conseillés : `nous_deux_plus_monthly` et `nous_deux_plus_yearly`. Compléter contrats, fiscalité, coordonnées bancaires et informations de vérification des achats.
2. Dans RevenueCat, créer les applications Apple/Google correspondantes et connecter les identifiants des stores. Importer les deux produits et les rattacher à l’entitlement **`nous_deux_plus`**. Créer une offering courante contenant les packages mensuel (`P1M`) et annuel (`P1Y`). Ne pas ajouter de produit sans rapport à cette offering. Le SDK installé est `react-native-purchases` 11.0.2.
3. Régler le comportement de restauration RevenueCat sur **Keep with original App User ID** pour éviter qu’un achat soit transféré à un autre compte Firebase. L’identifiant RevenueCat est le UID Firebase stable de l’acheteur ; le client n’utilise jamais l’identifiant du couple comme compte acheteur.
4. Définir le secret serveur `REVENUECAT_SECRET_KEY` (clé secrète RevenueCat ayant accès à la lecture v1 des abonnés) avec `firebase functions:secrets:set REVENUECAT_SECRET_KEY`, puis déployer `getSubscription`. Aucune clé secrète ne va dans une variable `EXPO_PUBLIC_*`.
5. Configurer `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (clé SDK publique Apple), `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (clé SDK publique Google), `EXPO_PUBLIC_PRIVACY_URL` et `EXPO_PUBLIC_TERMS_URL` (pages HTTPS publiques définitives), puis `EXPO_PUBLIC_BILLING_ENABLED=true` dans le profil concerné. Compléter l’identité et le contact de l’exploitant sur les pages légales.
6. Reconstruire l’application native avec EAS. Le SDK fonctionne dans une application installée ; Expo Go et le web ne proposent aucun achat simulé. Un compte Firebase associé à un e-mail est requis avant de payer afin de pouvoir retrouver les achats.

## Validation des droits

`getSubscription` exige une identité Firebase active et l’appartenance actuelle au couple. Le serveur demande directement à RevenueCat l’état de chacun des deux membres, puis vérifie de nouveau leur appartenance après la réponse. Un abonnement valide de l’un profite aux deux membres actuels. Il ne persiste aucun drapeau premium que le client pourrait modifier. Les erreurs de vérification ferment l’accès payant, affichent une erreur et permettent de réessayer. La bibliothèque embarquée est protégée par le parcours UI ; des données ou actions serveur payantes supplémentaires doivent appeler `requireCouplePlus` et lier le secret `REVENUECAT_SECRET_KEY`.

La vérification est effectuée en direct à l’ouverture/focus de l’écran, au retour de l’application au premier plan et après achat/restauration. Il n’y a ni cache permanent de droit ni webhook obligatoire pour ce parcours. Les abonnements expirés et remboursés sont refusés ; une période de grâce confirmée par RevenueCat est respectée. Les réponses du SDK client ne débloquent jamais directement Plus.

## Tester avant vente

- Utiliser un projet Firebase de staging et un projet RevenueCat distinct avec les comptes de test du store. Sur **ce serveur de staging uniquement**, `BILLING_ALLOW_SANDBOX=true` accepte les transactions sandbox. Pour TestFlight et App Review, dont les achats sont aussi sandbox même avec le binaire signé pour la distribution, configurer sur le serveur de soumission **`BILLING_SANDBOX_UIDS`** avec les UID Firebase exacts des comptes de vérification dédiés (séparés par des virgules). Fournir les identifiants de connexion de ces comptes à App Review par App Store Connect et tester achat/restauration avec eux avant soumission. La vérification RevenueCat reste obligatoire ; l’allowlist n’accorde aucun droit sans transaction valide. Garder la variable globale de staging désactivée sur le backend de production. Ne pas utiliser un compte client réel comme compte de vérification.
- Vérifier sur iPhone physique : chargement des prix localisés, achat mensuel et annuel, annulation de la feuille Apple, achat différé, restauration après réinstallation, compte Firebase différent, échec réseau et absence de double facturation. Refaire les scénarios Google Play sur Android.
- Sur deux comptes de test d’un même espace, vérifier qu’un seul achat débloque les deux appareils, que le partenaire ne voit pas une incitation à repayer et qu’un ancien membre ne continue pas à partager son droit après une suppression.
- Vérifier expiration, renouvellement, annulation (accès maintenu jusqu’à l’échéance), remboursement/révocation et grâce de facturation depuis RevenueCat/store. Vérifier aussi la visibilité des liens légaux, du prix total, de la durée, de la restauration et de la gestion d’abonnement.
- Vérifier le retour de l’écran Plus vers Rituels après achat : le hook recharge l’état au focus. Si la confirmation serveur est retardée, « Actualiser mon accès » relance la vérification sans nouvel achat.

Commandes : `npm test -- --runInBand`, `npm --prefix functions run build`, `npm --prefix functions run test:unit`, puis `npm run test:security` sur émulateurs. Ces tests automatiques ne remplacent pas les transactions StoreKit/Play réelles en environnement de test.

## Suppression de compte et exploitation

La suppression d’un compte Nous Deux **ne résilie pas l’abonnement du store**. L’utilisateur gère ou annule son abonnement dans les réglages Apple/Google ; cette information figure aussi dans le parcours Plus. Les données de paiement complètes sont traitées par Apple/Google, pas par Nous Deux. L’UID Firebase est transmis à RevenueCat pour rattacher et vérifier l’achat.

Le parcours existant de suppression Firebase n’appelle pas encore l’API de suppression RevenueCat. Avant publication, l’exploitant doit définir et tester son traitement des demandes d’effacement chez RevenueCat (y compris obligations de conservation, remboursements, restauration et suppression d’un acheteur encore abonné). Ne pas effacer automatiquement le client RevenueCat sans cette politique : cela peut compromettre la restauration et ne résilie pas un achat Apple. La conservation annoncée dans la politique publique doit correspondre au traitement réellement mis en place.

La création des produits, les secrets, le déploiement serveur, la connexion des stores et les transactions sandbox n’ont pas été exécutés par cette modification. Tant que ces étapes ne sont pas réalisées, Plus reste affiché comme indisponible et l’app demeure utilisable gratuitement.
