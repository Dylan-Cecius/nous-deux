import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ColorPicker, Field, T } from '@/components/ui';
import { SignInForm } from '@/components/account';
import { Fonts, MemberColors } from '@/constants/theme';
import { useCouple } from '@/lib/couple-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useFloatingHeartMotion } from '@/lib/use-floating-heart-motion';
import { useOnboardingForm, type OnboardingStep } from '@/lib/use-onboarding-form';

const CREAM = '#FBF6F1';
const PINK = '#FF8FB8';
const MUTED = 'rgba(251,246,241,0.72)';

/** Carte translucide teintée des couleurs du logo (pêche → rose → violet), sur le fond prune. */
function GlassCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.glass}>
      <LinearGradient
        colors={['rgba(255,170,110,0.26)', 'rgba(255,90,122,0.14)', 'rgba(166,59,216,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 26,
    padding: 20,
    gap: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,200,170,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});

/** Le cœur du logo, qui flotte et respire doucement. */
function FloatingHeart() {
  const { translateY, scale } = useFloatingHeartMotion(1800);

  return (
    <Animated.Image
      source={require('@/assets/images/logo-heart.png')}
      accessibilityLabel="Logo Nous Deux"
      style={{
        width: 190,
        height: 190,
        marginBottom: -18,
        transform: [
          { translateY },
          { scale },
        ],
      }}
    />
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { setBackend } = useCouple();
  const [step, setStep] = useState<OnboardingStep>('profile');
  const form = useOnboardingForm(setBackend, step);
  const { name, color, code, partnerName, busy, interact } = form;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {/* Même ambiance que l'écran de lancement : fond prune, cœur lumineux, nom de l'app. */}
      <StatusBar style="light" />
      <LinearGradient colors={['#4A2238', '#2A1420', '#1A0B14']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: insets.bottom + 40, gap: 22 }}>
        <View style={{ alignItems: 'center', gap: 6, paddingBottom: 8 }}>
          <FloatingHeart />
          <Text style={{ fontFamily: Fonts.display, fontSize: 44, color: CREAM }}>
            Nous <Text style={{ fontFamily: Fonts.displayItalic, color: PINK }}>Deux</Text>
          </Text>
          <T style={{ textAlign: 'center', maxWidth: 300, color: 'rgba(251,246,241,0.75)' }}>
            Votre petit espace à deux : agenda partagé, restos, envies et mots doux.
          </T>
        </View>

        {step === 'profile' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Faisons connaissance
            </T>
            <Field dark label="Ton prénom" value={name} maxLength={60} editable={!busy} onChangeText={form.changeName} placeholder="Ex. Camille" autoComplete="given-name" />
            <View style={{ gap: 8 }}>
              <T variant="caption" color={MUTED}>
                Ta couleur dans l’agenda
              </T>
              <ColorPicker colors={MemberColors} value={color} disabled={busy} onChange={form.changeColor} ringColor={CREAM} />
            </View>
            <Button
              label="Continuer"
              variant="sunset"
              disabled={busy || !name.trim()}
              onPress={() => form.continueProfile(() => setStep(isFirebaseConfigured ? 'choice' : 'local'))}
            />
          </GlassCard>
        )}

        {step === 'profile' && isFirebaseConfigured && (
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => form.navigate(() => setStep('signin'))} style={{ alignSelf: 'center', padding: 12 }}>
            <T style={{ color: MUTED, fontFamily: Fonts.bodyBold }}>J’ai déjà un compte</T>
          </Pressable>
        )}

        {step === 'signin' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Te revoilà
            </T>
            <T color={MUTED}>Connecte-toi avec l’e-mail de ton compte pour retrouver votre espace.</T>
            <SignInForm dark onSignedIn={setBackend} onBack={() => form.navigate(() => setStep('profile'))} />
          </GlassCard>
        )}

        {step === 'choice' && (
          <View style={{ gap: 14 }}>
            <GlassCard>
              <T variant="h2" color={CREAM}>
                Créer notre espace
              </T>
              <T color={MUTED}>Tu pourras créer une invitation privée et temporaire pour ta moitié.</T>
              <Button
                label="Créer"
                variant="sunset"
                icon="sparkles-outline"
                disabled={busy}
                onPress={form.createCloud}
              />
            </GlassCard>
            <GlassCard>
              <T variant="h2" color={CREAM}>
                J’ai reçu un code
              </T>
              <T color={MUTED}>Ta moitié a déjà créé votre espace ? Entre son code.</T>
              <Button label="Rejoindre" variant="glass" disabled={busy} onPress={() => form.navigate(() => setStep('join'))} />
            </GlassCard>
            <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => form.navigate(() => setStep('local'))} style={{ alignSelf: 'center', padding: 12 }}>
              <T style={{ color: MUTED, fontFamily: Fonts.bodyBold }}>Essayer sans compte (sur ce téléphone)</T>
            </Pressable>
            <Button label="Modifier mon profil" variant="glass" disabled={busy} onPress={() => form.navigate(() => setStep('profile'))} />
          </View>
        )}

        {step === 'join' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Rejoindre
            </T>
            <T color={MUTED}>Entre le code créé par ta moitié dans Nous Deux. L’invitation TestFlight sert séparément à installer l’app.</T>
            <Field
              dark
              label="Code d’invitation"
              value={code}
              editable={!busy}
              onChangeText={form.changeCode}
              placeholder="ABCD234567"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              style={{ fontSize: 26, letterSpacing: 3, textAlign: 'center', fontFamily: Fonts.bodyBold, minHeight: 60 }}
            />
            <Button
              label="Rejoindre"
              variant="sunset"
              disabled={busy || code.replace(/\s|-/g, '').length !== 10}
              onPress={form.join}
            />
            <Button label="Retour" variant="glass" disabled={busy} onPress={() => form.navigate(() => setStep('choice'))} />
          </GlassCard>
        )}

        {step === 'local' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Et ta moitié ?
            </T>
            <T color={MUTED}>
              {isFirebaseConfigured
                ? 'Les données resteront sur ce téléphone, sans synchronisation.'
                : 'La synchronisation entre vos deux téléphones n’est pas encore activée : pour l’instant, tout reste sur ce téléphone.'}
            </T>
            <Field dark label="Son prénom" value={partnerName} maxLength={60} editable={!busy} onChangeText={form.changePartnerName} placeholder="Ex. Alex" />
            <Button
              label="C’est parti"
              variant="sunset"
              disabled={busy || !partnerName.trim()}
              onPress={form.createLocal}
            />
            <Button label="Retour" variant="glass" disabled={busy} onPress={() => form.navigate(() => setStep(isFirebaseConfigured ? 'choice' : 'profile'))} />
          </GlassCard>
        )}

        {busy && <ActivityIndicator color={PINK} />}
        <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => interact(() => router.push('/aide'))} style={{ alignSelf: 'center', padding: 12 }}>
          <T variant="small" color={MUTED}>Aide et confidentialité</T>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
