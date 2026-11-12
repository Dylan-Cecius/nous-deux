# Import du planning en photo

L’import reste facultatif et masqué lorsque `EXPO_PUBLIC_ASSISTANT_ENABLED` n’est pas activé. Il demande un espace cloud, un consentement individuel à l’envoi de la photo à Anthropic et la fonction serveur `assistant` déployée avec sa clé privée. Aucune clé fournisseur ne doit figurer dans l’application.

## Parcours livré

1. Dans Agenda, ouvrir « Importer mon planning en photo ».
2. Choisir le lundi de la semaine concernée, surtout si la photo ne contient que les noms des jours.
3. Photographier ou sélectionner **une seule semaine lisible**. Masquer au préalable les noms et horaires des collègues. La photo entière est préservée : aucun recadrage carré forcé.
4. Vérifier les propositions : chaque horaire sélectionné permet de corriger le titre, la date, le début et la fin. Décocher les lignes inutiles. Un horaire de nuit doit être saisi manuellement sur deux jours.
5. Valider. Tous les créneaux retenus sont enregistrés dans un lot atomique ; les doublons exacts déjà visibles dans l’agenda sont ignorés.

Si la lecture échoue, la même photo peut être réanalysée sans rouvrir la galerie. La photo n’est pas ajoutée à l’album ni enregistrée dans Firestore par ce parcours. Elle reste temporairement dans le cache du sélecteur système et en mémoire pendant l’import ; la référence mémoire est libérée à la fermeture ou au retrait du consentement.

## Défauts corrigés

- Le délai client de l’assistant est aligné sur les 120 secondes autorisées côté serveur ; le délai Firebase par défaut pouvait interrompre une analyse encore en cours.
- Les photos HEIC et captures sont converties en JPEG ; les deux dimensions sont bornées et une nouvelle compression est tentée si la limite du serveur serait dépassée.
- Les erreurs de permission, de lecture et d’analyse apparaissent dans l’écran ; le sélecteur et la préparation sont protégés contre les doubles appuis.
- La semaine cible est explicite. Le fournisseur reçoit une consigne de ne pas inventer de créneaux illisibles et d’ignorer les collègues et les jours de repos.
- Un schéma OCR compact de 52 créneaux remplace les longs objets d’actions génériques pour les photos et réduit le risque de réponse tronquée.
- Les dates impossibles, heures invalides et créneaux inversés ne peuvent pas atteindre le lot d’enregistrement sans correction. Les lignes serveur incomplètes sont omises avec un message.
- L’ancien enregistrement séquentiel d’une photo pouvait créer une demi-semaine puis des doublons lors d’une nouvelle tentative. L’import utilise désormais `backend.addEvents` en un lot.

## Vérification avant ouverture au public

Tests automatisés :

```sh
npm test -- --runInBand src/lib/__tests__/schedule-import.test.ts src/lib/__tests__/photos.test.ts
npm --prefix functions run build
node --test functions/test/assistant-schedule.test.cjs
```

À exécuter sur iPhone physique dans un build installé, avec la fonction et la clé fournisseur réellement configurées : photo HEIC, capture très haute, photo floue, planning sans date, deux créneaux sur un jour, pause de midi, horaire de nuit, permission caméra refusée, annulation du sélecteur, réseau coupé pendant l’analyse, fermeture pendant l’analyse, répétition du même import et réception sur le téléphone du partenaire. Vérifier les dates et heures réelles, pas seulement l’absence d’erreur. Les tests simulés ne prouvent pas la qualité de lecture d’un vrai planning.

Les règles Firestore acceptent actuellement uniquement les créneaux dont la fin est après le début sur une même journée. Ne pas annoncer un import automatique des horaires de nuit avant une prise en charge dédiée.
