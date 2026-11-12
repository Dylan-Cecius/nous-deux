import { router } from 'expo-router';
import { Linking } from 'react-native';

import { Button, Card, Screen, T } from '@/components/ui';
import { legalEntity, legalUpdatedAt, supportEmail } from '@/lib/legal';

export default function Confidentialite() {
  return (
    <Screen overline="Votre espace à deux" title="Confidentialité" onBack={() => router.canGoBack() ? router.back() : router.replace('/')}>
      <T muted>Mis à jour le {legalUpdatedAt}</T>
      <Card>
        <T variant="h2">Qui traite vos données ?</T>
        <T>{legalEntity ? `Nous Deux est exploité par ${legalEntity}.` : 'Les informations de l’exploitant restent à renseigner avant l’ouverture publique du service.'}</T>
        {supportEmail ? <Button label={`Contacter ${supportEmail}`} variant="outline" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${supportEmail}`)} /> : <T muted>Le contact d’assistance et d’exercice des droits reste à configurer avant la publication.</T>}
      </Card>
      <Card>
        <T variant="h2">Ce que vous confiez à Nous Deux</T>
        <T>Votre identifiant de compte, votre prénom, votre couleur de profil, la date de votre relation et, si vous sécurisez votre compte, votre adresse e-mail sont utilisés pour retrouver votre espace. Le mot de passe est géré par Firebase Authentication.</T>
        <T>Vous pouvez ajouter des photos, mots doux, réponses aux questions, horaires, dates importantes, listes, adresses, envies, cadeaux et dépenses. Ces contenus servent à faire fonctionner les outils que vous choisissez.</T>
        <T>Les préférences, la session et certaines données sont aussi conservées sur votre appareil. En mode local, votre espace n’est pas synchronisé avec celui de votre partenaire.</T>
      </Card>
      <Card>
        <T variant="h2">Votre partage à deux</T>
        <T>Les contenus de l’espace sont accessibles aux deux membres. Les idées cadeaux restent privées. Les réponses du jour sont dévoilées après vos deux réponses.</T>
        <T>En mode synchronisé, Google Firebase assure l’authentification, la base de données, les fichiers et les fonctions serveur. Les accès sont contrôlés par le service. Nous Deux ne propose pas de chiffrement de bout en bout. Un lien de photo déjà partagé peut donner accès à son contenu : ne le diffusez pas.</T>
      </Card>
      <Card>
        <T variant="h2">Services facultatifs</T>
        <T>Les photos sont choisies par vous. L’appareil photo et le micro ne sont sollicités que pour les fonctions correspondantes. La reconnaissance vocale dépend des services du système de votre téléphone.</T>
        <T>Si vous activez les notifications, un jeton technique permet leur transmission par Expo et les services de notification Apple ou Google. Les rappels locaux peuvent afficher le titre de vos dates sur l’écran verrouillé ; ajustez l’aperçu dans les réglages du téléphone.</T>
        <T>Lorsqu’il est disponible, l’assistant demande votre accord avant d’envoyer votre demande ou votre photo de planning à Anthropic. Vérifiez l’image pour éviter d’y inclure les données de collègues. Vous pouvez retirer cet accord dans l’assistant. Les actions proposées sont à vérifier avant validation.</T>
        <T>Lorsque la recherche d’adresses est activée, les termes que vous saisissez sont transmis à Google Places.</T>
      </Card>
      <Card>
        <T variant="h2">Abonnements</T>
        <T>Lorsque l’achat est disponible, Apple ou Google traite le paiement. RevenueCat vérifie les achats et les droits Nous Deux Plus à partir d’un identifiant technique lié à votre compte et des informations de transaction. Nous Deux ne reçoit pas le numéro complet de votre carte bancaire.</T>
        <T>Les justificatifs de paiement et certaines informations de transaction peuvent être conservés par ces prestataires selon leurs obligations. La suppression du compte Nous Deux ne résilie pas automatiquement un abonnement du store.</T>
        <Button label="Lire les conditions d’utilisation" variant="ghost" onPress={() => router.push('/conditions')} />
      </Card>
      <Card>
        <T variant="h2">Conservation et suppression</T>
        <T>Votre contenu reste dans votre espace jusqu’à sa suppression ou celle de votre compte. Ouvrez Nous → Ton compte → Supprimer mon compte pour lancer la suppression.</T>
        <T>Votre profil, vos réponses, vos mots doux, vos cadeaux, vos photos et les contenus partagés dont vous êtes l’auteur sont supprimés : horaires, restaurants, listes et dépenses. Les horaires qui vous sont attribués sont aussi retirés. Le solde des dépenses peut donc changer.</T>
        <T>Les dates importantes partagées et la date de rencontre sont également effacées, car les anciennes données ne permettent pas d’identifier leur auteur. Les autres contenus attribués à votre partenaire restent accessibles à cette personne. Si vous êtes le dernier membre, tout l’espace est supprimé. Une copie déjà téléchargée sur un autre appareil ne peut pas être effacée à distance.</T>
        <T>Un nettoyage interrompu est repris automatiquement côté serveur. Un suivi technique de la demande de suppression et des journaux de sécurité peut subsister.</T>
      </Card>
      <Card>
        <T variant="h2">Vos choix et vos droits</T>
        <T>Vous pouvez modifier ou supprimer vos contenus dans l’app et retirer les permissions dans les réglages du téléphone. Selon le droit applicable, vous disposez notamment de droits d’accès, de rectification, d’effacement, de limitation et de portabilité, et pouvez saisir une autorité de protection des données.</T>
        <T>{supportEmail ? `Pour exercer vos droits ou signaler un problème de confidentialité, écrivez à ${supportEmail}.` : 'Le contact pour exercer ces droits doit être renseigné avant la diffusion publique.'}</T>
      </Card>
    </Screen>
  );
}
