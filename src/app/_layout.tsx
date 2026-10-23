import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, ScrollView, useColorScheme, View } from 'react-native';

import { CelebrationLayer } from '@/components/celebrate';
import { DialogHost } from '@/components/dialog';
import { Button, Card, T } from '@/components/ui';
import { PrefsProvider, useTheme } from '@/constants/theme';
import { CoupleProvider, useCouple } from '@/lib/couple-context';
import { getSupportContact } from '@/lib/public-info';

void SplashScreen.preventAutoHideAsync().catch(() => {
  console.warn('Écran de lancement : maintien automatique indisponible.');
});

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <PrefsProvider>
        <CoupleProvider>
          {Platform.OS === 'web' ? (
            // Sur ordinateur, l'app s'affiche dans une colonne de la largeur d'un téléphone.
            <View style={{ flex: 1, backgroundColor: scheme === 'dark' ? '#0C0709' : '#EFE6E1', alignItems: 'center' }}>
              <View style={{ flex: 1, width: '100%', maxWidth: 430, overflow: 'hidden' }}>
                <RootStack />
                <SessionCelebration />
                <SessionDialogHost />
              </View>
            </View>
          ) : (
            <>
              <RootStack />
              <SessionCelebration />
            </>
          )}
        </CoupleProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}

function SessionCelebration() {
  const { backend, loading, restoreError, syncError } = useCouple();
  if (!backend || loading || restoreError || syncError) return null;
  // Le message du partenaire ne doit pas survivre à un changement de session.
  return <CelebrationLayer key={JSON.stringify([backend.mode, backend.coupleId, backend.userId])} />;
}

function SessionDialogHost() {
  const { backend, loading, restoreError, syncError } = useCouple();
  if (loading || restoreError || syncError) return null;
  // Retirer le texte et les confirmations de l'ancien espace, tout en permettant
  // les messages de connexion quand aucun espace n'est encore ouvert.
  const scope = backend ? JSON.stringify([backend.mode, backend.coupleId, backend.userId]) : 'onboarding';
  return <DialogHost key={scope} />;
}

function RootStack() {
  const { loading, backend, restoreError, retrySession, syncError, retrySync } = useCouple();
  const support = getSupportContact();
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });
  const ready = !loading && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {
      console.warn('Écran de lancement : masquage non confirmé.');
    });
  }, [ready]);

  if (!ready) return null;

  if (restoreError || syncError) return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      contentInsetAdjustmentBehavior="automatic">
      <Card>
        <T variant="h2">Retrouvons votre espace</T>
        <T>{syncError
          ? 'Votre espace n’est pas accessible pour le moment. Ton compte est conservé : réessaie ou contacte l’assistance si cela persiste.'
          : 'La connexion n’a pas abouti. Ton compte est conservé : vérifie ton réseau, puis réessaie.'}</T>
        <Button label="Réessayer" onPress={restoreError ? retrySession : retrySync} />
        {support ? <T selectable>Assistance : {support.email}</T> : null}
      </Card>
    </ScrollView>
  );

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!backend}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="souvenirs" />
        <Stack.Screen name="depenses" />
      </Stack.Protected>
      <Stack.Protected guard={!backend}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Screen name="aide" />
    </Stack>
  );
}
