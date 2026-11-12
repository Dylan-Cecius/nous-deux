import { router } from 'expo-router';

import { Button, Card, Screen, T } from '@/components/ui';

export default function Aide() {
  return (
    <Screen overline="Nous Deux" title="Aide et confidentialité" onBack={() => router.canGoBack() ? router.back() : router.replace('/')}>
      <Card>
        <T variant="h2">Nos moments à deux et Plus</T>
        <T>Retrouvez une sélection gratuite d’idées de rendez-vous depuis l’accueil ou Nous. Ajoutez celles qui vous plaisent à vos envies communes.</T>
        <T>Plus donne accès à la bibliothèque complète et aux filtres avancés pour votre couple. Les fonctions habituelles restent gratuites. Les achats et la restauration se font depuis l’app installée, lorsque le service d’abonnement est disponible.</T>
      </Card>
      <Card>
        <T variant="h2">Vos informations</T>
        <Button label="Politique de confidentialité" variant="outline" onPress={() => router.push('/confidentialite')} />
        <Button label="Conditions d’utilisation et abonnements" variant="outline" onPress={() => router.push('/conditions')} />
      </Card>
      <Card>
        <T variant="h2">Retrouver votre espace</T>
        <T>Dans Nous → Ton compte, ajoute un e-mail et un mot de passe. Tu pourras ensuite choisir « J’ai déjà un compte » sur un autre téléphone.</T>
        <T muted>Sans e-mail, ton accès dépend de la session conservée sur ce téléphone. Protège-le avant de désinstaller l’app.</T>
      </Card>
      <Card>
        <T variant="h2">Inviter ta moitié</T>
        <T>Crée une invitation depuis l’accueil ou l’onglet Nous. Elle expire après 24 heures et ne fonctionne qu’une fois. Un nouveau code remplace le précédent.</T>
        <T>Ta moitié choisit « Rejoindre » à l’ouverture de l’app et saisit ce code. Partage-le uniquement avec elle.</T>
      </Card>
      <Card>
        <T variant="h2">Ce qui est partagé</T>
        <T>Vos profils, mots doux, photos, agenda, listes, restos et dépenses sont partagés dans votre espace. Les idées cadeaux restent privées. Les réponses du jour ne sont révélées qu’après vos deux réponses.</T>
        <T>En mode synchronisé, ces données sont hébergées par Google Firebase. Le service contrôle les accès ; il ne s’agit pas d’un chiffrement de bout en bout. Ne diffuse pas les liens de tes photos.</T>
        <T muted>En mode sans compte, les données restent sur ce téléphone et ne sont pas synchronisées avec celui de ta moitié.</T>
      </Card>
      <Card>
        <T variant="h2">Permissions et services facultatifs</T>
        <T>Tu choisis les photos à ajouter. Les notifications s’activent dans Nous → Notifications. Leur contenu reste générique pour les messages du partenaire.</T>
        <T>Lorsqu’il est disponible, l’assistant demande ton accord avant d’envoyer ta demande ou ta photo de planning à Anthropic. Ton accord peut être retiré dans l’assistant. La recherche d’adresses envoie les termes saisis à Google Places lorsqu’elle est activée.</T>
      </Card>
      <Card>
        <T variant="h2">Supprimer ton compte</T>
        <T>Ouvre Nous → Ton compte → Supprimer mon compte. Ton compte, ton profil et tes contenus sont supprimés, y compris les restaurants, envies, courses et horaires que tu as créés. Les horaires qui te sont attribués et tes dépenses sont aussi effacés ; le solde peut changer. Toutes les dates communes et la date de rencontre sont supprimées. Les autres contenus créés par ta moitié restent pour elle ; le dernier départ supprime tout l’espace.</T>
        <T>La suppression du compte ne résilie pas un abonnement souscrit sur l’App Store ou Google Play. Résilie-le depuis les réglages du store si nécessaire.</T>
        <T>Si le nettoyage est interrompu, il reprend automatiquement. Il ne peut pas effacer une copie déjà téléchargée sur un autre appareil.</T>
      </Card>
      <Card tone="soft">
        <T variant="h3">Pendant la bêta</T>
        <T>Pour signaler un problème, note l’écran, ce que tu voulais faire et le message affiché. Envoie une capture sans informations personnelles à la personne qui t’a invité à tester.</T>
      </Card>
    </Screen>
  );
}
