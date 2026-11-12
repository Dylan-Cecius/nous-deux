# Nous Deux 💞

Application mobile pour les couples (Android + iOS), faite avec Expo / React Native.

Pour la version de test et les vérifications restantes, lire [BETA-TESTING.md](BETA-TESTING.md).

## Ce que fait l'app

| Onglet | Contenu |
| --- | --- |
| **Accueil** | Compteur « X jours ensemble » sur votre photo de couple (repositionnable), bouton **Je pense à toi**, mots doux, **question du jour** (réponse de l'autre dévoilée après la sienne), programme du jour, comptes à rebours avec rappels J-1, **souvenirs** (« Il y a un an… ») |
| **Agenda** | Une colonne par personne, horaires répétés chaque semaine, créneaux **libres tous les deux**, **import du planning en photo** (IA) |
| **Restos** | À tester / Favoris / Testés, note en cœurs, **recherche Google avec photo et adresse**, tirage au sort « On mange où ? » |
| **Listes** | Rêves (bucket list, confettis quand on coche), Films & séries (tirage au sort), **Courses** partagées, **Cadeaux secrets** (invisibles pour l'autre) |
| **Nous** | Profils et couleurs, **Souvenirs** (album), **Dépenses communes** (qui doit combien), notifications, **thème de couleur**, invitations temporaires |

Lorsque le service IA et son indicateur d’activation sont configurés, le bouton **micro** ouvre l'**assistant** : « Ajoute Chez Mario dans nos favoris », « Je bosse jeudi de 9h à 17h », « Ajoute du lait aux courses »… Il propose les actions, tu valides.

Appui long sur un élément pour le supprimer.

### Ce qui marche où

| Fonction | Expo Go | Version installée (EAS) |
| --- | --- | --- |
| Tout l'app en mode local | ✅ | ✅ |
| Synchro à deux, photos partagées | ✅ avec Firebase | ✅ avec Firebase |
| Rappels J-1 / Jour J (notifications locales) | ✅ | ✅ |
| Notifications envoyées à ta moitié (push) | Désactivées dans Expo Go | Après configuration FCM/APNs, permission et test sur téléphone |
| Dictée vocale | Indisponible | Avec assistant activé et permission micro |
| Assistant IA, import de planning, recherche de restos | Avec services serveur, clés et indicateurs activés | Même configuration requise ; désactivés dans la bêta actuelle |

## Lancer l'app sur ton téléphone (5 min)

1. Installe **Expo Go** sur ton téléphone (Play Store / App Store).
2. Dans ce dossier (ou double-clic sur `Lancer l'app.cmd`) :
   ```bash
   npx.cmd expo start
   ```
3. Scanne le QR code avec Expo Go (Android) ou l'appareil photo (iPhone).

Sans configuration Firebase, l'app fonctionne en **mode local** (les données restent sur un seul téléphone).

## Activer la synchro entre vos deux téléphones (Firebase)

Pour un projet existant, suivre d’abord [la procédure de migration de sécurité](SECURITY-DEPLOYMENT.md). Les fonctions serveur de sécurité sont désormais nécessaires à la création et à la jonction d’un espace ; elles demandent un projet Firebase permettant le déploiement de Cloud Functions.

1. Va sur <https://console.firebase.google.com>, crée un projet (Google Analytics pas nécessaire).
2. **Authentication** > Commencer > onglet *Sign-in method* > active **Anonyme**.
3. **Firestore Database** > Créer une base de données (région `eur3` par ex.) en mode production.
4. Onglet **Règles** de Firestore : colle le contenu de [`firestore.rules`](firestore.rules) puis *Publier*.
5. Paramètres du projet (⚙️) > *Vos applications* > ajoute une app **Web** (`</>`), copie la config.
6. Copie `.env.example` en `.env` et remplis les valeurs.
7. Déploie les fonctions et les règles selon [la procédure de sécurité](SECURITY-DEPLOYMENT.md), puis relance `npx.cmd expo start`. L’un crée l’espace et génère une invitation valable 24 heures ; l’autre la saisit pour le rejoindre.

## Activer les photos, l'assistant IA et la recherche de restos

Le déploiement des Cloud Functions et l’utilisation de Storage nécessitent le forfait **Blaze** de Firebase, avec facturation à l’usage. Configurer les alertes de budget et surveiller les dépenses ; une alerte n’est pas un plafond de facturation.

1. Console Firebase > passe au forfait **Blaze**.
2. **Storage** > Commencer, puis onglet **Règles** : colle [`storage.rules`](storage.rules).
3. Clé **Claude** (assistant, import de planning) : crée-la sur <https://console.anthropic.com> > *API Keys*. Le coût dépend du modèle, du texte et des images traités. Les appels sont limités côté serveur et exigent le consentement de la personne dans l’app.
4. Clé **Google Places** (recherche de restos) : <https://console.cloud.google.com> > *API et services* > active **Places API (New)** > *Identifiants* > crée une clé et restreins-la à Places API.
5. Installe l'outil Firebase et déploie les Cloud Functions (dossier [`functions/`](functions/src/index.ts)) :
   ```bash
   npx.cmd firebase-tools login
   ```
   ```bash
   npx.cmd firebase-tools use --add
   ```
   ```bash
   npx.cmd firebase-tools functions:secrets:set ANTHROPIC_API_KEY
   ```
   ```bash
   npx.cmd firebase-tools functions:secrets:set GOOGLE_PLACES_KEY
   ```
   ```bash
   cd functions; npm install; cd ..; npx.cmd firebase-tools deploy --only functions,firestore,storage
   ```

Les clés de ces fournisseurs restent sur le serveur (Cloud Functions) : elles ne sont jamais dans l'app. Une fois chaque service déployé et testé, activer son indicateur `EXPO_PUBLIC_ASSISTANT_ENABLED=true` ou `EXPO_PUBLIC_PLACES_ENABLED=true` dans l’environnement EAS concerné et refaire le build. Sans cette configuration, l’assistant et la recherche Places sont masqués ; l’ajout manuel de restaurants reste disponible.

## Notifications push et dictée vocale

Utiliser une version installée pour les tests natifs. Le profil `preview` produit un APK autonome :

```bash
npx eas-cli@latest build --platform android --profile preview
```

Il fonctionne sans Expo Go ni serveur de développement. Les notifications push exigent aussi les identifiants FCM/APNs et une permission accordée dans **Nous > Notifications**. Leur livraison doit être vérifiée sur un téléphone physique. La dictée reste masquée tant que l’assistant est désactivé.

## Publier sur le Play Store et l'App Store

Tout se fait dans le cloud avec **EAS** : pas besoin de Mac pour iOS.

### Prérequis (à faire toi-même, ce sont des comptes payants à ton nom)

- Compte **Expo** gratuit : <https://expo.dev/signup>
- **Google Play Console** : 25 $ une fois — <https://play.google.com/console/signup>
- **Apple Developer Program** : 99 $/an — <https://developer.apple.com/programs/enroll/>
- Une **politique de confidentialité** en ligne (une page web simple suffit ; obligatoire pour les deux stores). L'app stocke : prénoms, agenda, listes et messages du couple dans Firebase.

### Étapes

1. Choisis le nom et les identifiants définitifs dans [`app.json`](app.json) : `name`, `ios.bundleIdentifier`, `android.package` (ils ne pourront plus changer une fois publiés).
2. Ajoute les variables Firebase dans EAS (pour que les builds cloud les aient) :
   ```bash
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..." --visibility plaintext
   ```
   (à répéter pour les six variables Firebase ; utiliser `preview` pour les profils `preview` et `beta`). Le fichier `.env` est ignoré par Git : ne pas compter sur son envoi. Le hook de build refuse une configuration Firebase incomplète. Les variables `EXPO_PUBLIC_*` sont intégrées à l’application et ne doivent jamais contenir de secrets serveur.
3. Connexion et configuration :
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build:configure
   ```
4. Tester d'abord sur un vrai téléphone Android (APK installable directement) :
   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```
5. Builds de production :
   ```bash
   npx eas-cli@latest build --platform all --profile production
   ```
6. Envoi aux stores :
   ```bash
   npx eas-cli@latest submit --platform ios
   npx eas-cli@latest submit --platform android
   ```
   - **iOS** : EAS envoie vers App Store Connect → TestFlight pour tester → remplis la fiche (captures d'écran, description, confidentialité) → *Soumettre pour vérification*.
   - **Android** : la toute première fois, Google exige d'uploader le fichier `.aab` à la main dans la Play Console. Les nouveaux comptes perso doivent aussi faire un **test fermé avec au moins 12 testeurs pendant 14 jours** avant la mise en production.

### Mises à jour

- Changement de code JS uniquement : `npx eas-cli@latest update` (mise à jour instantanée, sans repasser par les stores — nécessite `npx expo install expo-updates` au préalable).
- Sinon : incrémente `version` dans `app.json`, puis rebuild + submit.

## Comptes

- À l'inscription, chaque téléphone reçoit un compte **anonyme** (aucun mot de passe).
- Onglet **Nous > Ton compte > Sécuriser mon compte** : ajoute un e-mail et un mot de passe au même compte. Sur un nouveau téléphone, **« J'ai déjà un compte »** sur l'écran de bienvenue permet de retrouver son espace (avec « mot de passe oublié »).
- **Supprimer mon compte** efface côté serveur le compte Auth, le profil et les contenus de la personne, y compris ses restaurants, listes et horaires partagés. Les horaires qui lui sont attribués et ses dépenses sont supprimés (le solde peut changer). Les dates communes et la date de rencontre, sans auteur enregistré, sont toutes effacées. Les autres contenus créés par le partenaire sont conservés ; le dernier départ efface tout l’espace. Ces conséquences sont annoncées avant confirmation. Le nettoyage reprend automatiquement après une panne. La suppression ne résilie pas un abonnement du store.
- À activer dans Firebase : Authentication > Méthode de connexion > **Anonyme** et **Adresse e-mail/Mot de passe** (déjà fait sur nous-deux-80525).

## Développement

```bash
npx.cmd expo start    # serveur de dev
npx.cmd tsc --noEmit  # vérification TypeScript
npx.cmd expo lint     # lint
npm.cmd test          # tests app (dont session et déconnexion)
npm.cmd run test:security # règles et fonctions, sur émulateurs Firebase uniquement
```

Structure : écrans dans `src/app/`, composants dans `src/components/`, données et calculs dans `src/lib/` (`backend.ts` = Firebase ou local, tests dans `src/lib/__tests__/`).
Le logo est généré par `scripts/generate-logo.js` (`node scripts/generate-logo.js`).

## Version 1.1 — préparation App Store et Nous Deux Plus

- Accueil repensé, couleurs plus douces et accès direct à l’agenda et aux envies.
- **Nos moments à deux** : idées originales de rendez-vous, sélection gratuite, ajout aux envies partagées ; bibliothèque complète et filtres avancés avec Plus.
- **Planning en photo** : semaine de référence explicite, image optimisée pour la lecture, aperçu corrigeable et ajout atomique avec contrôle des doublons. L’activation du service IA et son consentement restent nécessaires.
- **Plus** : achats natifs et restauration via RevenueCat ; droits du couple vérifiés côté serveur. Aucune facturation n’est active tant que les produits et les services ne sont pas configurés.
- Pages de confidentialité et conditions intégrées, manifeste iOS et vérifications automatiques GitHub Actions.

Consulter [l’étude de marché](docs/MARKET-AND-PRICING.md), [le guide des abonnements](docs/SUBSCRIPTIONS.md) et [le dossier App Store](docs/APP-STORE-RELEASE.md) avant toute distribution. Ces préparatifs ne remplacent pas les essais sur téléphone, la signature Apple, la configuration des services et la validation des achats en Sandbox.
