# Nous Deux 💞

Application mobile pour les couples (Android + iOS), faite avec Expo / React Native.

## Ce que fait l'app

| Onglet | Contenu |
| --- | --- |
| **Accueil** | Compteur « X jours ensemble » sur votre photo de couple (repositionnable), bouton **Je pense à toi**, mots doux, **question du jour** (réponse de l'autre dévoilée après la sienne), programme du jour, comptes à rebours avec rappels J-1, **souvenirs** (« Il y a un an… ») |
| **Agenda** | Une colonne par personne, horaires répétés chaque semaine, créneaux **libres tous les deux**, **import du planning en photo** (IA) |
| **Restos** | À tester / Favoris / Testés, note en cœurs, **recherche Google avec photo et adresse**, tirage au sort « On mange où ? » |
| **Listes** | Rêves (bucket list, confettis quand on coche), Films & séries (tirage au sort), **Courses** partagées, **Cadeaux secrets** (invisibles pour l'autre) |
| **Nous** | Profils et couleurs, **Souvenirs** (album), **Dépenses communes** (qui doit combien), notifications, **thème de couleur**, code du couple |

Sur chaque écran, le bouton **micro** ouvre l'**assistant** : « Ajoute Chez Mario dans nos favoris », « Je bosse jeudi de 9h à 17h », « Ajoute du lait aux courses »… Il propose les actions, tu valides.

Appui long sur un élément pour le supprimer.

### Ce qui marche où

| Fonction | Expo Go | Version installée (EAS) |
| --- | --- | --- |
| Tout l'app en mode local | ✅ | ✅ |
| Synchro à deux, photos partagées | ✅ avec Firebase | ✅ avec Firebase |
| Rappels J-1 / Jour J (notifications locales) | ✅ | ✅ |
| Notifications envoyées à ta moitié (push) | ❌ (Android) | ✅ après `eas init` |
| Dictée vocale | ❌ (saisie au clavier possible) | ✅ |
| Assistant IA, import de planning, recherche de restos | ✅ avec Firebase + Cloud Functions | ✅ |

## Lancer l'app sur ton téléphone (5 min)

1. Installe **Expo Go** sur ton téléphone (Play Store / App Store).
2. Dans ce dossier (ou double-clic sur `Lancer l'app.cmd`) :
   ```bash
   npx.cmd expo start
   ```
3. Scanne le QR code avec Expo Go (Android) ou l'appareil photo (iPhone).

Sans configuration Firebase, l'app fonctionne en **mode local** (les données restent sur un seul téléphone).

## Activer la synchro entre vos deux téléphones (Firebase)

1. Va sur <https://console.firebase.google.com>, crée un projet (Google Analytics pas nécessaire).
2. **Authentication** > Commencer > onglet *Sign-in method* > active **Anonyme**.
3. **Firestore Database** > Créer une base de données (région `eur3` par ex.) en mode production.
4. Onglet **Règles** de Firestore : colle le contenu de [`firestore.rules`](firestore.rules) puis *Publier*.
5. Paramètres du projet (⚙️) > *Vos applications* > ajoute une app **Web** (`</>`), copie la config.
6. Copie `.env.example` en `.env` et remplis les valeurs.
7. Relance `npx.cmd expo start`. À l'ouverture, l'un crée l'espace et envoie le code, l'autre le rejoint.

## Activer les photos, l'assistant IA et la recherche de restos

Ces trois fonctions demandent le forfait **Blaze** de Firebase (paiement à l'usage, avec un quota gratuit largement suffisant pour un couple). Mets une alerte de budget dans Google Cloud pour être tranquille.

1. Console Firebase > passe au forfait **Blaze**.
2. **Storage** > Commencer, puis onglet **Règles** : colle [`storage.rules`](storage.rules).
3. Clé **Claude** (assistant, import de planning) : crée-la sur <https://console.anthropic.com> > *API Keys*. Chaque demande coûte environ 1 à 2 centimes (modèle Claude Opus 5.5).
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

Les clés restent sur le serveur (Cloud Functions) : elles ne sont jamais dans l'app.

## Notifications push et dictée vocale

Elles ont besoin d'une vraie version installée de l'app (pas Expo Go) :

```bash
npx.cmd eas-cli@latest init
```
```bash
npx.cmd eas-cli@latest build --platform android --profile development
```

Installe l'APK obtenu sur ton téléphone, puis lance `npx.cmd expo start` : l'app se connecte à ton PC comme avec Expo Go.
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
   (à répéter pour chaque variable de `.env`), ou laisse simplement le fichier `.env` dans le projet : il est envoyé avec le build.
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
- **Supprimer mon compte** efface le profil et les idées cadeaux ; si l'autre membre est parti, tout l'espace est effacé.
- À activer dans Firebase : Authentication > Méthode de connexion > **Anonyme** et **Adresse e-mail/Mot de passe** (déjà fait sur nous-deux-80525).

## Développement

```bash
npx.cmd expo start    # serveur de dev
npx.cmd tsc --noEmit  # vérification TypeScript
npx.cmd expo lint     # lint
npm.cmd test          # tests automatiques (dates, créneaux libres, dépenses)
```

Structure : écrans dans `src/app/`, composants dans `src/components/`, données et calculs dans `src/lib/` (`backend.ts` = Firebase ou local, tests dans `src/lib/__tests__/`).
Le logo est généré par `scripts/generate-logo.js` (`node scripts/generate-logo.js`).
