import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Linking } from 'react-native';

import { showDialog } from '@/components/dialog';
import { Button, Card, Screen, T } from '@/components/ui';
import { getPublicSupportLinks, getSupportContact } from '@/lib/public-info';
import { features } from '@/lib/features';
import { useAsyncAction } from '@/lib/use-async-action';

export default function Aide() {
  const publicLinks = getPublicSupportLinks();
  const contact = getSupportContact();
  const focus = useRef<object | null>(null);
  useFocusEffect(useCallback(() => {
    focus.current = {};
    return () => { focus.current = null; };
  }, []));
  const { run: open, pending } = useAsyncAction(async (url: string, title: string, message: string) => {
    const current = focus.current;
    if (!current) return;
    try { await Linking.openURL(url); }
    catch { if (focus.current === current) showDialog(title, message); }
  });
  const openHelp = (url: string) => open(url, 'Lien indisponible', `Tu peux ouvrir cette adresse dans ton navigateur : ${url}`);
  const emailSupport = () => {
    if (!contact) return;
    return open(contact.mailto, 'Contacter l’assistance', `Écris à ${contact.email} depuis ta messagerie. Aucun message n’a été envoyé par l’app.`);
  };
  const goBack = () => {
    focus.current = null;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <Screen overline="Nous Deux" title="Aide et confidentialité" onBack={goBack}>
      {contact && (
        <Card>
          <T variant="h2">Besoin d’aide ?</T>
          <T>{contact.operator}</T>
          <T selectable>{contact.email}</T>
          <Button label="Écrire à l’assistance" variant="soft" disabled={pending} onPress={emailSupport} />
          <T muted>Tu peux signaler un problème ou demander l’accès, la rectification ou la suppression de tes données. N’envoie ni mot de passe, ni code d’invitation, ni contenu intime.</T>
        </Card>
      )}
      {publicLinks && (
        <Card>
          <T variant="h2">Assistance et données personnelles</T>
          <Button label="Contacter l’assistance" variant="soft" disabled={pending} onPress={() => openHelp(publicLinks.support)} />
          <Button label="Lire la politique de confidentialité" variant="outline" disabled={pending} onPress={() => openHelp(publicLinks.privacy)} />
          <Button label="Demander la suppression depuis le Web" variant="ghost" disabled={pending} onPress={() => openHelp(publicLinks.deletion)} />
        </Card>
      )}
      <Card>
        <T variant="h2">Retrouver votre espace</T>
        <T>Dans un espace synchronisé, ouvre Nous → Ton compte et ajoute un e-mail et un mot de passe. Tu pourras ensuite choisir « J’ai déjà un compte » sur un autre téléphone.</T>
        <T muted>Sans e-mail, l’accès à ton espace synchronisé dépend de la session conservée sur ce téléphone. Protège-le avant de désinstaller l’app.</T>
        <T muted>En mode sans compte, il n’y a pas de connexion par e-mail : votre espace reste sur ce téléphone. Désinstaller l’app peut effacer ces données locales.</T>
      </Card>
      <Card>
        <T variant="h2">Inviter ta moitié</T>
        <T>Dans un espace synchronisé, crée une invitation depuis l’accueil ou l’onglet Nous. Elle expire après 24 heures et ne fonctionne qu’une fois. Un nouveau code remplace le précédent.</T>
        <T>Une fois Nous Deux installée, ta moitié renseigne son prénom, touche « Continuer », puis « Rejoindre » et saisit ce code. Partage-le uniquement avec elle.</T>
        <T muted>Ce code ouvre votre espace dans Nous Deux. L’invitation TestFlight permet d’installer la bêta et s’accepte séparément dans TestFlight.</T>
        <T muted>En mode sans compte, il n’y a pas de code d’invitation : les deux profils utilisent ce téléphone.</T>
      </Card>
      <Card>
        <T variant="h2">Ce qui est partagé</T>
        <T>Vos profils, mots doux, photos, agenda, listes, restos et dépenses sont partagés dans votre espace. En mode synchronisé, les idées cadeaux restent privées ; tu vois ta propre réponse du jour, et celle de ta moitié apparaît après ta participation.</T>
        <T>En mode synchronisé, ces données sont hébergées par Google Firebase. Le service contrôle les accès ; il ne s’agit pas d’un chiffrement de bout en bout. Ne diffuse pas les liens de tes photos.</T>
        <T muted>En mode sans compte, les données restent sur ce téléphone et ne sont pas synchronisées avec celui de ta moitié. Les deux profils utilisent le même appareil : les cadeaux et les réponses n’y sont pas protégés l’un de l’autre.</T>
      </Card>
      <Card>
        <T variant="h2">Permissions et services facultatifs</T>
        <T>Tu choisis les photos à ajouter. Les notifications s’activent dans Nous → Notifications. Leur contenu reste générique pour les messages du partenaire.</T>
        <T muted>Les rappels locaux peuvent afficher le titre d’une date importante sur l’écran verrouillé. Tu peux masquer les aperçus dans les réglages du téléphone.</T>
        {features.assistant
          ? <T>L’assistant demande ton accord avant d’envoyer ta demande ou ta photo de planning à Anthropic. Ton accord peut être retiré dans l’assistant.</T>
          : <T>L’assistant IA et la dictée vocale sont désactivés dans cette version. Aucun de tes contenus n’est envoyé à Anthropic.</T>}
        {features.places && <T>La recherche d’adresses envoie les termes saisis à Google Places.</T>}
      </Card>
      <Card>
        <T variant="h2">Supprimer ton compte</T>
        <T>Ouvre Nous → Ton compte → Supprimer mon compte et lis la confirmation avant de continuer.</T>
        <T>En mode synchronisé, ton profil, tes réponses, tes mots doux, tes idées cadeaux et tes photos sont supprimés. Les autres éléments partagés restent pour ta moitié ; le dernier départ supprime tout l’espace.</T>
        <T muted>Sur les éléments communs conservés en mode synchronisé, l’auteur est remplacé par « ancien membre ». Le texte peut encore contenir ton nom : il n’est pas automatiquement anonymisé. Si le nettoyage serveur est interrompu, il reprend automatiquement.</T>
        <T>En mode sans compte, cette commande efface les données et les photos enregistrées par l’app sur ce téléphone pour les deux profils. Aucun espace n’est conservé pour ta moitié sur cet appareil. L’assistance ne peut pas effacer ce stockage local à distance.</T>
        <T muted>La suppression ne peut pas effacer une copie déjà téléchargée ou enregistrée ailleurs.</T>
      </Card>
      <Card tone="soft">
        <T variant="h3">Pendant la bêta</T>
        <T>Pour signaler un problème, note l’écran, ce que tu voulais faire, le modèle du téléphone et le message affiché. Utilise le retour TestFlight ou contacte l’assistance ci-dessus avec une capture sans informations personnelles.</T>
      </Card>
    </Screen>
  );
}
