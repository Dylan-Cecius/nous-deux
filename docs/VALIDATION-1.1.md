# Vérifications de Nous Deux 1.1 — 12 novembre 2026

Base inspectée : dépôt `Dylan-Cecius/nous-deux`, commit `b32c70a`. Les résultats ci-dessous concernent le code de la branche de préparation 1.1. Aucun déploiement Firebase, achat réel, build iOS signé ou envoi aux stores n’a été effectué.

| Contrôle | Résultat observé |
| --- | --- |
| `npm run lint` | Réussi, sans erreur ni avertissement après nettoyage du cache ESLint périmé |
| `npx tsc --noEmit` | Réussi |
| `npm test -- --runInBand` | 52 tests réussis, 12 suites |
| `npm run test:security` | 31 tests réussis sur les émulateurs Firebase avec projet de démonstration ; appels RevenueCat simulés |
| `npx expo export --platform all` | Réussi : bundles Hermes iOS et Android, web et 20 routes statiques |
| Création locale dans Chromium mobile | Espace créé avec deux prénoms synthétiques, accès à l’accueil et aux rituels sans erreur JavaScript |
| Parcours navigateur | 12 contrôles réussis : date de rencontre enregistrée, rituel ajouté puis retrouvé dans les rêves après rechargement, absence d’achat simulé, accès aux deux pages légales et accueil à 320/390/430 px en clair/sombre sans débordement horizontal |
| `npm run check:store` sans configuration réelle | Refus attendu : configuration Firebase absente. Les gardes de configuration légale et facturation sont aussi couvertes par les tests |

Les contrôles métier couvrent notamment le 29 février, le changement de jour et le retour au premier plan, la réduction des animations, la validation et les doublons d’import, les tailles et formats photo, les achats annulés, les identités Firebase, les expirations et erreurs de droits Plus. Les tests serveur vérifient aussi le refus d’un tiers, le partage d’abonnement au partenaire, le départ du payeur et une suppression concurrente.

Le scénario de suppression vérifie le retrait du contenu de la personne, la conservation des contenus attribués au partenaire, l’effacement des dates communes, la reprise après une panne Storage et l’idempotence. Ce nouveau comportement doit être déployé et les éventuelles anciennes données anonymisées doivent être inventoriées avant lancement.

## Ce qui reste à valider réellement

- Lecture d’un planning représentatif avec Anthropic configuré : le schéma, le traitement d’image et la prévisualisation sont testés, mais pas la précision du prestataire sur une vraie photo.
- Deux téléphones synchronisés sur le backend déployé actuel, caméra/galerie, notifications APNs et VoiceOver.
- Construction et signature iOS, installation TestFlight, rapport de confidentialité natif et capture des écrans du binaire final.
- Produits App Store/RevenueCat, achat, restauration, renouvellement, remboursement et comptes App Review/Sandbox dédiés.
- Identité/contact, hébergement et finalisation des pages légales, conservation/effacement chez RevenueCat et validation des réserves du [dossier de publication](APP-STORE-RELEASE.md).

Les captures locales du navigateur sont des aperçus de design. Elles ne sont pas présentées comme des captures App Store natives. La CI ajoutée répète les contrôles de code, l’export web et les tests de sécurité à chaque pull request.
