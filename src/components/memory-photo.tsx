import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ionicons, T } from './ui';
import { useTheme } from '@/constants/theme';

type Props = { uri: string; style: StyleProp<ViewStyle> };

/** Keep the memory visible when its image cannot load. A new source has its own state. */
export function MemoryPhoto(props: Props) {
  return <MemoryPhotoSource key={props.uri} {...props} />;
}

function MemoryPhotoSource({ uri, style }: Props) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <Image
        source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover"
        onError={() => setFailed(true)} onLoad={() => setFailed(false)}
      />
      {failed && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 }]}>
          <Ionicons name="image-outline" size={24} color={t.textSecondary} />
          <T variant="small" color={t.primaryDark} style={{ textAlign: 'center' }}>Photo indisponible</T>
        </View>
      )}
    </View>
  );
}
