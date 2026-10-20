import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssistant } from './assistant-context';
import { showDialog } from './dialog';
import { cardShadow, Fonts, Radius, Spacing, useTheme } from '@/constants/theme';
import { MemberColorOptions } from '@/constants/member-colors';
import { tap } from '@/lib/haptics';
import { foregroundOnColor } from '@/lib/color-contrast';
import { useAsyncAction } from '@/lib/use-async-action';
import { userError } from '@/lib/errors';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

/** Demande confirmation avant une suppression. */
export function confirmDelete(what: string, onConfirm: () => unknown) {
  showDialog('Supprimer ?', `« ${what} » sera supprimé pour vous deux.`, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try { await onConfirm(); }
      catch (error) { showDialog('Suppression impossible', userError(error)); }
    } },
  ]);
}

// --- Texte ------------------------------------------------------------------

type Variant = 'hero' | 'title' | 'h2' | 'h3' | 'quote' | 'body' | 'bodyBold' | 'small' | 'caption';

const variants: Record<Variant, TextStyle> = {
  hero: { fontFamily: Fonts.displayMedium, fontSize: 60, lineHeight: 64 },
  title: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38 },
  h2: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: Fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  quote: { fontFamily: Fonts.displayItalic, fontSize: 21, lineHeight: 28 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: Fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: Fonts.bodyBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
};

export function T({
  variant = 'body',
  muted,
  color,
  style,
  children,
  numberOfLines,
  selectable,
  accessibilityRole,
}: {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
  accessibilityRole?: TextProps['accessibilityRole'];
}) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[variants[variant], { color: color ?? (muted ? t.textSecondary : t.text) }, style]}>
      {children}
    </Text>
  );
}

// --- Mise en page -------------------------------------------------------------

export function Screen({
  overline,
  title,
  right,
  onBack,
  hero,
  children,
}: {
  overline?: string;
  title?: ReactNode;
  right?: ReactNode;
  /** Affiche une flèche retour (écrans ouverts depuis un onglet). */
  onBack?: () => void;
  /** Bandeau pleine largeur en haut de l'écran (remplace le titre classique). */
  hero?: ReactNode;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const assistant = useAssistant();

  if (hero) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {hero}
          {/* Les cartes remontent légèrement sur le bandeau. */}
          <View style={{ paddingHorizontal: 22, gap: 18, marginTop: -26 }}>{children}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.four,
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 140,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {onBack && (
          <View style={{ alignSelf: 'flex-start', marginBottom: -6 }}>
            <IconButton icon="chevron-back" label="Retour" onPress={onBack} />
          </View>
        )}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            {overline ? <T variant="caption" muted>{overline}</T> : null}
            <T variant="title" accessibilityRole={title == null ? undefined : 'header'}>{title}</T>
          </View>
          {right}
          {assistant && (
            <IconButton icon="mic" label="Assistant vocal" variant="primary" onPress={() => assistant.open()} />
          )}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

type Tone = 'default' | 'feature' | 'soft' | 'success';

export function Card({
  children,
  style,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tone?: Tone;
}) {
  const t = useTheme();
  const bg = { default: t.card, feature: t.feature, soft: t.primarySoft, success: t.successSoft }[tone];
  const base = [styles.card, { backgroundColor: bg }, tone === 'default' && cardShadow(t.shadow), style];
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <T variant="h2" accessibilityRole="header">{title}</T>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${action} — ${title}`}>
          <Text style={{ fontFamily: Fonts.bodyMedium, fontSize: 15, color: t.primary }}>{action}</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.four, gap: 10 }}>
      <View style={[styles.emptyIcon, { backgroundColor: t.primarySoft }]}>
        <Ionicons name={icon} size={30} color={t.primary} />
      </View>
      <T variant="h2" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T muted style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Avatar({ name, color, size = 40, ring }: { name: string; color: string; size?: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 3 : 0,
        borderColor: ring,
      }}>
      <Text style={{ color: foregroundOnColor(color), fontFamily: Fonts.bodyBold, fontSize: size * 0.4 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color, track, height = 6 }: { value: number; color: string; track: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// --- Contrôles ----------------------------------------------------------------

// A queued event must respect both the state in which it was captured and the
// current committed state. Disabling then enabling does not revive old events.
function useEnabledControl(disabled: boolean) {
  const context = useMemo(() => ({ disabled }), [disabled]);
  const current = useRef<typeof context | null>(null);
  useEffect(() => {
    current.current = context;
    return () => { current.current = null; };
  }, [context]);
  return () => !disabled && current.current === context;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  /** sunset : dégradé du logo ; glass : translucide (ces deux-là sont pensés pour un fond sombre). */
  variant?: 'primary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'sunset' | 'glass';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const canPress = useEnabledControl(!!disabled);
  const { run, pending } = useAsyncAction(() => { if (canPress()) return onPress(); });
  const unavailable = disabled || pending;
  const bg = {
    primary: t.primary,
    soft: t.primarySoft,
    outline: t.card,
    ghost: 'transparent',
    danger: 'transparent',
    sunset: 'transparent',
    glass: 'rgba(255,255,255,0.12)',
  }[variant];
  const fg = {
    primary: t.onPrimary,
    soft: t.primaryDark,
    outline: t.text,
    ghost: t.primary,
    danger: t.danger,
    sunset: '#2A1420',
    glass: '#FBF6F1',
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!unavailable, busy: pending }}
      disabled={unavailable}
      onPress={run}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: unavailable ? 0.6 : pressed ? 0.8 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: t.border },
        variant === 'glass' && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
        variant === 'sunset' && { overflow: 'hidden' },
        style,
      ]}>
      {variant === 'sunset' && (
        <LinearGradient
          colors={['#FFA36C', '#FF5A7A', '#E0479E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {pending ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: Fonts.bodyBold, fontSize: small ? 14 : 16, flexShrink: 1, textAlign: 'center', paddingVertical: 6 }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'outline',
  size = 44,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'primary' | 'accent';
  size?: number;
  disabled?: boolean;
}) {
  const t = useTheme();
  const canPress = useEnabledControl(disabled);
  const { run, pending } = useAsyncAction(() => { if (canPress()) return onPress(); });
  const unavailable = disabled || pending;
  const bg = { outline: t.card, primary: t.primary, accent: t.featureAccent }[variant];
  const fg = { outline: t.primary, primary: t.onPrimary, accent: t.feature }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={unavailable}
      accessibilityState={{ disabled: unavailable, busy: pending }}
      onPress={run}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: unavailable ? 0.5 : pressed ? 0.75 : 1,
        },
        variant === 'outline' && { borderWidth: 1, borderColor: t.border },
      ]}>
      {pending ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={size * 0.45} color={fg} />}
    </Pressable>
  );
}

export function Field({
  label,
  grow,
  dark,
  style,
  ...props
}: TextInputProps & { label?: string; grow?: boolean; /** Pour un fond sombre (écran de bienvenue). */ dark?: boolean }) {
  const t = useTheme();
  const editable = props.readOnly !== undefined ? !props.readOnly : props.editable !== false;
  const colors = dark
    ? { bg: 'rgba(0,0,0,0.28)', fg: '#FBF6F1', border: 'rgba(255,255,255,0.16)', placeholder: 'rgba(251,246,241,0.45)', label: 'rgba(251,246,241,0.7)' }
    : { bg: t.card, fg: t.text, border: t.border, placeholder: t.textSecondary, label: t.textSecondary };
  return (
    <View style={[{ gap: 6, minWidth: 0 }, grow && { flex: 1 }]}>
      {label ? (
        <T variant="caption" color={colors.label}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={colors.placeholder}
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
        accessibilityState={{ ...props.accessibilityState, disabled: props.accessibilityState?.disabled ?? !editable }}
        style={[
          styles.input,
          { backgroundColor: colors.bg, color: colors.fg, borderColor: colors.border, fontFamily: Fonts.body },
          props.multiline && { minHeight: 96, textAlignVertical: 'top', borderRadius: 18, paddingTop: 14 },
          style,
        ]}
      />
    </View>
  );
}

/** Sélecteur à onglets (« À tester / Favoris / Testés »). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segTrack, { backgroundColor: t.cardAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.seg, active && [{ backgroundColor: t.card }, cardShadow(t.shadow)]]}>
            <Text
              style={{ fontFamily: Fonts.bodyBold, fontSize: 14, color: active ? t.text : t.textSecondary, textAlign: 'center', flexShrink: 1 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: {
  options: { value: V; label: string; color?: string; icon?: IconName }[];
  value: V;
  onChange: (v: V) => void;
  label?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const canPress = useEnabledControl(disabled);
  return (
    <View style={{ gap: 8 }}>
      {label ? <T variant="caption" muted>{label}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {options.map((o) => {
          const active = o.value === value;
          const accent = o.color ?? t.primary;
          const selectedForeground = accent === t.primary ? t.onPrimary : foregroundOnColor(accent);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={label ? `${label} : ${o.label}` : o.label}
              disabled={disabled}
              accessibilityState={{ checked: active, disabled }}
              onPress={() => {
                if (!canPress()) return;
                tap();
                onChange(o.value);
              }}
              style={[
                styles.chip,
                { opacity: disabled ? 0.5 : 1 },
                { borderColor: active ? accent : t.border, backgroundColor: active ? accent : t.card },
              ]}>
              {o.icon ? <Ionicons name={o.icon} size={16} color={active ? selectedForeground : t.textSecondary} /> : null}
              <Text style={{ color: active ? selectedForeground : t.text, fontFamily: Fonts.bodyMedium, fontSize: 15 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ColorPicker({
  colors,
  value,
  onChange,
  ringColor,
  disabled = false,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  /** Couleur de l'anneau autour de la pastille choisie (par défaut : le fond de l'app). */
  ringColor?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const canPress = useEnabledControl(disabled);
  const { run, pending } = useAsyncAction((color: string) => { if (canPress()) return onChange(color); });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {colors.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityLabel={`Couleur : ${MemberColorOptions.find(option => option.value === c.toUpperCase())?.label ?? c}`}
          accessibilityState={{ checked: value === c, disabled: disabled || pending, busy: pending }}
          disabled={disabled || pending}
          onPress={() => run(c)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: value === c ? (ringColor ?? t.background) : 'transparent',
            ...(value === c ? { shadowColor: c, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 } : {}),
          }}>
          {value === c ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Bouton rond « + » en bas à droite de l'écran. */
export function Fab({ onPress, label = 'Ajouter' }: { onPress: () => void; label?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { run, pending } = useAsyncAction(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={pending}
      accessibilityState={{ disabled: pending, busy: pending }}
      onPress={run}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: t.primary,
          shadowColor: t.primary,
          bottom: insets.bottom + 100,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}>
      {pending ? <ActivityIndicator color={t.onPrimary} /> : <Ionicons name="add" size={30} color={t.onPrimary} />}
    </Pressable>
  );
}

/** Feuille modale pour les formulaires. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View style={[styles.sheet, Platform.OS === 'web' && styles.sheetWeb, { backgroundColor: t.background, paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={[styles.grabber, { backgroundColor: t.border }]} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </T>
            <IconButton icon="close" label="Fermer" onPress={onClose} size={38} />
          </Row>
          <ScrollView
            // flexShrink : la zone défile au lieu de dépasser de l'écran (indispensable sur le web).
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 18, paddingBottom: Spacing.three }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  card: { borderRadius: Radius, padding: 18, gap: 10 },
  button: {
    borderRadius: 999,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: Spacing.three },
  input: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 18, minHeight: 50, fontSize: 16 },
  segTrack: { flexDirection: 'row', borderRadius: 22, padding: 4 },
  seg: { flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fab: {
    position: 'absolute',
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  backdrop: { backgroundColor: 'rgba(42,26,34,0.45)' },
  sheet: {
    maxHeight: '90%',
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: Spacing.three,
  },
  // Sur ordinateur, la feuille reste dans la colonne de l'app (même largeur que dans _layout.tsx).
  sheetWeb: { width: '100%', maxWidth: 430, alignSelf: 'center' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
});
