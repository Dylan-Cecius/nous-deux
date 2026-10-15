import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { IconButton, Row, T } from './ui';
import { useTheme } from '@/constants/theme';
import type { PhotoFrame } from '@/lib/types';

export const DEFAULT_FRAME: PhotoFrame = { x: 0.5, y: 0.5, zoom: 1 };
const MAX_ZOOM = 3;

type Size = { w: number; h: number };

/**
 * Position de l'image dans le cadre. zoom = 1 : l'image remplit le cadre (recadrée) ;
 * zoom minimal : l'image entière est visible. x / y choisissent la partie montrée (0 = bord gauche/haut).
 */
function layoutFor(box: Size, natural: Size, frame: PhotoFrame) {
  const cover = Math.max(box.w / natural.w, box.h / natural.h);
  const minZoom = Math.min(box.w / natural.w, box.h / natural.h) / cover;
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom, frame.zoom));
  const width = natural.w * cover * zoom;
  const height = natural.h * cover * zoom;
  return {
    minZoom,
    zoom,
    width,
    height,
    left: (box.w - width) * frame.x,
    top: (box.h - height) * frame.y,
  };
}

function useFramedLayout(frame: PhotoFrame) {
  const [box, setBox] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const layout = box && natural ? layoutFor(box, natural, frame) : null;
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const onLoad = (e: { source: { width: number; height: number } }) =>
    setNatural({ w: e.source.width, h: e.source.height });
  return { box, layout, onLayout, onLoad };
}

/** Photo affichée selon le cadrage choisi. Remplit son parent. */
export function FramedPhoto({ uri, frame = DEFAULT_FRAME }: { uri: string; frame?: PhotoFrame }) {
  const { layout, onLayout, onLoad } = useFramedLayout(frame);
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={onLayout} pointerEvents="none">
      <Image
        source={{ uri }}
        onLoad={onLoad}
        // L'image est déjà dimensionnée au bon ratio : « cover » revient à l'afficher telle quelle.
        contentFit="cover"
        style={
          layout
            ? { position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }
            : StyleSheet.absoluteFill
        }
      />
    </View>
  );
}

/** Éditeur : glisser pour déplacer la photo, boutons pour zoomer. */
export function PhotoFrameEditor({
  uri,
  frame,
  onChange,
  height = 230,
  disabled = false,
}: {
  uri: string;
  frame: PhotoFrame;
  onChange: (f: PhotoFrame) => void;
  height?: number;
  disabled?: boolean;
}) {
  const t = useTheme();
  const { box, layout, onLayout, onLoad } = useFramedLayout(frame);

  // Point de départ du glissement (doigt et cadrage).
  const start = useRef({ pageX: 0, pageY: 0, frame });
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const responder = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponderCapture: () => !disabled,
    onResponderTerminationRequest: () => disabled,
    onResponderGrant: (e: GestureResponderEvent) => {
      if (disabled) return;
      start.current = { pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY, frame };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      if (disabled || !layout || !box) return;
      const from = start.current;
      const dx = e.nativeEvent.pageX - from.pageX;
      const dy = e.nativeEvent.pageY - from.pageY;
      // left = (largeur cadre − largeur image) × x : glisser de dx déplace l'image de dx.
      const x = box.w !== layout.width ? clamp(from.frame.x + dx / (box.w - layout.width)) : from.frame.x;
      const y = box.h !== layout.height ? clamp(from.frame.y + dy / (box.h - layout.height)) : from.frame.y;
      onChange({ ...from.frame, x, y });
    },
  };

  const zoomBy = (delta: number) => {
    if (disabled) return;
    const min = layout?.minZoom ?? 1;
    onChange({ ...frame, zoom: Math.min(MAX_ZOOM, Math.max(min, (layout?.zoom ?? frame.zoom) + delta)) });
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        {...responder}
        onLayout={onLayout}
        style={[
          { height, borderRadius: 22, overflow: 'hidden', backgroundColor: t.feature },
          // Sur ordinateur : curseur « main » et pas de sélection de texte pendant le glisser.
          // (styles propres au web, absents des types React Native)
          Platform.OS === 'web' && ({ cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle),
        ]}>
        {/* L'image ne reçoit pas la souris : sinon le navigateur lance son propre glisser-déposer d'image
            et le cadre ne reçoit plus le mouvement. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri }}
            onLoad={onLoad}
            contentFit="cover"
            style={
              layout
                ? { position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }
                : StyleSheet.absoluteFill
            }
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,10,15,0.25)' }]} />
        </View>
      </View>
      <T variant="small" muted style={{ textAlign: 'center' }}>
        {disabled ? 'Cadrage temporairement indisponible' : 'Fais glisser la photo pour la repositionner'}
      </T>
      <Row style={{ justifyContent: 'center', gap: 12 }}>
        <IconButton icon="remove" label="Dézoomer" disabled={disabled} onPress={() => zoomBy(-0.15)} />
        <IconButton icon="expand-outline" label="Photo entière" disabled={disabled} onPress={() => { if (!disabled) onChange({ x: 0.5, y: 0.5, zoom: 0 }); }} />
        <IconButton icon="scan-outline" label="Remplir le cadre" disabled={disabled} onPress={() => { if (!disabled) onChange(DEFAULT_FRAME); }} />
        <IconButton icon="add" label="Zoomer" disabled={disabled} onPress={() => zoomBy(0.15)} />
      </Row>
    </View>
  );
}
