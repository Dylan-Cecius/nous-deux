import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, View } from 'react-native';

import { AssistantContext, type AssistantMode } from './assistant-context';
import { celebrate } from './celebrate';
import { Button, Card, Field, Ionicons, Row, Sheet, T, type IconName } from './ui';
import { Fonts, useTheme } from '@/constants/theme';
import { actionIcon, applyAction, askAssistant, notifyPartner, type AssistantAction, type AssistantInput } from '@/lib/assistant';
import { useCollection, useSession } from '@/lib/couple-context';
import { DateField, TimeField } from '@/components/pickers';
import { mondayOf } from '@/lib/agenda';
import { todayKey } from '@/lib/dates';
import { eventProblem, prepareScheduleEvents } from '@/lib/schedule-import';
import { hasAiConsent } from '@/lib/backend';
import { bump, success } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photos';
import { listen, voiceSupported } from '@/lib/voice';
import { features } from '@/lib/features';

type Mode = AssistantMode;

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const { backend } = useSession();
  const available = features.assistant && backend.mode === 'cloud';
  return (
    <AssistantContext.Provider value={available ? { open: (m = 'voice') => setMode(m) } : null}>
      {children}
      {available && mode && <AssistantSheet mode={mode} onClose={() => setMode(null)} />}
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
  const existingEvents = useCollection('events');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [actions, setActions] = useState<(AssistantAction & { selected: boolean })[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayKey()));
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  const lastImage = useRef<AssistantInput | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const cloud = backend.mode === 'cloud';
  const [consent, setConsent] = useState<boolean | null>(cloud ? null : false);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    hasAiConsent(backend).then((accepted) => { if (active) setConsent(accepted); })
      .catch(() => { if (active) setConsent(false); });
    return () => { active = false; };
  }, [backend, cloud]);
  const changeConsent = async (accepted: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await backend.call('setAiConsent', { accepted });
      setConsent(accepted);
      if (!accepted) { lastImage.current = null; setPhotoUri(null); setActions([]); setReply(null); }
    }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };


  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; stopRef.current(); lastImage.current = null; };
  }, []);

  const analyze = async (input: AssistantInput) => {
    setError(null);
    setReply(null);
    setActions([]);
    try {
      const result = await askAssistant(backend, input);
      if (!activeRef.current) return;
      if (!Array.isArray(result.actions) || typeof result.reply !== 'string') throw new Error('La lecture du planning a échoué. Réessaie avec une photo nette et une seule semaine visible.');
      setReply(result.reply);
      setActions(result.actions.filter((a) => mode !== 'schedule' || a.type === 'event').map((a) => ({ ...a, selected: !eventProblem(a) })));
    } catch (e) {
      if (activeRef.current) setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async (input: AssistantInput) => {
    if (!consent || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try { await analyze(input); }
    finally { busyRef.current = false; if (activeRef.current) setLoading(false); }
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
    if (!consent || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const photo = await pickPhoto({ camera, withBase64: true, document: true });
      if (!activeRef.current || !photo) return;
      if (!photo.base64) throw new Error('Cette photo n’a pas pu être lue. Choisis une autre image.');
      const input = { imageBase64: photo.base64, mediaType: photo.mediaType, weekStart };
      lastImage.current = input;
      setPhotoUri(photo.uri);
      await analyze(input);
    } catch (e) {
      if (activeRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      if (activeRef.current) setLoading(false);
    }
  };

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setLoading(true);
    setError(null);
    try {
      const selected = actions.filter((x) => x.selected);
      // The scan is committed atomically: no half-imported week on a network
      // failure, and an exact duplicate is not added on a later retry.
      if (mode === 'schedule') {
        const prepared = prepareScheduleEvents(selected, backend.userId, partner?.id, existingEvents);
        if (prepared.events.length) {
          await backend.addEvents(prepared.events);
          await notifyPartner(session, 'Agenda');
        }
      } else {
        for (const a of selected) await applyAction(session, a);
      }
      success();
      celebrate('hearts');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      if (activeRef.current) { setSaving(false); setLoading(false); }
    }
  };

  const selectedCount = actions.filter((a) => a.selected).length;
  const hasInvalidSelection = actions.some((a) => a.selected && eventProblem(a));
  const editAction = (index: number, patch: Partial<AssistantAction>) => setActions((list) => list.map((a, i) => {
    if (i !== index) return a;
    const edited = { ...a, ...patch };
    return { ...edited, summary: `${edited.title} · ${edited.date ?? 'Date à vérifier'} · ${edited.start ?? '?'}–${edited.end ?? '?'}` };
  }));

  return (
    <Sheet visible title={mode === 'schedule' ? 'Importer un planning' : 'Assistant'} onClose={() => { if (!saving) onClose(); }}>
      {!cloud ? (
        <Card tone="soft">
          <Row style={{ gap: 10 }}>
            <Ionicons name="cloud-offline-outline" size={20} color={t.primaryDark} />
            <T variant="bodyBold" color={t.primaryDark}>
              À activer
            </T>
          </Row>
          <T>
            L’assistant est disponible dans un espace synchronisé.
          </T>
        </Card>
      ) : consent === null ? (
        <ActivityIndicator color={t.primary} />
      ) : !consent ? (
        <Card>
          <T variant="h3">Avant d’utiliser l’assistant</T>
          <T>Ta demande écrite ou dictée, ou la photo de planning que tu choisis, sera envoyée à Anthropic (Claude) pour proposer des actions.</T>
          <T>Les autres contenus de votre espace ne sont pas envoyés automatiquement. Évite d’inclure les informations personnelles d’autres personnes dans une photo.</T>
          <T muted>L’assistant est facultatif. Tu peux continuer à utiliser l’app sans lui et retirer ton accord à tout moment dans cet écran.</T>
          <Button label="J’autorise l’envoi à Anthropic" disabled={loading} onPress={() => changeConsent(true)} />
          <Button label="Pas maintenant" variant="ghost" disabled={loading} onPress={onClose} />
        </Card>
      ) : actions.length > 0 ? (
        <>
          {!!reply && <T muted>{reply}</T>}
          {mode === 'schedule' && <T variant="small" muted>Vérifie chaque date et chaque heure. Corrige les créneaux mal lus ou décoche-les avant de les ajouter.</T>}
          {mode === 'schedule' && photoUri && <Image source={{ uri: photoUri }} accessibilityLabel="Planning à comparer aux horaires proposés" resizeMode="contain" style={{ width: '100%', height: 180, borderRadius: 16 }} />}
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {actions.map((a, i) => (
              <View key={i}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: a.selected }}
                disabled={loading}
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
              {mode === 'schedule' && a.type === 'event' && a.selected && (
                <View style={{ padding: 16, paddingTop: 0, gap: 12 }}>
                  <Field label="Titre de l’horaire" value={a.title} maxLength={200} editable={!loading} onChangeText={(title) => editAction(i, { title })} />
                  <DateField label="Date de l’horaire" value={a.date ?? weekStart} onChange={(date) => { if (!loading) editAction(i, { date }); }} />
                  <Row>
                    <TimeField label="Début" value={a.start ?? '09:00'} onChange={(start) => { if (!loading) editAction(i, { start }); }} grow />
                    <TimeField label="Fin" value={a.end ?? '17:00'} onChange={(end) => { if (!loading) editAction(i, { end }); }} grow />
                  </Row>
                  {!!eventProblem(a) && <T variant="small" color={t.danger}>{eventProblem(a)}</T>}
                </View>
              )}
              </View>
            ))}
          </Card>
          <Button
            label={selectedCount > 1 ? `Ajouter les ${selectedCount}` : 'Ajouter'}
            icon="checkmark"
            disabled={loading || selectedCount === 0 || hasInvalidSelection}
            onPress={confirm}
          />
          <Button label="Recommencer" variant="ghost" disabled={loading} onPress={() => { setActions([]); setReply(null); }} />
        </>
      ) : mode === 'schedule' ? (
        <>
          <T muted>
            Choisis une seule semaine, bien éclairée, avec les dates et les heures lisibles. Masque les noms et horaires de tes collègues. Aucun horaire n’est ajouté avant ta validation.
          </T>
          <DateField label="Lundi de la semaine à importer" value={weekStart} onChange={(date) => { if (!loading) setWeekStart(mondayOf(date)); }} />
          {photoUri && <Image source={{ uri: photoUri }} accessibilityLabel="Planning sélectionné" resizeMode="contain" style={{ width: '100%', height: 180, borderRadius: 16 }} />}
          {photoUri && <Button label="Réessayer la lecture de cette photo" icon="refresh-outline" variant="soft" disabled={loading} onPress={() => { const input = lastImage.current; if (input && 'imageBase64' in input) return submit({ ...input, weekStart }); }} />}
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

      {cloud && consent && <Button label="Retirer mon accord pour l’IA" variant="ghost" small disabled={loading || listening} onPress={() => changeConsent(false)} />}
      {loading && (
        <Row style={{ justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={t.primary} />
          <T muted>{saving ? 'Enregistrement du planning…' : mode === 'schedule' ? 'Lecture du planning…' : 'L’assistant réfléchit…'}</T>
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
