import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, useColorScheme, View } from 'react-native';

import { Field, Ionicons, Row, T } from './ui';
import { Fonts, useTheme } from '@/constants/theme';
import { formatLong, fromKey, parseFrenchDate, parseTime, toFrenchDate, toKey } from '@/lib/dates';

type Mode = 'date' | 'time';

const toDate = (mode: Mode, value: string) => {
  if (mode === 'date') return fromKey(value);
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const fromDate = (mode: Mode, d: Date) =>
  mode === 'date' ? toKey(d) : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Champ date (YYYY-MM-DD) ou heure (HH:MM) :
 * calendrier natif sur iPhone / Android, saisie au clavier sur ordinateur.
 */
function PickerField({
  mode,
  label,
  value,
  onChange,
  maximumDate,
  grow,
  disabled = false,
}: {
  mode: Mode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
  grow?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const scheme = useColorScheme();
  const context = useMemo(() => ({ mode, disabled }), [mode, disabled]);
  const latest = useRef<{ context: typeof context; onChange: typeof onChange } | null>(null);
  useEffect(() => {
    latest.current = { context, onChange };
    return () => { latest.current = null; };
  }, [context, onChange]);
  const isCurrent = () => !disabled && latest.current?.context === context;
  const change = (next: string) => { if (isCurrent()) latest.current?.onChange(next); };

  if (Platform.OS === 'web') return <WebField mode={mode} label={label} value={value} onChange={change} grow={grow} disabled={disabled} />;

  const display = mode === 'date' ? formatLong(value) : value;

  return (
    <View style={[{ gap: 6 }, grow && { flex: 1 }]}>
      <T variant="caption" muted>
        {label}
      </T>
      {Platform.OS === 'ios' ? (
        // Sur iPhone : le bouton compact d'Apple, qui ouvre le calendrier ou la roue des heures.
        <Row style={{ minHeight: 50 }}>
          <DateTimePicker
            mode={mode}
            display="compact"
            value={toDate(mode, value)}
            maximumDate={maximumDate}
            locale="fr-FR"
            accentColor={t.primary}
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            disabled={disabled}
            onValueChange={(_, d) => change(fromDate(mode, d))}
          />
        </Row>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${display}`}
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={() => {
            if (!isCurrent()) return;
            DateTimePickerAndroid.open({
              mode,
              value: toDate(mode, value),
              maximumDate,
              is24Hour: true,
              onValueChange: (_, d) => change(fromDate(mode, d)),
            });
          }}
          style={{
            minHeight: 50,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: disabled ? 0.5 : 1,
          }}>
          <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={t.primary} />
          <T style={{ fontFamily: Fonts.bodyMedium, textTransform: mode === 'date' ? 'capitalize' : 'none' }}>{display}</T>
        </Pressable>
      )}
    </View>
  );
}

/** Sur ordinateur : saisie « JJ/MM/AAAA » ou « 9h30 », validée dès qu'elle est correcte. */
function WebField({
  mode,
  label,
  value,
  onChange,
  grow,
  disabled,
}: {
  mode: Mode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  grow?: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState(mode === 'date' ? toFrenchDate(value) : value);
  const parse = mode === 'date' ? parseFrenchDate : parseTime;
  return (
    <Field
      label={label}
      value={text}
      grow={grow}
      editable={!disabled}
      placeholder={mode === 'date' ? 'JJ/MM/AAAA' : '09:00'}
      onChangeText={(v) => {
        if (disabled) return;
        setText(v);
        const parsed = parse(v);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => setText(mode === 'date' ? toFrenchDate(value) : value)}
    />
  );
}

export const DateField = (props: Omit<Parameters<typeof PickerField>[0], 'mode'>) => <PickerField mode="date" {...props} />;
export const TimeField = (props: Omit<Parameters<typeof PickerField>[0], 'mode' | 'maximumDate'>) => (
  <PickerField mode="time" {...props} />
);
