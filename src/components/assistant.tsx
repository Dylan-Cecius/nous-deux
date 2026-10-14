import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';

import { AssistantContext, type AssistantMode } from './assistant-context';
import { celebrate } from './celebrate';
import { Button, Card, Field, Ionicons, Row, Sheet, T, type IconName } from './ui';
import { Fonts, useTheme } from '@/constants/theme';
import { actionIcon, applyAction, askAssistant, type AssistantAction, type AssistantInput } from '@/lib/assistant';
import { useSession } from '@/lib/couple-context';
import { bump, success } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photos';
import { listen, voiceSupported } from '@/lib/voice';

type Mode = AssistantMode;

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <AssistantContext.Provider value={{ open: (m = 'voice') => setMode(m) }}>
      {children}
      {mode && <AssistantSheet mode={mode} onClose={() => setMode(null)} />}
    </AssistantContext.Provider>
  );
}

const EXAMPLES = [
  '« Ajoute Chez Mario dans nos favoris, un italien à la Croix-Rousse »',
  '« Je bosse jeudi de 9h à 17h »',
  '« Notre anniversaire de rencontre, c’est le 14 février »',
  '« Ajoute du lait et des œufs aux courses »',
];

function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  const t = useTheme();
  const pulse = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!listening) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: t.primary,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Arrêter la dictée' : 'Parler'}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: t.primary,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: t.primary,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        })}>
        <Ionicons name={listening ? 'stop' : 'mic'} size={38} color="#fff" />
      </Pressable>
    </View>
  );
}

function AssistantSheet({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const t = useTheme();
  const session = useSession();
  const { backend, partner } = session;
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [actions, setActions] = useState<(AssistantAction & { selected: boolean })[]>([]);
  const stopRef = useRef<() => void>(() => {});
  const cloud = backend.mode === 'cloud';

  useEffect(() => () => stopRef.current(), []);

  const submit = async (input: AssistantInput) => {
    setLoading(true);
    setError(null);
    setReply(null);
    setActions([]);
    try {
      const result = await askAssistant(backend, input);
      setReply(result.reply);
      setActions(result.actions.map((a) => ({ ...a, selected: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      stopRef.current();
      return;
    }
    bump();
    setError(null);
    setListening(true);
    stopRef.current = await listen({
      onText: setText,
      onEnd: (finalText) => {
        setListening(false);
        if (finalText.trim()) submit({ text: finalText });
      },
      onError: (message) => {
        setListening(false);
        setError(message);
      },
    });
  };

  const scanSchedule = async (camera: boolean) => {
    const photo = await pickPhoto({ camera, withBase64: true });
    if (photo?.base64) submit({ imageBase64: photo.base64, mediaType: photo.mediaType });
  };

  const confirm = async () => {
    setLoading(true);
    try {
      for (const a of actions.filter((x) => x.selected)) await applyAction(session, a);
      success();
      celebrate('hearts');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  const selectedCount = actions.filter((a) => a.selected).length;

  return (
    <Sheet visible title={mode === 'schedule' ? 'Importer un planning' : 'Assistant'} onClose={onClose}>
      {!cloud ? (
        <Card tone="soft">
          <Row style={{ gap: 10 }}>
            <Ionicons name="cloud-offline-outline" size={20} color={t.primaryDark} />
            <T variant="bodyBold" color={t.primaryDark}>
              À activer
            </T>
          </Row>
          <T>
            L’assistant utilise l’IA Claude via vos Cloud Functions Firebase. Configurez Firebase puis la clé Claude
            (voir le README) pour l’utiliser.
          </T>
        </Card>
      ) : actions.length > 0 ? (
        <>
          {!!reply && <T muted>{reply}</T>}
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {actions.map((a, i) => (
              <Pressable
                key={i}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: a.selected }}
                onPress={() => setActions((list) => list.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: t.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={actionIcon(a) as IconName} size={20} color={t.primary} />
                </View>
                <T style={{ flex: 1, fontFamily: Fonts.bodyMedium }}>{a.summary}</T>
                <Ionicons
                  name={a.selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={a.selected ? t.primary : t.border}
                />
              </Pressable>
            ))}
          </Card>
          <Button
            label={selectedCount > 1 ? `Ajouter les ${selectedCount}` : 'Ajouter'}
            icon="checkmark"
            disabled={loading || selectedCount === 0}
            onPress={confirm}
          />
          <Button label="Recommencer" variant="ghost" onPress={() => setActions([])} />
        </>
      ) : mode === 'schedule' ? (
        <>
          <T muted>
            Prends en photo ton planning de travail : l’assistant lit les horaires et te propose de les ajouter à l’agenda.
          </T>
          <Button label="Prendre une photo" icon="camera-outline" disabled={loading} onPress={() => scanSchedule(true)} />
          <Button
            label="Choisir dans la galerie"
            variant="outline"
            icon="images-outline"
            disabled={loading}
            onPress={() => scanSchedule(false)}
          />
        </>
      ) : (
        <>
          {voiceSupported ? (
            <>
              <MicButton listening={listening} onPress={toggleMic} />
              <T variant="small" muted style={{ textAlign: 'center' }}>
                {listening ? 'Je t’écoute…' : 'Touche le micro et parle'}
              </T>
            </>
          ) : (
            <T variant="small" muted>
              La dictée sera disponible dans la version installée de l’app. En attendant, écris ta demande :
            </T>
          )}
          <Row>
            <Field
              value={text}
              onChangeText={setText}
              placeholder={partner ? `Ex. « Resto japonais avec ${partner.name} vendredi »` : 'Ta demande…'}
              grow
              returnKeyType="send"
              onSubmitEditing={() => text.trim() && submit({ text })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer la demande"
              disabled={!text.trim() || loading}
              onPress={() => submit({ text })}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !text.trim() || loading ? 0.45 : 1,
              }}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          </Row>
          {!loading && !reply && (
            <View style={{ gap: 6 }}>
              <T variant="caption" muted>
                Exemples
              </T>
              {EXAMPLES.map((e) => (
                <T key={e} variant="small" muted>
                  {e}
                </T>
              ))}
            </View>
          )}
        </>
      )}

      {loading && (
        <Row style={{ justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={t.primary} />
          <T muted>L’assistant réfléchit…</T>
        </Row>
      )}
      {!!reply && actions.length === 0 && !loading && <T>{reply}</T>}
      {!!error && (
        <T variant="small" color={t.danger}>
          {error}
        </T>
      )}
    </Sheet>
  );
}
