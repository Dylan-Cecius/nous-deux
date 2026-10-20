import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type AlertButton } from 'react-native';

import { Fonts, useTheme } from '@/constants/theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };
type Listener = (d: Dialog | null) => void;
const listeners = new Set<Listener>();

/**
 * Boîte de dialogue (même usage que Alert.alert).
 * Sur téléphone : la fenêtre native du système. Sur le web, Alert.alert ne fait rien :
 * on affiche alors notre propre fenêtre (DialogHost).
 */
export function showDialog(title: string, message?: string, buttons: AlertButton[] = [{ text: 'OK' }]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  listeners.forEach((l) => l({ title, message, buttons }));
}

/** À placer une fois, au-dessus des écrans (utile seulement sur le web). */
export function DialogHost() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const current = useRef<Dialog | null>(null);

  useEffect(() => {
    const receive: Listener = (next) => {
      current.current = next;
      setDialog(next);
    };
    listeners.add(receive);
    return () => {
      listeners.delete(receive);
      current.current = null;
    };
  }, []);

  if (!dialog) return null;

  const choose = (b?: AlertButton) => {
    if (current.current !== dialog) return;
    // Consume before invoking user code, which may immediately open another dialog.
    current.current = null;
    setDialog(null);
    b?.onPress?.();
  };
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => choose(cancel)}>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: t.background }]} accessibilityRole="alert">
          <ScrollView style={styles.content} contentContainerStyle={{ gap: 10 }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: t.text }}>{dialog.title}</Text>
            {!!dialog.message && (
              <Text style={{ fontFamily: Fonts.body, fontSize: 15, lineHeight: 21, color: t.textSecondary }}>
                {dialog.message}
              </Text>
            )}
          </ScrollView>
          <View style={styles.buttons}>
            {dialog.buttons.map((b, i) => {
              const color = b.style === 'destructive' ? t.danger : b.style === 'cancel' ? t.textSecondary : t.primary;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  onPress={() => choose(b)}
                  style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 15, color }}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(42,26,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: { width: '100%', maxWidth: 360, maxHeight: '100%', borderRadius: 24, padding: 22, gap: 10 },
  content: { flexShrink: 1, flexGrow: 0 },
  buttons: { flexShrink: 0, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  button: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
});
