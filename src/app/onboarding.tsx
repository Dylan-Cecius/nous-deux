import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ColorPicker, Field, T } from '@/components/ui';
import { SignInForm } from '@/components/account';
import { showDialog } from '@/components/dialog';
import { Fonts, MemberColors } from '@/constants/theme';
import { createCloudCouple, createLocalCouple, joinCloudCouple, type Backend } from '@/lib/backend';
import { useCouple } from '@/lib/couple-context';
import { isFirebaseConfigured } from '@/lib/firebase';

type Step = 'profile' | 'choice' | 'join' | 'local' | 'signin';

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
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.Image
      source={require('@/assets/images/logo-heart.png')}
      accessibilityLabel="Logo Nous Deux"
      style={{
        width: 190,
        height: 190,
        marginBottom: -18,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
        ],
      }}
    />
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { setBackend } = useCouple();
  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState('');
  const [color, setColor] = useState(MemberColors[0]);
  const [code, setCode] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [busy, setBusy] = useState(false);

  const me = { name: name.trim(), color };

  const run = async (action: () => Promise<Backend>) => {
    setBusy(true);
    try {
      setBackend(await action());
    } catch (e) {
      showDialog('Oups', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
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
            <Field dark label="Ton prénom" value={name} onChangeText={setName} placeholder="Ex. Dylan" autoFocus />
            <View style={{ gap: 8 }}>
              <T variant="caption" color={MUTED}>
                Ta couleur dans l’agenda
              </T>
              <ColorPicker colors={MemberColors} value={color} onChange={setColor} ringColor={CREAM} />
            </View>
            <Button
              label="Continuer"
              variant="sunset"
              disabled={!me.name}
              onPress={() => setStep(isFirebaseConfigured ? 'choice' : 'local')}
            />
          </GlassCard>
        )}

        {step === 'profile' && isFirebaseConfigured && (
          <Pressable accessibilityRole="button" onPress={() => setStep('signin')} style={{ alignSelf: 'center', padding: 12 }}>
            <T style={{ color: MUTED, fontFamily: Fonts.bodyBold }}>J’ai déjà un compte</T>
          </Pressable>
        )}

        {step === 'signin' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Te revoilà
            </T>
            <T color={MUTED}>Connecte-toi avec l’e-mail de ton compte pour retrouver votre espace.</T>
            <SignInForm dark onSignedIn={setBackend} onBack={() => setStep('profile')} />
          </GlassCard>
        )}

        {step === 'choice' && (
          <View style={{ gap: 14 }}>
            <GlassCard>
              <T variant="h2" color={CREAM}>
                Créer notre espace
              </T>
              <T color={MUTED}>Tu obtiendras un code à envoyer à ta moitié.</T>
              <Button
                label="Créer"
                variant="sunset"
                icon="sparkles-outline"
                disabled={busy}
                onPress={() => run(() => createCloudCouple(me))}
              />
            </GlassCard>
            <GlassCard>
              <T variant="h2" color={CREAM}>
                J’ai reçu un code
              </T>
              <T color={MUTED}>Ta moitié a déjà créé votre espace ? Entre son code.</T>
              <Button label="Rejoindre" variant="glass" onPress={() => setStep('join')} />
            </GlassCard>
            <Pressable accessibilityRole="button" onPress={() => setStep('local')} style={{ alignSelf: 'center', padding: 12 }}>
              <T style={{ color: MUTED, fontFamily: Fonts.bodyBold }}>Essayer sans compte (sur ce téléphone)</T>
            </Pressable>
          </View>
        )}

        {step === 'join' && (
          <GlassCard>
            <T variant="h2" color={CREAM}>
              Rejoindre
            </T>
            <Field
              dark
              label="Code du couple"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: Fonts.bodyBold, minHeight: 60 }}
            />
            <Button
              label="Rejoindre"
              variant="sunset"
              disabled={busy || code.trim().length !== 6}
              onPress={() => run(() => joinCloudCouple(code, me))}
            />
            <Button label="Retour" variant="glass" onPress={() => setStep('choice')} />
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
            <Field dark label="Son prénom" value={partnerName} onChangeText={setPartnerName} placeholder="Ex. Camille" />
            <Button
              label="C’est parti"
              variant="sunset"
              disabled={busy || !partnerName.trim()}
              onPress={() =>
                run(() =>
                  createLocalCouple(me, {
                    name: partnerName.trim(),
                    color: MemberColors.find((c) => c !== color) ?? MemberColors[1],
                  }),
                )
              }
            />
            {isFirebaseConfigured && <Button label="Retour" variant="glass" onPress={() => setStep('choice')} />}
          </GlassCard>
        )}

        {busy && <ActivityIndicator color={PINK} />}
      </ScrollView>
    </View>
  );
}
