import { useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from './ui';
import { useTheme } from '@/constants/theme';

export function RestaurantRating({ value, onChange, size = 18, disabled = false }: { value: number; onChange?: (v: number) => void; size?: number; disabled?: boolean }) {
  const t = useTheme();
  const editable = !!onChange;
  // A round trip through another value/state must not revive queued toggle events.
  const context = useMemo(() => ({ value, disabled, editable }), [value, disabled, editable]);
  const current = useRef<{ context: typeof context; onChange: typeof onChange } | null>(null);
  useEffect(() => {
    current.current = { context, onChange };
    return () => { current.current = null; };
  }, [context, onChange]);
  const icon = (i: number) => <Ionicons name={i <= value ? 'heart' : 'heart-outline'} size={size} color={i <= value ? t.primary : t.border} accessible={false} />;
  if (!onChange) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={value ? `Note : ${value} sur 5` : 'Aucune note'}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => <View key={i}>{icon(i)}</View>)}
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${i} cœur${i > 1 ? 's' : ''}`}
          accessibilityHint={i === value ? 'Retirer la note' : `Attribuer ${i} sur 5`}
          accessibilityState={{ selected: i === value, disabled }}
          onPress={() => {
            const latest = current.current;
            if (!disabled && latest?.context === context) return latest.onChange?.(i === value ? 0 : i);
          }}
          hitSlop={4}>
          {icon(i)}
        </Pressable>
      ))}
    </View>
  );
}
