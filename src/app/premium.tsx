import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { showDialog } from '@/components/dialog';
import { Button, Card, Ionicons, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { billingLegal, buySubscription, loadSubscriptionPackages, manageSubscriptions, restoreSubscriptions, validLegalUrl } from '@/lib/billing';
import { useCouple } from '@/lib/couple-context';
import { firebase } from '@/lib/firebase';
import { useSubscription } from '@/lib/subscription';

export default function PremiumScreen() {
  const t = useTheme();
  const { backend } = useCouple();
  const subscription = useSubscription();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const secured = backend?.mode === 'cloud' && firebase().auth.currentUser?.isAnonymous === false;
  const legalReady = validLegalUrl(billingLegal.privacy) && validLegalUrl(billingLegal.terms);
  const chosen = packages.find((p) => p.identifier === selected);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    if (!subscription.available || !secured || !backend) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setLoadingOffers(true);
      return loadSubscriptionPackages(backend.userId);
    }).then((offers) => {
      if (!active) return;
      setPackages(offers);
      setSelected((offers.find((p) => p.product.subscriptionPeriod === 'P1Y') ?? offers[0])?.identifier ?? null);
      if (!offers.length) setStoreError('Les offres ne sont pas encore disponibles. Réessaie plus tard.');
    }).catch(() => { if (active) setStoreError('Impossible de charger les tarifs. Vérifie ta connexion et réessaie.'); })
      .finally(() => { if (active) setLoadingOffers(false); });
    return () => { active = false; };
  }, [backend, secured, subscription.available]);

  async function purchase() {
    if (!backend || !chosen || busy || !legalReady || !secured) return;
    setBusy(true);
    try {
      if (await buySubscription(backend.userId, chosen)) {
        await subscription.refresh();
        showDialog('Achat reçu', 'Ton achat sera affiché dès sa vérification. Si l’accès ne s’active pas immédiatement, utilise « Actualiser mon accès ».');
      }
    } finally { setBusy(false); }
  }

  async function restore() {
    if (!backend || busy) return;
    setBusy(true);
    try {
      await restoreSubscriptions(backend.userId);
      await subscription.refresh();
      showDialog('Restauration terminée', 'L’accès est vérifié pour votre espace. Si tu utilisais un autre compte Nous Deux, reconnecte-toi à ce compte pour retrouver son abonnement.');
    } finally { setBusy(false); }
  }

  return (
    <Screen overline="Nous Deux Plus" title={'Plus de moments.\nPlus de nous.'} onBack={goBack}>
      <LinearGradient colors={['#33233D', '#66435C', '#AC6B76']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 26, borderRadius: 28, gap: 16 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Ionicons name="sparkles" size={30} color="#FBD9B9" />
          <T variant="caption" color="#FBD9B9">Un abonnement pour deux</T>
        </Row>
        <T variant="h2" color="#FFF8F4">{'Le petit coup de pouce\npour se choisir, chaque jour.'}</T>
        <T color="#F5DEDF">Toute la collection de rendez-vous et de rituels à explorer à votre rythme. Un seul de vous s’abonne, vous en profitez ensemble.</T>
      </LinearGradient>

      <Card>
        {[
          ['heart-outline', 'Des rendez-vous qui vous ressemblent', 'La bibliothèque complète d’idées pour sortir de la routine.'],
          ['options-outline', 'La bonne idée au bon moment', 'Des filtres par envie, durée et budget pour décider à deux.'],
          ['people-outline', 'Une place pour chacun', 'Plus est partagé avec ta moitié dans votre espace synchronisé.'],
        ].map(([icon, title, detail]) => (
          <Row key={title} style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
            <Ionicons name={icon as 'heart-outline'} size={23} color={t.primary} />
            <View style={{ flex: 1, gap: 4 }}><T variant="bodyBold">{title}</T><T variant="small" muted>{detail}</T></View>
          </Row>
        ))}
      </Card>

      {subscription.active ? (
        <Card tone="success">
          <T variant="h2">Vous êtes Plus ♡</T>
          <T>{subscription.owner === 'partner' ? 'Ta moitié partage son abonnement avec toi.' : 'Votre espace profite de Nous Deux Plus.'}</T>
          {subscription.expiresAt ? <T variant="small" muted>Accès vérifié jusqu’au {new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}.</T> : null}
          <Button label="Découvrir nos rituels" onPress={() => router.push('/rituels')} />
          {subscription.owner === 'self' && Platform.OS !== 'web' && <Button label="Gérer mon abonnement" variant="ghost" onPress={manageSubscriptions} />}
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {packages.map((offer) => {
            const yearly = offer.product.subscriptionPeriod === 'P1Y';
            const checked = selected === offer.identifier;
            return (
              <Pressable key={offer.identifier} accessibilityRole="radio" accessibilityState={{ selected: checked }} accessibilityLabel={`${yearly ? 'Annuel' : 'Mensuel'}, ${offer.product.priceString} par ${yearly ? 'an' : 'mois'}`} onPress={() => setSelected(offer.identifier)} style={{ padding: 20, borderRadius: 22, borderWidth: 2, borderColor: checked ? t.primary : t.border, backgroundColor: checked ? t.primarySoft : t.card }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: 4 }}><T variant="h3">{yearly ? 'Une année à deux' : 'Au fil des mois'}</T><T variant="small" muted>{yearly ? 'Facturé chaque année' : 'Facturé chaque mois'}</T></View>
                  <T variant="h2">{offer.product.priceString}<T variant="small">/{yearly ? 'an' : 'mois'}</T></T>
                </Row>
              </Pressable>
            );
          })}
          {chosen ? <Button label={`S’abonner · ${chosen.product.priceString}/${chosen.product.subscriptionPeriod === 'P1Y' ? 'an' : 'mois'}`} icon="sparkles" disabled={busy || !legalReady || subscription.loading || !!subscription.error} onPress={purchase} /> : null}
          {loadingOffers && <T muted>Chargement des tarifs du store…</T>}
          {storeError && <T muted>{storeError}</T>}
          {!subscription.available && <Card tone="soft"><T variant="bodyBold">Plus arrive bientôt</T><T variant="small" muted>Les abonnements seront proposés dans l’application installée lorsque le service sera ouvert. Votre espace gratuit reste disponible.</T></Card>}
          {subscription.available && !secured && <Card tone="soft"><T variant="bodyBold">Gardons votre accès en sécurité</T><T variant="small" muted>Associe d’abord un e-mail à ton compte dans Nous → Ton compte. Tu pourras retrouver ton abonnement sur un nouveau téléphone.</T><Button label="Aller dans Nous" variant="soft" onPress={() => router.navigate('/(tabs)/nous')} /></Card>}
          {subscription.available && secured && !legalReady && <T variant="small" muted>Les achats ouvriront lorsque les informations contractuelles seront disponibles.</T>}
        </View>
      )}

      {subscription.error && <T variant="small" color={t.danger}>{subscription.error}</T>}
      {subscription.available && secured && <Button label="Restaurer mes achats" variant="outline" disabled={busy} onPress={restore} />}
      {backend?.mode === 'cloud' && <Button label="Actualiser mon accès" variant="ghost" disabled={busy || subscription.loading} onPress={subscription.refresh} />}
      <T variant="small" muted style={{ textAlign: 'center' }}>L’accueil, l’agenda, les listes et vos souvenirs restent gratuits. Aucun abonnement n’est nécessaire pour continuer votre histoire.</T>
      {chosen && <T variant="small" muted style={{ textAlign: 'center' }}>Paiement débité à la confirmation de l’achat. Abonnement renouvelé automatiquement au tarif affiché pour la même durée, sauf résiliation avant la date de renouvellement. Gère ou annule ton abonnement dans les réglages du store. Supprimer ton compte ne résilie pas l’abonnement.</T>}
      <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {validLegalUrl(billingLegal.terms) && <Button small label="Conditions" variant="ghost" onPress={() => Linking.openURL(billingLegal.terms)} />}
        {validLegalUrl(billingLegal.privacy) && <Button small label="Confidentialité" variant="ghost" onPress={() => Linking.openURL(billingLegal.privacy)} />}
      </Row>
      <Button label="Continuer gratuitement" variant="ghost" onPress={goBack} />
    </Screen>
  );
}
