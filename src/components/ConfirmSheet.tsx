import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const PURPLE = '#5a17c9';
const INK = '#171548';
const MUTED = '#6e6b91';

// An in-app replacement for the system confirm pop-up: a bottom sheet with an icon, a clear message and full-width
// buttons. Tap outside it, or Cancel, to dismiss.
//   const { confirm, sheet } = useConfirm();
//   confirm({ icon, tone: 'danger', title, message, actions: [{ label, variant: 'primary' | 'outline' | 'danger', onPress }] });
//   ...render {sheet} somewhere in the screen.
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const [visible, setVisible] = useState(false);
  const confirm = useCallback((next) => { setOptions(next); setVisible(true); }, []);
  const close = useCallback(() => setVisible(false), []);
  const sheet = options ? <ConfirmSheet visible={visible} options={options} onClose={close} /> : null;
  return { confirm, sheet };
}

// A plain object style is used here (not a function of `pressed`): the styling layer ignores function styles, which left
// this button with no size or colour, so only Cancel showed.
function ActionButton({ label, outline, color, onPress }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: outline ? 'white' : color, borderWidth: outline ? 1.5 : 0, borderColor: '#d6ccf3', opacity: pressed ? 0.85 : 1 }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: outline ? PURPLE : 'white' }}>{label}</Text>
    </Pressable>
  );
}

export function ConfirmSheet({ visible, options, onClose }) {
  const offset = useRef(new Animated.Value(320)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const danger = options.tone === 'danger';
  const accent = danger ? '#dc2626' : PURPLE;

  useEffect(() => {
    if (!visible) return;
    offset.setValue(320); fade.setValue(0);
    Animated.parallel([
      Animated.spring(offset, { toValue: 0, damping: 24, stiffness: 230, mass: 0.85, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, offset, fade]);

  const dismiss = (then) => {
    Animated.parallel([
      Animated.timing(offset, { toValue: 320, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => { onClose(); then?.(); });
  };

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismiss()}>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#17132b', opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => dismiss()} style={{ flex: 1 }} />
        <Animated.View style={{ transform: [{ translateY: offset }], backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 28 }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#d6d3df', marginBottom: 18 }} />
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: danger ? '#fee2e2' : '#ede9fe', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name={options.icon || (danger ? 'trash-outline' : 'help-circle-outline')} size={30} color={accent} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: INK, textAlign: 'center' }}>{options.title}</Text>
            {options.message ? <Text style={{ marginTop: 8, marginBottom: 6, fontSize: 14, lineHeight: 21, color: MUTED, textAlign: 'center' }}>{options.message}</Text> : null}
          </View>
          <View style={{ marginTop: 16, gap: 10 }}>
            {(options.actions || []).map((action) => (
              <ActionButton key={action.label} label={action.label} outline={action.variant === 'outline'} color={action.variant === 'danger' || danger ? '#dc2626' : PURPLE} onPress={() => dismiss(action.onPress)} />
            ))}
            <Pressable accessibilityRole="button" onPress={() => dismiss()} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: MUTED }}>{options.cancelLabel || 'Cancel'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
