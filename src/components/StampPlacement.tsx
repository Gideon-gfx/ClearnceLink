import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

export type Placement = { mode: 'default' | 'top' | 'bottom' | 'left' | 'right' | 'custom'; size: 'small' | 'medium' | 'large'; x: number; y: number };
export const DEFAULT_PLACEMENT: Placement = { mode: 'default', size: 'medium', x: 0.5, y: 0.5 };

const SIZES = { small: 0.14, medium: 0.2, large: 0.28 };
const MODES: [Placement['mode'], string, string][] = [['top', 'Top', 'arrow-up'], ['bottom', 'Bottom', 'arrow-down'], ['left', 'Left', 'arrow-back'], ['right', 'Right', 'arrow-forward'], ['custom', 'Custom', 'move']];
const INK = '#171548';
const MUTED = '#6e6b91';
const PURPLE = '#5a17c9';

// Where the stamp sits, shown as words ("Top", "Bottom right"...).
export const placementLabel = (placement?: Placement) => {
  const mode = placement?.mode || 'default';
  const word = mode === 'default' ? 'Bottom right' : mode === 'custom' ? 'Custom' : mode.charAt(0).toUpperCase() + mode.slice(1);
  return `${word} · ${(placement?.size || 'medium').replace(/^./, (c) => c.toUpperCase())}`;
};

// The same spots the server uses when it stamps a document.
const spot = (p: Placement) => (p.mode === 'top' ? { x: 0.5, y: 0.1 } : p.mode === 'bottom' ? { x: 0.5, y: 0.9 } : p.mode === 'left' ? { x: 0.1, y: 0.5 } : p.mode === 'right' ? { x: 0.9, y: 0.5 } : p.mode === 'default' ? { x: 0.82, y: 0.88 } : { x: p.x, y: p.y });

function Chip({ label, icon, on, onPress }: { label: string; icon?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: on ? PURPLE : '#F3F0FF', borderWidth: 2, borderColor: on ? PURPLE : '#D9D2F3' }}>
      {icon ? <Ionicons name={icon as any} size={17} color={on ? 'white' : PURPLE} style={{ marginRight: 6 }} /> : null}
      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', fontWeight: '700', color: on ? 'white' : PURPLE }}>{label}</Text>
    </Pressable>
  );
}

// Choose where the stamp goes on every page: the top, bottom, left or right, or drag it anywhere on a small page preview.
export default function StampPlacement({ visible, imageUri, value, onClose, onSave }: { visible: boolean; imageUri: string | null; value?: Placement | null; onClose: () => void; onSave: (placement: Placement) => Promise<void> }) {
  const [placement, setPlacement] = useState<Placement>(value || DEFAULT_PLACEMENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  useEffect(() => { if (visible) { setPlacement(value || DEFAULT_PLACEMENT); setError(''); } }, [visible]);

  const pageWidth = Math.min(screenWidth - 90, 250);
  const pageHeight = pageWidth * 1.414;
  const stamp = pageWidth * SIZES[placement.size];
  const at = spot(placement);
  const clamp = (n: number) => Math.min(0.98, Math.max(0.02, n));
  const [dragging, setDragging] = useState(false);
  const drag = (event: any) => {
    const nextX = event?.nativeEvent?.locationX / pageWidth;
    const nextY = event?.nativeEvent?.locationY / pageHeight;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
    setPlacement((current) => ({ ...current, mode: 'custom', x: clamp(nextX), y: clamp(nextY) }));
  };
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(placement.mode === 'default' ? { ...placement, mode: 'bottom' } : placement); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the position.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={() => (busy ? undefined : onClose())}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => (busy ? undefined : onClose())} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(23,19,43,0.5)' }} />
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: '94%' }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3DF', marginBottom: 12 }} />
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={!dragging}>
            <Text style={{ fontSize: 21, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK }}>Stamp position</Text>
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 4, marginBottom: 14 }}>Choose where your stamp goes on every page you clear.</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {MODES.map(([mode, label, icon]) => <Chip key={mode} label={label} icon={icon} on={placement.mode === mode} onPress={() => setPlacement((current) => ({ ...current, mode, x: mode === 'custom' && current.mode !== 'custom' ? spot(current).x : current.x, y: mode === 'custom' && current.mode !== 'custom' ? spot(current).y : current.y }))} />)}
            </View>

            <View style={{ alignSelf: 'center', marginBottom: 6 }}>
              <View
                onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false} onResponderGrant={(event) => { setDragging(true); drag(event); }} onResponderMove={drag} onResponderRelease={() => setDragging(false)} onResponderTerminate={() => setDragging(false)}
                style={{ width: pageWidth, height: pageHeight, backgroundColor: 'white', borderWidth: 2, borderColor: '#D2CAF1', borderRadius: 6, overflow: 'hidden', shadowColor: '#3b1a8a', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
              >
                {[0.12, 0.2, 0.28, 0.36, 0.44].map((top) => <View key={top} pointerEvents="none" style={{ position: 'absolute', left: pageWidth * 0.12, right: pageWidth * 0.12, top: pageHeight * top, height: 5, borderRadius: 3, backgroundColor: '#EEEAF8' }} />)}
                {[0.54, 0.62, 0.7].map((top) => <View key={top} pointerEvents="none" style={{ position: 'absolute', left: pageWidth * 0.12, right: pageWidth * (top === 0.7 ? 0.4 : 0.12), top: pageHeight * top, height: 5, borderRadius: 3, backgroundColor: '#EEEAF8' }} />)}
                <View pointerEvents="none" style={{ position: 'absolute', left: at.x * pageWidth - stamp / 2, top: at.y * pageHeight - (stamp * 0.8) / 2, width: stamp, height: stamp * 0.8, alignItems: 'center', justifyContent: 'center', borderWidth: placement.mode === 'custom' ? 1.5 : 0, borderStyle: 'dashed', borderColor: PURPLE }}>
                  {imageUri ? <Image source={{ uri: imageUri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <ActivityIndicator color={PURPLE} />}
                </View>
              </View>
            </View>
            <Text style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginBottom: 14 }}>{placement.mode === 'custom' ? 'Drag on the page to place it exactly where you want.' : 'Tap Custom, or drag on the page, to place it yourself.'}</Text>

            <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK, marginBottom: 8 }}>Size</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['small', 'medium', 'large'] as const).map((size) => <Chip key={size} label={size.charAt(0).toUpperCase() + size.slice(1)} on={placement.size === size} onPress={() => setPlacement((current) => ({ ...current, size }))} />)}
            </View>

            {error ? <Text style={{ color: '#dc2626', marginBottom: 10, fontSize: 14 }}>{error}</Text> : null}
            <Pressable accessibilityRole="button" onPress={busy ? undefined : save} style={{ height: 58, borderRadius: 15, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="white" /> : <Ionicons name="checkmark" size={22} color="white" style={{ marginRight: 8 }} />}
              <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', fontWeight: '700', color: 'white' }}>{busy ? 'Saving...' : 'Save position'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={busy ? undefined : onClose} style={{ alignItems: 'center', padding: 14 }}><Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', fontWeight: '700', color: MUTED }}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
