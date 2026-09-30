import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Easing, Text, View } from 'react-native';

function titleFor(message) {
  if (/cannot reach|network|server/i.test(message)) return 'Connection problem';
  if (/expired|session/i.test(message)) return 'Session expired';
  if (/incorrect|invalid|could not find|no match/i.test(message)) return 'Check your details';
  if (/too many|wait/i.test(message)) return 'Please slow down';
  return '';
}
const iconFor = (title) => (title === 'Connection problem' ? 'cloud-offline-outline' : title === 'Please slow down' ? 'time-outline' : 'alert-circle');

export default function ErrorBanner({ message, title, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(-6)).current;
  useEffect(() => {
    if (!message) return;
    opacity.setValue(0); offset.setValue(-6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [message, opacity, offset]);
  if (!message) return null;
  const heading = title || titleFor(message);
  return (
    <Animated.View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[{ opacity, transform: [{ translateY: offset }], flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderLeftWidth: 4, borderLeftColor: '#ef4444', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 14 }, style]}>
      <Ionicons name={iconFor(heading)} size={20} color="#dc2626" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        {heading ? <Text style={{ fontSize: 13, fontWeight: '700', color: '#991b1b', marginBottom: 2 }}>{heading}</Text> : null}
        <Text style={{ fontSize: 13, lineHeight: 18, color: heading ? '#b91c1c' : '#991b1b', fontWeight: heading ? '400' : '600' }}>{message}</Text>
      </View>
    </Animated.View>
  );
}
