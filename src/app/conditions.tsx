import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { Button, Card, Screen, T } from '@/components/ui';
import { legalEntity, legalUpdatedAt, supportEmail } from '@/lib/legal';

const appleEula = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function Conditions() {
  return (
    <Screen overline="Nous Deux" title="Conditions d’utilisation" onBack={() => router.canGoBack() ? router.back() : router.replace('/')}>
      <T muted>Mis à jour le {legalUpdatedAt}</T>
      <Card>
        <T variant="h2">Un espace pour votre couple</T>
        <T>Nous Deux vous permet d’organiser votre quotidien et de conserver vos moments à deux. Vous restez responsables des contenus que vous ajoutez et du partage de votre invitation. Ajoutez uniquement les contenus que vous êtes autorisés à partager.</T>
        <T>{legalEntity ? `Le service est exploité par ${legalEntity}.` : 'L’identité de l’exploitant reste à renseigner avant la publication.'}</T>
        <T>Les suggestions et les outils de l’app ne constituent pas des conseils médicaux, psychologiques, juridiques ou financiers. Vérifiez les résultats d’un import de planning ou de l’assistant avant de les enregistrer.</T>
      </Card>
      <Card>
        <T variant="h2">Votre abonnement Nous Deux Plus</T>
        <T>Le contenu de l’offre, sa durée et son prix dans votre devise sont affichés avant votre achat. Le prix présenté dans la confirmation du store fait foi. N’achetez que si les fonctionnalités affichées correspondent à votre besoin.</T>
        <T>Le paiement est facturé au compte Apple ou Google utilisé pour l’achat. L’abonnement est renouvelé automatiquement, sauf résiliation dans les réglages du store avant son renouvellement. Le montant et la date du prochain paiement sont consultables dans ces réglages.</T>
        <T>Un éventuel essai ou tarif de lancement ne s’applique que si le store vous le propose et confirme votre éligibilité. Les conditions et le prix suivant cette période sont affichés par le store avant confirmation.</T>
      </Card>
      <Card>
        <T variant="h2">Gérer ou restaurer un achat</T>
        <T>Vous pouvez résilier votre abonnement depuis les réglages de votre compte Apple ou Google. La résiliation empêche le prochain renouvellement ; l’accès reste soumis à la période payée et aux décisions du store.</T>
        <T>Le bouton « Restaurer mes achats » de l’écran Nous Deux Plus permet de retrouver un achat éligible avec le même compte du store. Une connexion au compte Nous Deux concerné et à Internet peut être nécessaire pour vérifier vos droits.</T>
        <T>Supprimer l’app ou votre compte Nous Deux ne résilie pas l’abonnement. Les demandes de remboursement sont traitées par le store selon ses règles et vos droits légaux.</T>
        <Button label="Gérer mes abonnements" variant="outline" icon="open-outline" onPress={() => Linking.openURL(Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions')} />
      </Card>
      <Card>
        <T variant="h2">Protéger votre accès</T>
        <T>Sécurisez votre compte avec une adresse e-mail avant de changer de téléphone. Un compte anonyme ne peut pas être récupéré si sa session est perdue. Ne partagez votre invitation qu’avec votre partenaire et ne communiquez jamais votre mot de passe.</T>
        <T>Un accès réseau et la disponibilité des prestataires sont nécessaires à la synchronisation et à certains services. Un élément déjà téléchargé par votre partenaire peut rester sur son appareil après sa suppression.</T>
      </Card>
      <Card>
        <T variant="h2">Licence et assistance</T>
        <T>Sur iOS, la licence standard Apple s’applique lorsque l’exploitant n’a pas fourni de licence personnalisée dans l’App Store. Vos droits impératifs de consommateur restent applicables.</T>
        <Button label="Licence standard Apple" variant="ghost" icon="open-outline" onPress={() => Linking.openURL(appleEula)} />
        {supportEmail ? <Button label={`Écrire à ${supportEmail}`} variant="outline" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${supportEmail}`)} /> : <T muted>Le contact d’assistance doit être configuré avant la diffusion publique.</T>}
        <Button label="Confidentialité et données" variant="ghost" onPress={() => router.push('/confidentialite')} />
      </Card>
    </Screen>
  );
}
